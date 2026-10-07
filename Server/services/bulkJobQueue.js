import { Queue } from "bullmq";
import IORedis from "ioredis";

export const BULK_MESSAGE_QUEUE_NAME = "bulk-message-jobs";
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
console.log("Redis URL being used:", REDIS_URL);

let lastRedisError = null;

export class RedisUnavailableError extends Error {
  constructor(message, cause = null) {
    super(message);
    this.name = "RedisUnavailableError";
    this.cause = cause;
  }
}

export const redisConnection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

redisConnection.on("ready", () => {
  lastRedisError = null;
});

redisConnection.on("error", (error) => {
  lastRedisError = error;
});

function buildRedisUnavailableError(error) {
  const reason = error?.message || lastRedisError?.message || "Unknown Redis connection error";
  return new RedisUnavailableError(
    `Redis queue is unavailable. Check REDIS_URL and make sure Redis is running. (${REDIS_URL}) Reason: ${reason}`,
    error || lastRedisError
  );
}

export const bulkMessageQueue = new Queue(BULK_MESSAGE_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: {
      age: 24 * 60 * 60,
      count: 1000,
    },
    removeOnFail: false,
  },
});

export async function ensureRedisAvailable() {
  try {
    const result = await redisConnection.ping();

    if (result !== "PONG") {
      throw new Error(`Unexpected Redis ping response: ${result}`);
    }
  } catch (error) {
    throw buildRedisUnavailableError(error);
  }
}

export async function enqueueBulkMessageJob(jobId) {
  await ensureRedisAvailable();

  try {
    return bulkMessageQueue.add(
      "process-bulk-message-job",
      { jobId },
      {
        jobId,
      }
    );
  } catch (error) {
    throw buildRedisUnavailableError(error);
  }
}
