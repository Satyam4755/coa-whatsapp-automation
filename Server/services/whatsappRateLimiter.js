const DEFAULT_PER_SECOND = 5;
const DEFAULT_PER_MINUTE = 300;
const SECOND_WINDOW_MS = 1000;
const MINUTE_WINDOW_MS = 60 * 1000;

const toPositiveNumber = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
};

class WhatsAppRateLimiter {
  constructor({
    perSecond = process.env.WA_RATE_LIMIT_PER_SECOND,
    perMinute = process.env.WA_RATE_LIMIT_PER_MINUTE,
  } = {}) {
    this.perSecond = toPositiveNumber(perSecond, DEFAULT_PER_SECOND);
    this.perMinute = toPositiveNumber(perMinute, DEFAULT_PER_MINUTE);
    this.sentTimestamps = [];

    console.log(
      `WhatsApp rate limiter active: ${this.perSecond}/sec, ${this.perMinute}/min`
    );
  }

  prune(now = Date.now()) {
    this.sentTimestamps = this.sentTimestamps.filter(
      (timestamp) => now - timestamp < MINUTE_WINDOW_MS
    );
  }

  getWaitTime(now = Date.now()) {
    this.prune(now);

    const sentInSecond = this.sentTimestamps.filter(
      (timestamp) => now - timestamp < SECOND_WINDOW_MS
    );

    const waits = [];

    if (sentInSecond.length >= this.perSecond) {
      waits.push(SECOND_WINDOW_MS - (now - sentInSecond[0]));
    }

    if (this.sentTimestamps.length >= this.perMinute) {
      waits.push(MINUTE_WINDOW_MS - (now - this.sentTimestamps[0]));
    }

    return Math.max(0, ...waits);
  }

  async waitForTurn() {
    let waitTime = this.getWaitTime();

    while (waitTime > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      waitTime = this.getWaitTime();
    }

    this.sentTimestamps.push(Date.now());
  }
}

export const whatsappRateLimiter = new WhatsAppRateLimiter();
export default WhatsAppRateLimiter;
