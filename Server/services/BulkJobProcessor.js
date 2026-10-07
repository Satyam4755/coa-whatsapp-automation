import axios from "axios";
import { Worker } from "bullmq";
import BulkMessageJob from "../models/BulkMessageJob.js";
import {
  BULK_MESSAGE_QUEUE_NAME,
  enqueueBulkMessageJob,
  redisConnection,
} from "./bulkJobQueue.js";
import { whatsappRateLimiter } from "./whatsappRateLimiter.js";

class BulkJobProcessor {
  constructor(io = null) {
    this.io = io || global.io;
    this.lastWorkerErrorLogAt = 0;
    this.suppressedWorkerErrorCount = 0;
    this.workerErrorLogIntervalMs = Number(
      process.env.BULK_QUEUE_ERROR_LOG_INTERVAL_MS || 60000
    );

    this.worker = new Worker(
      BULK_MESSAGE_QUEUE_NAME,
      async (queueJob) => this.processQueuedJob(queueJob),
      {
        connection: redisConnection,
        concurrency: Number(process.env.BULK_JOB_CONCURRENCY || 1),
      }
    );

    this.worker.on("completed", (queueJob) => {
      console.log(`Bulk queue job completed: ${queueJob.id}`);
    });

    this.worker.on("failed", (queueJob, error) => {
      console.error(`Bulk queue job failed: ${queueJob?.id}`, error);
    });

    this.worker.on("error", (error) => {
      this.logWorkerError(error);
    });

    this.enqueueRecoverableJobs().catch((error) => {
      console.error("Failed to enqueue recoverable bulk jobs:", error);
    });

    console.log("Redis-backed bulk job processor initialized");
  }

  logWorkerError(error) {
    const now = Date.now();
    const shouldLog =
      this.lastWorkerErrorLogAt === 0 ||
      now - this.lastWorkerErrorLogAt >= this.workerErrorLogIntervalMs;

    if (!shouldLog) {
      this.suppressedWorkerErrorCount++;
      return;
    }

    const suppressedText = this.suppressedWorkerErrorCount
      ? ` (${this.suppressedWorkerErrorCount} similar worker errors suppressed)`
      : "";

    console.error(`Bulk queue worker error${suppressedText}:`, error);
    this.lastWorkerErrorLogAt = now;
    this.suppressedWorkerErrorCount = 0;
  }

  async enqueueRecoverableJobs() {
    const jobs = await BulkMessageJob.find({
      status: { $in: ["pending", "processing"] },
    }).select("jobId");

    await Promise.all(jobs.map((job) => enqueueBulkMessageJob(job.jobId)));

    if (jobs.length) {
      console.log(`Re-enqueued ${jobs.length} recoverable bulk jobs`);
    }
  }

  async close() {
    if (this.worker) {
      await this.worker.close();
    }
  }

  async processQueuedJob(queueJob) {
    const { jobId } = queueJob.data;
    const job = await BulkMessageJob.findOne({ jobId }).populate("templateId");

    if (!job) {
      throw new Error(`Bulk job not found: ${jobId}`);
    }

    if (job.status === "completed" || job.status === "paused") {
      return;
    }

    job.status = "processing";
    job.updatedAt = new Date();
    await job.save();
    await this.sendJobUpdate(job.jobId);

    await this.processJob(job);
  }

  async sendJobUpdate(jobId) {
    try {
      const job = await BulkMessageJob.findOne({ jobId });
      if (!job || !this.io) return;

      const update = {
        jobId: job.jobId,
        status: job.status,
        totalRecipients: job.totalRecipients,
        processedRecipients: job.processedRecipients,
        successCount: job.successCount,
        failureCount: job.failureCount,
        progress:
          job.totalRecipients > 0
            ? Math.round((job.processedRecipients / job.totalRecipients) * 100)
            : 0,
        updatedAt: job.updatedAt,
        estimatedTimeRemaining: this.calculateETA(job),
      };

      this.io.to(`job-${jobId}`).emit("job-update", update);
      this.io.emit("job-status-change", update);
    } catch (error) {
      console.error("Error sending job update:", error);
    }
  }

  calculateETA(job) {
    if (job.status === "completed" || job.processedRecipients === 0) {
      return null;
    }

    const elapsed = Date.now() - job.createdAt.getTime();
    const rate = job.processedRecipients / elapsed;
    const remaining = job.totalRecipients - job.processedRecipients;
    return Math.round(remaining / rate / 1000);
  }

  async processJob(job) {
    const template = job.templateId;
    const waToken = process.env.WA_ACCESS_TOKEN;
    const waPhoneNumberId = process.env.WA_PHONE_NUMBER_ID;

    if (!template) {
      throw new Error(`Template missing for bulk job ${job.jobId}`);
    }

    if (!waToken || !waPhoneNumberId) {
      throw new Error("WhatsApp credentials are missing");
    }

    try {
      for (let i = job.lastProcessedIndex; i < job.recipients.length; i++) {
        const current = await BulkMessageJob.findOne({ jobId: job.jobId }).select(
          "status"
        );

        if (!current || current.status === "paused" || current.status === "failed") {
          return;
        }

        const recipient = job.recipients[i];
        if (recipient.status !== "pending") {
          continue;
        }

        const architect = recipient.architect;
        const phone = recipient.phone;

        if (!phone) {
          recipient.status = "failed";
          recipient.error = "Invalid phone number";
          job.failureCount++;
          continue;
        }

        recipient.status = "processing";

        try {
          const messagePayload = await this.buildMessagePayload(
            template,
            architect,
            phone
          );
          const result = await this.sendWhatsAppMessage(
            messagePayload,
            waToken,
            waPhoneNumberId,
            architect
          );

          if (result.status === "success") {
            recipient.status = "success";
            recipient.error = null;
            recipient.sentAt = new Date();
            job.successCount++;
          } else {
            recipient.status = "failed";
            recipient.sentAt = undefined;
            recipient.error =
              typeof result.error === "object"
                ? JSON.stringify(result.error)
                : result.error || "Unknown error";
            job.failureCount++;
          }
        } catch (error) {
          recipient.status = "failed";
          recipient.sentAt = undefined;
          recipient.error = error.message || "Unknown error occurred";
          job.failureCount++;
        }

        job.processedRecipients = i + 1;
        job.lastProcessedIndex = i + 1;
        job.updatedAt = new Date();
        await job.save();
        await this.sendJobUpdate(job.jobId);
      }

      job.status = "completed";
      job.completedAt = new Date();
      job.updatedAt = new Date();
      await job.save();
      await this.sendJobUpdate(job.jobId);
    } catch (error) {
      job.status = "failed";
      job.error = error.message;
      job.updatedAt = new Date();
      await job.save();
      await this.sendJobUpdate(job.jobId);
      throw error;
    }
  }

  async buildMessagePayload(template, architect, phone) {
    const builtComponents = (template.components || [])
      .map((comp) => {
        const type = (comp.type || "").toLowerCase();

        if (type === "header") {
          if (comp.format === "IMAGE") {
            const previewUrl = comp.example?.preview_url;
            let headerHandle = comp.example?.header_handle;
            if (Array.isArray(headerHandle)) {
              headerHandle = headerHandle[0];
            }

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

            if (
              typeof headerHandle === "number" ||
              (typeof headerHandle === "string" && /^\d+$/.test(headerHandle))
            ) {
              return {
                type: "header",
                parameters: [{ type: "image", image: { id: Number(headerHandle) } }],
              };
            }

            throw new Error(
              "Image header template is missing a valid send-time media reference. Upload an image so the template stores a preview_url or numeric media id."
            );
          }

          if (comp.format === "TEXT") {
            return {
              type: "header",
              parameters: this.buildTextParameters(comp.text, template, architect),
            };
          }
        }

        if (type === "body") {
          return {
            type: "body",
            parameters: this.buildTextParameters(comp.text, template, architect),
          };
        }

        if (type === "buttons") {
          return null;
        }

        return null;
      })
      .filter(Boolean);

    return {
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: {
        name: template.name,
        language: { code: template.language },
        components: builtComponents,
      },
    };
  }

  buildTextParameters(text, template, architect) {
    const matches = [...(text || "").matchAll(/\{\{(\d+)\}\}/g)];
    const numbers = matches.map((match) => parseInt(match[1], 10));
    const maxParameter = Math.max(0, ...numbers);

    return Array.from({ length: maxParameter }, (_, index) => {
      const field = template.variableMap?.[index + 1];
      return {
        type: "text",
        text: architect[field] || "",
      };
    });
  }

  async sendWhatsAppMessage(payload, waToken, waPhoneNumberId, architect) {
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
          timeout: 30000,
        }
      );

      return {
        status: "success",
        architect,
        response: response.data,
      };
    } catch (error) {
      return {
        status: "failed",
        architect,
        error: error.response?.data || error.message,
      };
    }
  }
}

export default BulkJobProcessor;
