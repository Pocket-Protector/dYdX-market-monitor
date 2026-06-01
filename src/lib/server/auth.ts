import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';

export const AUTH_COOKIE = 'auth';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

type AttemptRecord = { count: number; lockedUntil: number };
const attempts = new Map<string, AttemptRecord>();

function getSecret(): string {
  const secret = env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('SESSION_SECRET env var is missing or too short (need >= 16 chars)');
  }
  return secret;
}

function getPassword(): string {
  const pw = env.SITE_PASSWORD;
  if (!pw) throw new Error('SITE_PASSWORD env var is missing');
  return pw;
}

function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('hex');
}

export function createToken(): string {
  const issuedAt = Date.now().toString(36);
  const sig = sign(issuedAt);
  return `${issuedAt}.${sig}`;
}

export function verifyToken(token: string | undefined): boolean {
  if (!token) return false;
  const dot = token.indexOf('.');
  if (dot < 1) return false;
  const issuedAt = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(issuedAt);
  if (sig.length !== expected.length) return false;
  try {
    if (!timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) return false;
  } catch {
    return false;
  }
  const issuedMs = parseInt(issuedAt, 36);
  if (!Number.isFinite(issuedMs)) return false;
  const ageMs = Date.now() - issuedMs;
  return ageMs >= 0 && ageMs <= SESSION_MAX_AGE_SECONDS * 1000;
}

export function checkPassword(input: string): boolean {
  const expected = getPassword();
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number };

export function checkRateLimit(ip: string): RateLimitResult {
  const rec = attempts.get(ip);
  if (rec && rec.lockedUntil > Date.now()) {
    return { allowed: false, retryAfterMs: rec.lockedUntil - Date.now() };
  }
  return { allowed: true };
}

export function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || rec.lockedUntil <= now) {
    attempts.set(ip, { count: 1, lockedUntil: 0 });
    return;
  }
  rec.count += 1;
  if (rec.count >= MAX_ATTEMPTS) {
    rec.lockedUntil = now + LOCKOUT_MS;
    rec.count = 0;
  }
}

export function clearAttempts(ip: string): void {
  attempts.delete(ip);
}
