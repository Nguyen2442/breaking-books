import crypto from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { cookies } from 'next/headers';

export const ADMIN_COOKIE = 'bb_admin_session';
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days (seconds)

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';

function getSecret() {
  if (process.env.ADMIN_SESSION_SECRET) return process.env.ADMIN_SESSION_SECRET;
  const g = globalThis;
  if (g.__bbAdminSecret) return g.__bbAdminSecret;

  const secretPath = join(process.cwd(), 'data', '.admin_secret');
  try {
    if (existsSync(secretPath)) {
      const s = readFileSync(secretPath, 'utf8').trim();
      if (s) {
        g.__bbAdminSecret = s;
        return s;
      }
    }
    mkdirSync(join(process.cwd(), 'data'), { recursive: true });
    const newSecret = crypto.randomBytes(32).toString('hex');
    writeFileSync(secretPath, newSecret, 'utf8');
    g.__bbAdminSecret = newSecret;
    return newSecret;
  } catch {
    const fallback = 'breaking-books-persistent-admin-secret-2026';
    g.__bbAdminSecret = fallback;
    return fallback;
  }
}

function sign(payload) {
  return crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export function verifyCredentials(username, password) {
  // Evaluate both comparisons to avoid leaking which field was wrong via timing
  const userOk = safeEqual(username ?? '', ADMIN_USER);
  const passOk = safeEqual(password ?? '', ADMIN_PASS);
  return userOk && passOk;
}

/** Token format: `<expiresAtMs>.<randomNonce>.<hmac>` */
export function createSessionToken() {
  const expiresAt = Date.now() + ADMIN_SESSION_MAX_AGE * 1000;
  const nonce = crypto.randomBytes(16).toString('base64url');
  const payload = `${expiresAt}.${nonce}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [expiresAt, nonce, signature] = parts;
  if (!safeEqual(signature, sign(`${expiresAt}.${nonce}`))) return false;
  const exp = Number(expiresAt);
  return Number.isFinite(exp) && exp > Date.now();
}

export async function isAdminAuthenticated() {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(ADMIN_COOKIE)?.value);
}
