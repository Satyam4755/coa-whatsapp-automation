import express from "express";
import AdminAuthenticateToken from "../middlewares/AdminAuthenticateToken.js";
import BulkMessageJob from "../models/BulkMessageJob.js";
import MessageTemplate from "../models/MessageTemplate.js";
import {
  bulkMessageQueue,
  enqueueBulkMessageJob,
  ensureRedisAvailable,
  RedisUnavailableError,
} from "../services/bulkJobQueue.js";

const router = express.Router();

// Validate phone number format for WhatsApp
const validatePhoneNumber = (mobile) => {
  if (!mobile) return false;
  
  // Remove any non-digit characters
  const cleanMobile = mobile.toString().replace(/\D/g, '');
  
  // Check if it's a valid 10-digit Indian mobile number
  if (cleanMobile.length === 10 && /^[6-9]\d{9}$/.test(cleanMobile)) {
    return `91${cleanMobile}`;
  }
  
  // Check if it already includes country code
  if (cleanMobile.length === 12 && cleanMobile.startsWith('91')) {
    return cleanMobile;
  }
  
  return false;
};

// Generate unique job ID
const generateJobId = () => {
  return `bulk_${Date.now()}_${Math.random().toString(36).substring(7)}`;
};

// Create Background Bulk Message Job
router.post("/create-background-job", AdminAuthenticateToken, async (req, res) => {
  const { templateId, allArchitects } = req.body;
  
  try {
    await ensureRedisAvailable();

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

    // Create persistent background job
    const jobId = generateJobId();
    const job = new BulkMessageJob({
      jobId,
      templateId,
      totalRecipients: recipients.length,
      recipients,
      createdBy: req.user?.email || 'system'
    });

    await job.save();
    await enqueueBulkMessageJob(jobId);
    console.log(`📝 Created background job ${jobId} with ${recipients.length} recipients`);

    // The background processor will automatically pick up this job
    return res.status(201).json({
      success: true,
      message: "Background job created successfully! Messages will be sent automatically.",
      jobId,
      totalRecipients: recipients.length,
      validRecipients: recipients.filter(r => r.status === 'pending').length,
      invalidRecipients: recipients.filter(r => r.status === 'failed').length,
      estimatedDuration: Math.ceil(recipients.filter(r => r.status === 'pending').length / 20) // seconds at 20 msg/sec
    });

  } catch (error) {
    console.error("❌ Error creating background job:", error.message);
    if (error instanceof RedisUnavailableError) {
      return res.status(503).json({
        error: error.message,
        code: "REDIS_UNAVAILABLE"
      });
    }
    return res.status(500).json({ error: "Failed to create background job" });
  }
});

// Get Job Status
router.get("/job-status/:jobId", AdminAuthenticateToken, async (req, res) => {
  try {
    const job = await BulkMessageJob.findOne({ jobId: req.params.jobId }).populate('templateId', 'name');
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    const progress = job.totalRecipients > 0 ? Math.round((job.processedRecipients / job.totalRecipients) * 100) : 0;
    
    // Calculate ETA
    let estimatedTimeRemaining = null;
    if (job.status === 'processing' && job.processedRecipients > 0) {
      const elapsed = Date.now() - job.createdAt.getTime();
      const rate = job.processedRecipients / elapsed; // recipients per ms
      const remaining = job.totalRecipients - job.processedRecipients;
      estimatedTimeRemaining = Math.round((remaining / rate) / 1000); // seconds
    }

    return res.status(200).json({
      jobId: job.jobId,
      templateName: job.templateId?.name,
      status: job.status,
      totalRecipients: job.totalRecipients,
      processedRecipients: job.processedRecipients,
      successCount: job.successCount,
      failureCount: job.failureCount,
      progress,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      completedAt: job.completedAt,
      estimatedTimeRemaining,
      createdBy: job.createdBy
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to get job status" });
  }
});

// Get Job Details with Recipients
router.get("/job-details/:jobId", AdminAuthenticateToken, async (req, res) => {
  try {
    const job = await BulkMessageJob.findOne({ jobId: req.params.jobId })
      .populate('templateId', 'name')
      .lean();
    
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    // Filter recipients based on query parameters
    const { status, limit = 50, skip = 0 } = req.query;
    let recipients = job.recipients;

    if (status && status !== 'all') {
      recipients = recipients.filter(r => r.status === status);
    }

    // Apply pagination
    const paginatedRecipients = recipients
      .slice(parseInt(skip), parseInt(skip) + parseInt(limit))
      .map(r => ({
        name: r.architect.archName,
        regNum: r.architect.archRegNum,
        mobile: r.architect.Mobile,
        status: r.status,
        error: r.error,
        sentAt: r.sentAt
      }));

    return res.status(200).json({
      jobId: job.jobId,
      templateName: job.templateId?.name,
      status: job.status,
      totalRecipients: job.totalRecipients,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      completedAt: job.completedAt,
      recipients: paginatedRecipients,
      recipientCounts: {
        total: job.recipients.length,
        pending: job.recipients.filter(r => r.status === 'pending').length,
        processing: job.recipients.filter(r => r.status === 'processing').length,
        success: job.recipients.filter(r => r.status === 'success').length,
        failed: job.recipients.filter(r => r.status === 'failed').length
      }
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to get job details" });
  }
});

// List All Jobs
router.get("/background-jobs", AdminAuthenticateToken, async (req, res) => {
  try {
    const { status, limit = 20, skip = 0 } = req.query;
    
    let query = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    const jobs = await BulkMessageJob.find(query)
      .populate('templateId', 'name')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .select('jobId status totalRecipients processedRecipients successCount failureCount createdAt updatedAt completedAt createdBy templateId');

    const totalJobs = await BulkMessageJob.countDocuments(query);

    const jobsWithProgress = jobs.map(job => ({
      ...job.toObject(),
      templateName: job.templateId?.name,
      progress: job.totalRecipients > 0 ? Math.round((job.processedRecipients / job.totalRecipients) * 100) : 0
    }));

    return res.status(200).json({ 
      jobs: jobsWithProgress,
      totalJobs,
      hasMore: (parseInt(skip) + parseInt(limit)) < totalJobs
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

// Pause Job (mark as paused - background processor will skip it)
router.post("/pause-job/:jobId", AdminAuthenticateToken, async (req, res) => {
  try {
    const job = await BulkMessageJob.findOne({ jobId: req.params.jobId });
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    if (job.status === 'completed') {
      return res.status(400).json({ error: "Cannot pause a completed job" });
    }

    job.status = 'paused';
    job.updatedAt = new Date();
    await job.save();

    return res.status(200).json({
      success: true,
      message: "Job paused successfully",
      jobId: job.jobId
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to pause job" });
  }
});

// Resume Job
router.post("/resume-job/:jobId", AdminAuthenticateToken, async (req, res) => {
  try {
    await ensureRedisAvailable();

    const job = await BulkMessageJob.findOne({ jobId: req.params.jobId });
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    if (job.status === 'completed') {
      return res.status(400).json({ error: "Job already completed" });
    }

    // Reset status to pending so background processor will pick it up
    job.status = 'pending';
    job.updatedAt = new Date();
    await job.save();
    await enqueueBulkMessageJob(job.jobId);

    return res.status(200).json({
      success: true,
      message: "Job resumed successfully",
      jobId: job.jobId
    });
  } catch (error) {
    if (error instanceof RedisUnavailableError) {
      return res.status(503).json({
        error: error.message,
        code: "REDIS_UNAVAILABLE"
      });
    }
    return res.status(500).json({ error: "Failed to resume job" });
  }
});

// Cancel Job
router.post("/cancel-job/:jobId", AdminAuthenticateToken, async (req, res) => {
  try {
    const job = await BulkMessageJob.findOne({ jobId: req.params.jobId });
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    if (job.status === 'completed') {
      return res.status(400).json({ error: "Cannot cancel a completed job" });
    }

    job.status = 'failed';
    job.error = 'Cancelled by user';
    job.updatedAt = new Date();
    await job.save();

    return res.status(200).json({
      success: true,
      message: "Job cancelled successfully",
      jobId: job.jobId
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to cancel job" });
  }
});

// Delete Job
router.delete("/delete-job/:jobId", AdminAuthenticateToken, async (req, res) => {
  try {
    await ensureRedisAvailable();

    const job = await BulkMessageJob.findOneAndDelete({ jobId: req.params.jobId });
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    const queuedJob = await bulkMessageQueue.getJob(job.jobId);
    if (queuedJob) {
      await queuedJob.remove();
    }

    return res.status(200).json({
      success: true,
      message: "Job deleted successfully"
    });
  } catch (error) {
    if (error instanceof RedisUnavailableError) {
      return res.status(503).json({
        error: error.message,
        code: "REDIS_UNAVAILABLE"
      });
    }
    return res.status(500).json({ error: "Failed to delete job" });
  }
});

// Dashboard Summary
router.get("/dashboard-summary", AdminAuthenticateToken, async (req, res) => {
  try {
    const summary = await BulkMessageJob.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalRecipients: { $sum: "$totalRecipients" },
          totalSuccess: { $sum: "$successCount" },
          totalFailed: { $sum: "$failureCount" }
        }
      }
    ]);

    // Get recent jobs
    const recentJobs = await BulkMessageJob.find()
      .populate('templateId', 'name')
      .sort({ createdAt: -1 })
      .limit(5)
      .select('jobId status totalRecipients processedRecipients successCount failureCount createdAt templateId');

    const summaryData = {
      totalJobs: summary.reduce((acc, s) => acc + s.count, 0),
      statusBreakdown: summary,
      totalMessagesAttempted: summary.reduce((acc, s) => acc + s.totalRecipients, 0),
      totalMessagesSuccess: summary.reduce((acc, s) => acc + s.totalSuccess, 0),
      totalMessagesFailed: summary.reduce((acc, s) => acc + s.totalFailed, 0),
      recentJobs: recentJobs.map(job => ({
        ...job.toObject(),
        templateName: job.templateId?.name,
        progress: job.totalRecipients > 0 ? Math.round((job.processedRecipients / job.totalRecipients) * 100) : 0
      }))
    };

    return res.status(200).json(summaryData);
  } catch (error) {
    return res.status(500).json({ error: "Failed to get dashboard summary" });
  }
});

export default router;
