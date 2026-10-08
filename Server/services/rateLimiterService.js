import { redisConnection } from "./bulkJobQueue.js";

// Sliding window configuration
const DEFAULT_WINDOW_MS = 60 * 1000; // 60 seconds
const DEFAULT_MAX_REQUESTS = 20; // 20 requests per minute per user
const WARNING_COOLDOWN_MS = 30 * 1000; // Send at most 1 warning message every 30 seconds

// Atomic Redis Lua script for Sliding Window Rate Limiting
const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local clearBefore = now - window

-- Remove expired entries older than the sliding window
redis.call('ZREMRANGEBYSCORE', key, 0, clearBefore)

-- Count remaining requests in current window
local currentCount = redis.call('ZCARD', key)

if currentCount < limit then
    -- Add unique member for current timestamp
    redis.call('ZADD', key, now, now .. ':' .. math.random(100000, 999999))
    redis.call('EXPIRE', key, math.ceil(window / 1000) + 5)
    return { 1, limit - currentCount - 1 }
else
    local ttl = redis.call('PTTL', key)
    return { 0, ttl }
end
`;

class RateLimiterService {
  constructor() {
    this.windowMs = Number(process.env.WA_RATE_LIMIT_WINDOW_MS) || DEFAULT_WINDOW_MS;
    this.maxRequests = Number(process.env.WA_USER_RATE_LIMIT_PER_MINUTE) || DEFAULT_MAX_REQUESTS;
    this.inMemoryWindows = new Map(); // userNumber -> Array of timestamps
    this.lastWarningSent = new Map(); // userNumber -> timestamp
  }

  /**
   * Check if a user request is allowed under the sliding window rate limit
   * @param {string} userNumber - Phone number of WhatsApp user
   * @returns {Promise<{ allowed: boolean, remaining?: number, retryAfterMs?: number }>}
   */
  async checkRateLimit(userNumber) {
    if (!userNumber) return { allowed: true };

    const cleanNumber = userNumber.toString().trim();
    const now = Date.now();

    // 1. Try Redis Atomic Sliding Window via Lua Script
    try {
      if (redisConnection && redisConnection.status === "ready") {
        const key = `wa:rate_limit:user:${cleanNumber}`;
        const result = await redisConnection.eval(
          SLIDING_WINDOW_LUA,
          1,
          key,
          now,
          this.windowMs,
          this.maxRequests
        );

        if (Array.isArray(result)) {
          const allowed = result[0] === 1;
          if (allowed) {
            return { allowed: true, remaining: result[1] };
          } else {
            return { allowed: false, retryAfterMs: result[1] > 0 ? result[1] : this.windowMs };
          }
        }
      }
    } catch (err) {
      console.warn("Redis rate limiter warning:", err.message);
    }

    // 2. In-memory sliding window fallback (if Redis is unavailable)
    return this.checkInMemoryRateLimit(cleanNumber, now);
  }

  /**
   * In-memory sliding window fallback
   */
  checkInMemoryRateLimit(userNumber, now) {
    let timestamps = this.inMemoryWindows.get(userNumber) || [];
    const cutoff = now - this.windowMs;

    // Prune expired timestamps
    timestamps = timestamps.filter((t) => t > cutoff);

    if (timestamps.length < this.maxRequests) {
      timestamps.push(now);
      this.inMemoryWindows.set(userNumber, timestamps);

      // Periodically clean up old map keys
      if (this.inMemoryWindows.size > 2000) {
        for (const [num, list] of this.inMemoryWindows.entries()) {
          const active = list.filter((t) => t > cutoff);
          if (active.length === 0) {
            this.inMemoryWindows.delete(num);
          } else {
            this.inMemoryWindows.set(num, active);
          }
        }
      }

      return { allowed: true, remaining: this.maxRequests - timestamps.length };
    }

    const oldest = timestamps[0] || now;
    const retryAfterMs = Math.max(0, oldest + this.windowMs - now);
    return { allowed: false, retryAfterMs };
  }

  /**
   * Check whether a rate-limit warning should be sent (rate-limited itself to avoid message flood)
   */
  shouldSendWarning(userNumber) {
    const cleanNumber = userNumber.toString().trim();
    const now = Date.now();
    const lastTime = this.lastWarningSent.get(cleanNumber) || 0;

    if (now - lastTime >= WARNING_COOLDOWN_MS) {
      this.lastWarningSent.set(cleanNumber, now);
      return true;
    }
    return false;
  }

  /**
   * Reset rate limit state for a user (useful for testing)
   */
  async resetRateLimit(userNumber) {
    const cleanNumber = userNumber.toString().trim();
    this.inMemoryWindows.delete(cleanNumber);
    this.lastWarningSent.delete(cleanNumber);

    try {
      if (redisConnection && redisConnection.status === "ready") {
        await redisConnection.del(`wa:rate_limit:user:${cleanNumber}`);
      }
    } catch {
      // Ignore
    }
  }
}

export const rateLimiterService = new RateLimiterService();
export default rateLimiterService;
