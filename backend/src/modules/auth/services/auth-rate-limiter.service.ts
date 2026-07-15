import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

type Bucket = {
  count: number;
  resetAt: number;
};

@Injectable()
export class AuthRateLimiterService {
  private readonly buckets = new Map<string, Bucket>();

  assertAllowed(key: string, limit = 5, windowMs = 15 * 60 * 1000) {
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 0, resetAt: now + windowMs });
      return;
    }

    if (bucket.count >= limit) {
      throw new HttpException(
        'Too many authentication attempts. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  recordFailure(key: string, windowMs = 15 * 60 * 1000) {
    this.recordAttempt(key, windowMs);
  }

  recordAttempt(key: string, windowMs = 15 * 60 * 1000) {
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return;
    }

    bucket.count += 1;
  }

  reset(key: string) {
    this.buckets.delete(key);
  }
}
