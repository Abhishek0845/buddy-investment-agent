const WINDOW_MS = 60000;
const MAX_REQUESTS = 10;

const rateLimitMap = new Map<string, number[]>();

export function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) || [];

  // Filter out timestamps older than WINDOW_MS
  const activeTimestamps = timestamps.filter((ts) => now - ts < WINDOW_MS);

  if (activeTimestamps.length >= MAX_REQUESTS) {
    return true;
  }

  activeTimestamps.push(now);
  rateLimitMap.set(ip, activeTimestamps);
  return false;
}
