import crypto from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { cookies } from 'next/headers';
import { getUserById } from './users.js';

export const USER_COOKIE = 'bb_user_session';
export const USER_SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days in seconds

function getSecret() {
  if (process.env.ADMIN_SESSION_SECRET) return process.env.ADMIN_SESSION_SECRET;
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const g = globalThis;
  if (g.__bbUserSecret) return g.__bbUserSecret;

  const secretPath = join(process.cwd(), 'data', '.session_secret');
  try {
    if (existsSync(secretPath)) {
      const s = readFileSync(secretPath, 'utf8').trim();
      if (s) {
        g.__bbUserSecret = s;
        return s;
      }
    }
    mkdirSync(join(process.cwd(), 'data'), { recursive: true });
    const newSecret = crypto.randomBytes(32).toString('hex');
    writeFileSync(secretPath, newSecret, 'utf8');
    g.__bbUserSecret = newSecret;
    return newSecret;
  } catch {
    const fallback = 'breaking-books-persistent-session-secret-2026-auth';
    g.__bbUserSecret = fallback;
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

export function createUserSessionToken(user) {
  const exp = Date.now() + USER_SESSION_MAX_AGE * 1000;
  const rawPayload = JSON.stringify({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role || 'user',
    exp,
  });
  const b64Payload = Buffer.from(rawPayload).toString('base64url');
  const signature = sign(b64Payload);
  return `${b64Payload}.${signature}`;
}

export function verifyUserSessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [b64Payload, signature] = parts;
  if (!safeEqual(signature, sign(b64Payload))) return null;

  try {
    const raw = Buffer.from(b64Payload, 'base64url').toString('utf8');
    const data = JSON.parse(raw);
    if (!data.exp || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(USER_COOKIE)?.value;
    if (!token) return null;
    const session = verifyUserSessionToken(token);
    if (!session) return null;
    // Check if user is still active in database/store
    const fullUser = await getUserById(session.id);
    if (!fullUser || fullUser.isActive === false) return null;
    const { password: _, ...safeUser } = fullUser;
    return safeUser;
  } catch {
    return null;
  }
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Yêu cầu đăng nhập để thực hiện hành động này.');
  }
  return user;
}
