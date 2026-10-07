import axios from "axios";
import dotenv from "dotenv";
import express from "express";
import MessageTemplate from "../models/MessageTemplate.js";
import { whatsappRateLimiter } from "../services/whatsappRateLimiter.js";

// Create a BulkMessageJob model for persistence
import mongoose from "mongoose";

const buildTemplateMessageComponents = (template, architect) => {
  return (template.components || [])
    .map((comp) => {
      const type = (comp.type || "").toLowerCase();

      if (type === "header") {
        if (comp.format === "IMAGE") {
          const previewUrl = comp.example?.preview_url;
          const headerHandle = Array.isArray(comp.example?.header_handle)
            ? comp.example.header_handle[0]
            : comp.example?.header_handle;

          if (previewUrl) {
            return {
              type: "header",
              parameters: [{ type: "image", image: { link: previewUrl } }],
            };
          }

          if (typeof headerHandle === "string" && /^https?:\/\//i.test(headerHandle)) {
            return {
              type: "header",
              parameters: [{ type: "image", image: { link: headerHandle } }],
            };
          }

          if (typeof headerHandle === "string" && /^\d+$/.test(headerHandle)) {
            return {
              type: "header",
              parameters: [{ type: "image", image: { id: Number(headerHandle) } }],
            };
          }

          return null;
        }

        if (comp.format === "TEXT") {
          const matches = [...(comp.text || "").matchAll(/\{\{(\d+)\}\}/g)];
          const numbers = matches.map((m) => parseInt(m[1], 10));
          const params = [];
          for (let j = 1; j <= Math.max(0, ...numbers); j++) {
            const field = template.variableMap?.[j];
            params.push({ type: "text", text: architect[field] || "" });
          }
          return { type: "header", parameters: params };
        }
      }

      if (type === "body") {
        const matches = [...(comp.text || "").matchAll(/\{\{(\d+)\}\}/g)];
        const numbers = matches.map((m) => parseInt(m[1], 10));
        const params = [];
        for (let j = 1; j <= Math.max(0, ...numbers); j++) {
          const field = template.variableMap?.[j];
          params.push({ type: "text", text: architect[field] || "" });
        }
        return { type: "body", parameters: params };
      }

      return null;
    })
    .filter(Boolean);
};

const BulkMessageJobSchema = new mongoose.Schema({
  jobId: { type: String, required: true, unique: true },
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'MessageTemplate', required: true },
  totalRecipients: { type: Number, required: true },
  processedRecipients: { type: Number, default: 0 },
  successCount: { type: Number, default: 0 },
  failureCount: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'paused'],
    default: 'pending'
  },
  recipients: [{
    architect: { type: mongoose.Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ['pending', 'processing', 'success', 'failed'],
      default: 'pending'
    },
    error: String,
    sentAt: Date,
    phone: String
  }],
  createdBy: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  completedAt: Date,
  lastProcessedIndex: { type: Number, default: 0 }
});

const BulkMessageJob = mongoose.model('BulkMessageJob', BulkMessageJobSchema);

// Enhanced message sending with rate limiting
const sendWhatsAppMessage = async (payload, waToken, waPhoneNumberId, architect) => {
  await whatsappRateLimiter.waitForTurn();

  try {
    const response = await axios.post(
      `https://graph.facebook.com/v23.0/${waPhoneNumberId}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${waToken}`,
          "Content-Type": "application/json",
        },
        timeout: 30000, // 30 second timeout
      }
    );

    return {
      status: "success",
      architect,
      response: response.data,
    };
  } catch (error) {
    const errData = error.response?.data || error.message;
    console.error(`❌ Error sending message to ${architect.archName}:`, errData);

    return {
      status: "failed",
      architect,
      error: errData
    };
  }
};

// Validate phone number format for WhatsApp
const validatePhoneNumber = (mobile) => {
  if (!mobile) return false;

  // Remove any non-digit characters
  const cleanMobile = mobile.toString().replace(/\\D/g, '');

  // Check if it's a valid 10-digit Indian mobile number
  if (cleanMobile.length === 10 && /^[6-9]\\d{9}$/.test(cleanMobile)) {
    return `91${cleanMobile}`;
  }

  // Check if it already includes country code
  if (cleanMobile.length === 12 && cleanMobile.startsWith('91')) {
    return cleanMobile;
  }

  return false;
};

dotenv.config();

const router = express.Router();
const secretKey = process.env.ADMIN_SECRET_KEY;

// Generate unique job ID
const generateJobId = () => {
  return `bulk_${Date.now()}_${Math.random().toString(36).substring(7)}`;
};

// ENHANCED: Create Bulk Message Job with Persistence
router.post("/create-bulk-job", async (req, res) => {
  const { templateId, allArchitects } = req.body;

  try {
    const template = await MessageTemplate.findById(templateId);
    if (!template || !Array.isArray(allArchitects) || !allArchitects.length) {
      return res
        .status(400)
        .json({ error: "Template and recipients are required." });
    }

    // Validate template status
    if (template.status !== 'APPROVED') {
      return res
        .status(400)
        .json({
          error: `Template status is "${template.status}". Only APPROVED templates can be sent.`,
          templateStatus: template.status,
          rejectionReason: template.rejection_reason
        });
    }

    // Validate and prepare recipients
    const recipients = allArchitects.map(architect => {
      const validPhone = validatePhoneNumber(architect.Mobile);
      return {
        architect,
        status: validPhone ? 'pending' : 'failed',
        error: validPhone ? null : (architect.Mobile ? "Invalid phone number format" : "Missing mobile number"),
        phone: validPhone
      };
    });

    // Create persistent job
    const jobId = generateJobId();
    const job = new BulkMessageJob({
      jobId,
      templateId,
      totalRecipients: recipients.length,
      recipients,
      createdBy: req.user?.email || 'system'
    });

    await job.save();
    console.log(`📝 Created bulk job ${jobId} with ${recipients.length} recipients`);

    return res.status(201).json({
      success: true,
      jobId,
      totalRecipients: recipients.length,
      validRecipients: recipients.filter(r => r.status === 'pending').length,
      invalidRecipients: recipients.filter(r => r.status === 'failed').length
    });

  } catch (error) {
    console.error("❌ Error creating bulk job:", error.message);
    return res.status(500).json({ error: "Failed to create bulk job" });
  }
});

// ENHANCED: Process Bulk Job with Recovery Support
router.post("/process-bulk-job/:jobId", async (req, res) => {
  const { jobId } = req.params;

  try {
    const job = await BulkMessageJob.findOne({ jobId }).populate('templateId');
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    if (job.status === 'completed') {
      return res.status(200).json({
        message: "Job already completed",
        results: {
          successCount: job.successCount,
          failureCount: job.failureCount,
          status: 'completed'
        }
      });
    }

    // Mark job as processing
    job.status = 'processing';
    job.updatedAt = new Date();
    await job.save();

    const template = job.templateId;
    const waToken = process.env.WA_ACCESS_TOKEN;
    const waPhoneNumberId = process.env.WA_PHONE_NUMBER_ID;

    console.log(`🚀 Processing bulk job ${jobId}, starting from index ${job.lastProcessedIndex}`);

    // Process from where we left off
    for (let i = job.lastProcessedIndex; i < job.recipients.length; i++) {
      const recipient = job.recipients[i];

      // Skip already processed recipients
      if (recipient.status !== 'pending') {
        continue;
      }

      const architect = recipient.architect;
      const phone = recipient.phone;

      if (!phone) {
        // Mark as failed and continue
        recipient.status = 'failed';
        recipient.error = 'Invalid phone number';
        job.failureCount++;
        continue;
      }

      // Mark as processing
      recipient.status = 'processing';

      try {
        // Build message payload (same as before)
        const builtComponents = buildTemplateMessageComponents(template, architect);

        const messagePayload = {
          messaging_product: "whatsapp",
          to: phone,
          type: "template",
          template: {
            name: template.name,
            language: { code: template.language },
            components: builtComponents,
          },
        };

        // Send message with rate limiting
        const result = await sendWhatsAppMessage(messagePayload, waToken, waPhoneNumberId, architect);

        // Update recipient status
        if (result.status === "success") {
          recipient.status = 'success';
          recipient.sentAt = new Date();
          job.successCount++;
          console.log(`✅ [${i+1}/${job.recipients.length}] Message sent to ${architect.archName}`);
        } else {
          recipient.status = 'failed';
          recipient.error = result.error;
          job.failureCount++;
          console.log(`❌ [${i+1}/${job.recipients.length}] Failed to send to ${architect.archName}: ${result.error}`);
        }

      } catch (error) {
        recipient.status = 'failed';
        recipient.error = error.message;
        job.failureCount++;
        console.error(`❌ [${i+1}/${job.recipients.length}] Error processing ${architect.archName}:`, error.message);
      }

      // Update progress
      job.processedRecipients = i + 1;
      job.lastProcessedIndex = i + 1;
      job.updatedAt = new Date();

      // Save progress every 10 messages for persistence
      if ((i + 1) % 10 === 0) {
        await job.save();
        console.log(`💾 Progress saved: ${i+1}/${job.recipients.length} processed`);
      }
    }

    // Mark job as completed
    job.status = 'completed';
    job.completedAt = new Date();
    job.updatedAt = new Date();
    await job.save();

    console.log(`✅ Bulk job ${jobId} completed. Success: ${job.successCount}, Failed: ${job.failureCount}`);

    return res.status(200).json({
      success: true,
      message: "Bulk job completed",
      results: {
        jobId,
        successCount: job.successCount,
        failureCount: job.failureCount,
        totalRecipients: job.totalRecipients,
        status: 'completed'
      }
    });

  } catch (error) {
    console.error(`❌ Error processing bulk job ${jobId}:`, error.message);

    // Mark job as failed
    try {
      await BulkMessageJob.findOneAndUpdate(
        { jobId },
        {
          status: 'failed',
          updatedAt: new Date(),
          error: error.message
        }
      );
    } catch (updateError) {
      console.error("Failed to update job status:", updateError.message);
    }

    return res.status(500).json({ error: "Failed to process bulk job" });
  }
});

// Get Job Status
router.get("/bulk-job-status/:jobId", async (req, res) => {
  try {
    const job = await BulkMessageJob.findOne({ jobId: req.params.jobId });
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    return res.status(200).json({
      jobId: job.jobId,
      status: job.status,
      totalRecipients: job.totalRecipients,
      processedRecipients: job.processedRecipients,
      successCount: job.successCount,
      failureCount: job.failureCount,
      progress: Math.round((job.processedRecipients / job.totalRecipients) * 100),
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      completedAt: job.completedAt
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to get job status" });
  }
});

// Resume Failed/Paused Job
router.post("/resume-bulk-job/:jobId", async (req, res) => {
  try {
    const job = await BulkMessageJob.findOne({ jobId: req.params.jobId });
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    if (job.status === 'completed') {
      return res.status(400).json({ error: "Job already completed" });
    }

    // Reset status to pending so it can be processed again
    job.status = 'pending';
    job.updatedAt = new Date();
    await job.save();

    return res.status(200).json({
      success: true,
      message: "Job marked for resumption",
      jobId: job.jobId
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to resume job" });
  }
});

// List All Jobs
router.get("/bulk-jobs", async (req, res) => {
  try {
    const jobs = await BulkMessageJob.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .select('jobId status totalRecipients processedRecipients successCount failureCount createdAt updatedAt completedAt');

    return res.status(200).json({ jobs });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

export default router;
