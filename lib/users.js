import crypto from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { isDbAvailable, getPrisma, stripNullBytes } from './db.js';

const USERS_FILE = join(process.cwd(), 'books', '.users.json');

// High-performance in-memory cache to eliminate disk I/O latency on page switches
let cachedUsers = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 30000; // 30 seconds
let isSeeded = false;

function ensureUsersDir() {
  const dir = join(process.cwd(), 'books');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function hashPassword(plainText) {
  if (!plainText || typeof plainText !== 'string') {
    throw new Error('Mật khẩu không được để trống.');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(plainText, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(plainText, storedHash) {
  if (!plainText || !storedHash || typeof storedHash !== 'string') return false;
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHash] = parts;
  try {
    const testHash = crypto.scryptSync(plainText, salt, 64).toString('hex');
    const a = Buffer.from(expectedHash, 'hex');
    const b = Buffer.from(testHash, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function readFileUsers() {
  const now = Date.now();
  if (cachedUsers && now - lastCacheTime < CACHE_TTL_MS) {
    return cachedUsers;
  }
  ensureUsersDir();
  if (!existsSync(USERS_FILE)) {
    cachedUsers = [];
    lastCacheTime = now;
    return [];
  }
  try {
    const raw = readFileSync(USERS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    cachedUsers = Array.isArray(parsed) ? parsed : [];
    lastCacheTime = now;
    return cachedUsers;
  } catch {
    return [];
  }
}

function writeFileUsers(users) {
  ensureUsersDir();
  cachedUsers = users;
  lastCacheTime = Date.now();
  writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

/**
 * Seeds initial demo/admin users if none exist (fast single-shot check)
 */
async function seedDefaultUsersIfEmpty() {
  if (isSeeded) return;
  const fileUsers = readFileUsers();
  if (fileUsers.length === 0) {
    const defaultUsers = [
      {
        id: 'user_admin_01',
        email: 'admin@breakingbooks.com',
        name: 'Quản trị viên Hệ thống',
        password: hashPassword('admin123'),
        role: 'admin',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'user_demo_02',
        email: 'demo@breakingbooks.com',
        name: 'Học viên Demo',
        password: hashPassword('demo123'),
        role: 'user',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    writeFileUsers(defaultUsers);

    if (isDbAvailable()) {
      const prisma = getPrisma();
      if (prisma) {
        for (const u of defaultUsers) {
          await prisma.user.upsert({
            where: { email: u.email },
            update: {},
            create: {
              id: u.id,
              email: u.email,
              name: u.name,
              password: u.password,
              role: u.role,
              isActive: u.isActive,
            },
          }).catch(() => {});
        }
      }
    }
  }
  isSeeded = true;
}

export async function getAllUsers() {
  await seedDefaultUsersIfEmpty();

  if (isDbAvailable()) {
    try {
      const prisma = getPrisma();
      if (prisma) {
        const users = await prisma.user.findMany({
          orderBy: { createdAt: 'desc' },
          include: {
            _count: {
              select: { books: true },
            },
          },
        });
        return users.map((u) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          isActive: u.isActive,
          createdAt: u.createdAt.toISOString(),
          updatedAt: u.updatedAt.toISOString(),
          bookCount: u._count?.books || 0,
        }));
      }
    } catch (e) {
      console.warn('[getAllUsers] DB fetch error, falling back to file:', e.message);
    }
  }

  const list = readFileUsers();
  return list.map(({ password, ...rest }) => rest);
}

export async function getUserById(id) {
  if (!id) return null;
  await seedDefaultUsersIfEmpty();

  if (isDbAvailable()) {
    try {
      const prisma = getPrisma();
      if (prisma) {
        const user = await prisma.user.findUnique({ where: { id } });
        if (user) return user;
      }
    } catch {}
  }

  const users = readFileUsers();
  return users.find((u) => u.id === id) || null;
}

export async function getUserByEmail(emailOrUsername) {
  if (!emailOrUsername) return null;
  const cleanInput = emailOrUsername.trim().toLowerCase();
  await seedDefaultUsersIfEmpty();

  if (isDbAvailable()) {
    try {
      const prisma = getPrisma();
      if (prisma) {
        let user = await prisma.user.findUnique({ where: { email: cleanInput } });
        if (!user && !cleanInput.includes('@')) {
          user = await prisma.user.findFirst({
            where: {
              email: { startsWith: `${cleanInput}@` },
            },
          });
        }
        if (user) return user;
      }
    } catch {}
  }

  const users = readFileUsers();
  return (
    users.find(
      (u) =>
        u.email.toLowerCase() === cleanInput ||
        u.email.split('@')[0].toLowerCase() === cleanInput
    ) || null
  );
}

export async function registerUser({ email, password, name }) {
  if (!email || !email.includes('@')) {
    throw new Error('Email không hợp lệ.');
  }
  if (!password || password.length < 6) {
    throw new Error('Mật khẩu phải có tối thiểu 6 ký tự.');
  }
  if (!name || !name.trim()) {
    throw new Error('Họ và tên không được để trống.');
  }

  const cleanEmail = email.trim().toLowerCase();
  const existing = await getUserByEmail(cleanEmail);
  if (existing) {
    throw new Error('Email này đã được đăng ký. Vui lòng chọn đăng nhập hoặc dùng email khác.');
  }

  const userId = `usr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const hashedPassword = hashPassword(password);
  const now = new Date().toISOString();

  const newUser = {
    id: userId,
    email: cleanEmail,
    name: name.trim(),
    password: hashedPassword,
    role: 'user',
    isActive: true,
    createdAt: now,
    updatedAt: now,
    bookCount: 0,
  };

  // 1. Save to File
  const users = readFileUsers();
  users.unshift(newUser);
  writeFileUsers(users);

  // 2. Save to DB if available
  if (isDbAvailable()) {
    try {
      const prisma = getPrisma();
      if (prisma) {
        await prisma.user.create({
          data: {
            id: newUser.id,
            email: newUser.email,
            name: newUser.name,
            password: newUser.password,
            role: newUser.role,
            isActive: newUser.isActive,
          },
        });
      }
    } catch (e) {
      console.warn('[registerUser] DB save error:', e.message);
    }
  }

  const { password: _, ...safeUser } = newUser;
  return safeUser;
}

export async function authenticateUser(emailOrUsername, plainPassword) {
  if (!emailOrUsername || !plainPassword) return null;
  const user = await getUserByEmail(emailOrUsername);
  if (!user) return null;
  if (user.isActive === false) {
    throw new Error('Tài khoản của bạn đã bị tạm khóa. Vui lòng liên hệ quản trị viên.');
  }
  const isMatch = verifyPassword(plainPassword, user.password);
  if (!isMatch) return null;

  const { password: _, ...safeUser } = user;
  return safeUser;
}

export async function toggleUserStatus(userId) {
  const users = readFileUsers();
  const idx = users.findIndex((u) => u.id === userId);
  let updatedState = true;

  if (idx !== -1) {
    users[idx].isActive = !users[idx].isActive;
    users[idx].updatedAt = new Date().toISOString();
    updatedState = users[idx].isActive;
    writeFileUsers(users);
  }

  if (isDbAvailable()) {
    try {
      const prisma = getPrisma();
      if (prisma) {
        const u = await prisma.user.findUnique({ where: { id: userId } });
        if (u) {
          const res = await prisma.user.update({
            where: { id: userId },
            data: { isActive: !u.isActive },
          });
          updatedState = res.isActive;
        }
      }
    } catch (e) {
      console.warn('[toggleUserStatus] DB update error:', e.message);
    }
  }

  return { ok: true, userId, isActive: updatedState };
}

export async function resetUserPassword(userId, newPassword) {
  if (!newPassword || newPassword.length < 6) {
    throw new Error('Mật khẩu mới phải có tối thiểu 6 ký tự.');
  }
  const hashed = hashPassword(newPassword);
  const now = new Date().toISOString();

  const users = readFileUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx !== -1) {
    users[idx].password = hashed;
    users[idx].updatedAt = now;
    writeFileUsers(users);
  }

  if (isDbAvailable()) {
    try {
      const prisma = getPrisma();
      if (prisma) {
        await prisma.user.update({
          where: { id: userId },
          data: { password: hashed },
        });
      }
    } catch (e) {
      console.warn('[resetUserPassword] DB update error:', e.message);
    }
  }

  return { ok: true };
}

export async function deleteUserAccount(userId) {
  const users = readFileUsers();
  const filtered = users.filter((u) => u.id !== userId);
  writeFileUsers(filtered);

  if (isDbAvailable()) {
    try {
      const prisma = getPrisma();
      if (prisma) {
        await prisma.user.delete({ where: { id: userId } }).catch(() => {});
      }
    } catch (e) {
      console.warn('[deleteUserAccount] DB delete error:', e.message);
    }
  }

  return { ok: true };
}
