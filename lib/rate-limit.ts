type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function check(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= max) return false;
  bucket.count += 1;
  return true;
}

export function reset(key: string): void {
  buckets.delete(key);
}
