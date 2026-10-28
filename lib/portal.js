import crypto from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { isDbAvailable, getPrisma, stripNullBytes } from './db.js';

const CHANGELOG_FILE = join(process.cwd(), 'books', '.changelogs.json');
const FEEDBACK_FILE = join(process.cwd(), 'books', '.feedbacks.json');

function ensureDir() {
  const dir = join(process.cwd(), 'books');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function readFile(filePath, fallback = []) {
  ensureDir();
  if (!existsSync(filePath)) return fallback;
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) || fallback;
  } catch {
    return fallback;
  }
}

function writeFile(filePath, data) {
  ensureDir();
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// -----------------------------------------------------------------------------
// CHANGELOGS
// -----------------------------------------------------------------------------
const DEFAULT_CHANGELOGS = [
  {
    id: 'chg_v2_2_0',
    version: 'v2.2.0',
    title: 'Mở rộng đối tượng người dùng, Phân quyền Cá nhân & Quản trị Thành viên',
    badge: 'Mới nhất',
    releaseDate: '2026-10-28T18:00:00.000Z',
    description: 'Chuyển đổi Breaking Books thành nền tảng mở cho tất cả mọi người (học sinh, sinh viên, người đi làm và người yêu sách ở mọi lĩnh vực).',
    changes: [
      'Trang chủ mới giới thiệu trực quan, phòng Lab tương tác ngay trên landing page',
      'Hệ thống đăng ký & đăng nhập tài khoản cá nhân với mã hoá mật khẩu scrypt',
      'Phân quyền riêng tư: mỗi người dùng sở hữu không gian sách riêng',
      'Tab Quản lý người dùng cho Quản trị viên (/admin) với tính năng khóa/mở khóa & đổi mật khẩu',
      'Trang Giới thiệu (About Us), Tính năng cốt lõi, Nhật ký thay đổi & Góp ý tính năng'
    ]
  },
  {
    id: 'chg_v2_1_0',
    version: 'v2.1.0',
    title: 'Cross-Book RAG, Ôn tập Lặp lại Ngắt quãng (SM-2) & Action Engine',
    badge: 'Tính năng lớn',
    releaseDate: '2026-10-25T14:00:00.000Z',
    description: 'Bổ sung động cơ tri thức liên sách và hệ thống biến kiến thức thành thói quen hành động.',
    changes: [
      'Cross-Book RAG: Hỏi đáp tổng hợp so sánh luận điểm giữa nhiều cuốn sách',
      'Thuật toán Spaced Repetition (SuperMemo SM-2) xếp lịch ôn tập thẻ ghi nhớ tối ưu',
      'Action Habit Tracker: Kế hoạch thực thi 7 ngày giúp áp dụng kiến thức vào thực tế',
      'Giao diện Dark/Light mode tối giản, tinh tế'
    ]
  },
  {
    id: 'chg_v2_0_0',
    version: 'v2.0.0',
    title: 'Tích hợp Hệ thống AI Engine Tốc độ cao & Phòng Visual Lab Tương tác',
    badge: 'Đột phá',
    releaseDate: '2026-10-20T10:00:00.000Z',
    description: 'Tái thiết kế toàn bộ trải nghiệm đọc sách thành các phòng thí nghiệm trực quan.',
    changes: [
      'Bóc tách tự động tài liệu PDF thành các topic 5-10 phút bằng Trí tuệ Nhân tạo (AI)',
      'Hơn 100+ sơ đồ tương tác (Interactive Simulation) thao tác trực tiếp',
      'Bộ câu hỏi trắc nghiệm kiểm tra tư duy sâu cuối mỗi chương',
      'Xuất Anki TSV Flashcards deck chỉ với 1 cú click'
    ]
  },
  {
    id: 'chg_v1_0_0',
    version: 'v1.0.0',
    title: 'Khởi chạy Nền tảng Đọc sách Thông minh Breaking Books',
    badge: 'Ra mắt',
    releaseDate: '2026-10-01T08:00:00.000Z',
    description: 'Phiên bản đầu tiên hiện thực hóa ý tưởng "đọc sách không thụ động".',
    changes: [
      'Hỗ trợ 3 bộ sách kinh điển: Designing Data-Intensive Applications, Building Microservices, Head First JavaScript',
      'Tóm tắt cốt lõi, thuật ngữ Anh-Việt chuẩn xác',
      'Giao diện đọc sách hiện đại phong cách Mintlify & Stripe Docs'
    ]
  }
];

export async function getChangelogs() {
  const fileChangelogs = readFile(CHANGELOG_FILE);
  if (fileChangelogs.length === 0) {
    writeFile(CHANGELOG_FILE, DEFAULT_CHANGELOGS);
  }

  if (isDbAvailable()) {
    try {
      const prisma = getPrisma();
      if (prisma) {
        // Seed to DB if empty
        const count = await prisma.changelog.count();
        if (count === 0) {
          for (const item of DEFAULT_CHANGELOGS) {
            await prisma.changelog.create({
              data: {
                id: item.id,
                version: item.version,
                title: item.title,
                description: item.description,
                badge: item.badge,
                changes: item.changes,
                releaseDate: new Date(item.releaseDate),
              }
            }).catch(() => {});
          }
        }
        const dbList = await prisma.changelog.findMany({
          orderBy: { releaseDate: 'desc' }
        });
        if (dbList.length > 0) return dbList;
      }
    } catch (e) {
      console.warn('[getChangelogs] DB error, using file:', e.message);
    }
  }

  return readFile(CHANGELOG_FILE, DEFAULT_CHANGELOGS);
}

// -----------------------------------------------------------------------------
// FEEDBACKS & FEATURE REQUESTS
// -----------------------------------------------------------------------------
const DEFAULT_FEEDBACKS = [
  {
    id: 'fb_01',
    title: 'Tích hợp Text-to-Speech (Đọc sách bằng giọng AI tự nhiên)',
    description: 'Mong muốn có nút nghe bài học để có thể vừa đi dạo hoặc lái xe vừa nghe AI tóm tắt các chương sách.',
    category: 'feature',
    status: 'IN_PROGRESS',
    upvotes: 42,
    authorName: 'Minh Tuấn',
    authorEmail: 'tuan@example.com',
    createdAt: '2026-10-26T09:00:00.000Z',
  },
  {
    id: 'fb_02',
    title: 'Chế độ Focus Mode toàn màn hình không xao nhãng',
    description: 'Thêm nút ẩn toàn bộ sidebar mục lục để tập trung 100% vào nội dung bài đọc và sơ đồ tương tác.',
    category: 'improvement',
    status: 'PLANNED',
    upvotes: 28,
    authorName: 'Hoàng Anh',
    authorEmail: 'hoanganh@example.com',
    createdAt: '2026-10-25T15:30:00.000Z',
  },
  {
    id: 'fb_03',
    title: 'Bổ sung thêm dòng sách Tâm lý học, Kinh tế học & Kỹ năng sống',
    description: 'Rất thích cách trình bày sơ đồ tương tác này. Mong nền tảng mở rộng thêm các sách như Tư duy nhanh và chậm, Tâm lý học về tiền, Đắc Nhân Tâm.',
    category: 'content',
    status: 'COMPLETED',
    upvotes: 35,
    authorName: 'Thu Trang',
    authorEmail: 'thutrang@example.com',
    createdAt: '2026-10-24T11:20:00.000Z',
  },
  {
    id: 'fb_04',
    title: 'Xuất ghi chú cá nhân và câu hỏi quiz sang Notion & Obsidian',
    description: 'Tính năng đồng bộ 1-click các điểm cốt lõi và flashcards về second brain trên Notion.',
    category: 'feature',
    status: 'PLANNED',
    upvotes: 19,
    authorName: 'Quốc Bảo',
    authorEmail: 'bao@example.com',
    createdAt: '2026-10-27T08:15:00.000Z',
  }
];

export async function getFeedbacks({ category = 'all', status = 'all' } = {}) {
  const fileFeedbacks = readFile(FEEDBACK_FILE);
  if (fileFeedbacks.length === 0) {
    writeFile(FEEDBACK_FILE, DEFAULT_FEEDBACKS);
  }

  let list = fileFeedbacks.length > 0 ? fileFeedbacks : DEFAULT_FEEDBACKS;

  if (isDbAvailable()) {
    try {
      const prisma = getPrisma();
      if (prisma) {
        const count = await prisma.feedback.count();
        if (count === 0) {
          for (const item of DEFAULT_FEEDBACKS) {
            await prisma.feedback.create({
              data: {
                id: item.id,
                title: item.title,
                description: item.description,
                category: item.category,
                status: item.status,
                upvotes: item.upvotes,
                authorName: item.authorName,
                authorEmail: item.authorEmail,
                createdAt: new Date(item.createdAt),
              }
            }).catch(() => {});
          }
        }
        const where = {};
        if (category && category !== 'all') where.category = category;
        if (status && status !== 'all') where.status = status;
        const dbList = await prisma.feedback.findMany({
          where,
          orderBy: [{ upvotes: 'desc' }, { createdAt: 'desc' }],
        });
        if (dbList.length > 0) return dbList;
      }
    } catch (e) {
      console.warn('[getFeedbacks] DB error, using file:', e.message);
    }
  }

  // Filter in-memory for file fallback
  if (category && category !== 'all') {
    list = list.filter((f) => f.category === category);
  }
  if (status && status !== 'all') {
    list = list.filter((f) => f.status === status);
  }
  return [...list].sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));
}

export async function createFeedback({ title, description, category = 'feature', authorName = 'Ẩn danh', authorEmail = '', userId = null }) {
  if (!title || !description) {
    throw new Error('Vui lòng nhập tiêu đề và nội dung góp ý.');
  }

  const id = `fb_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const now = new Date().toISOString();

  const newFeedback = {
    id,
    title: title.trim(),
    description: description.trim(),
    category,
    status: 'PENDING',
    upvotes: 1, // Author automatically gives 1 upvote
    authorName: authorName.trim() || 'Thành viên',
    authorEmail: authorEmail.trim(),
    userId,
    createdAt: now,
    updatedAt: now,
  };

  const feedbacks = readFile(FEEDBACK_FILE, DEFAULT_FEEDBACKS);
  feedbacks.unshift(newFeedback);
  writeFile(FEEDBACK_FILE, feedbacks);

  if (isDbAvailable()) {
    try {
      const prisma = getPrisma();
      if (prisma) {
        await prisma.feedback.create({
          data: {
            id: newFeedback.id,
            title: newFeedback.title,
            description: newFeedback.description,
            category: newFeedback.category,
            status: newFeedback.status,
            upvotes: newFeedback.upvotes,
            authorName: newFeedback.authorName,
            authorEmail: newFeedback.authorEmail,
            userId: newFeedback.userId,
          }
        });
      }
    } catch (e) {
      console.warn('[createFeedback] DB error:', e.message);
    }
  }

  return newFeedback;
}

export async function upvoteFeedback(feedbackId) {
  const feedbacks = readFile(FEEDBACK_FILE, DEFAULT_FEEDBACKS);
  const item = feedbacks.find((f) => f.id === feedbackId);
  let updatedCount = 0;
  if (item) {
    item.upvotes = (item.upvotes || 0) + 1;
    updatedCount = item.upvotes;
    writeFile(FEEDBACK_FILE, feedbacks);
  }

  if (isDbAvailable()) {
    try {
      const prisma = getPrisma();
      if (prisma) {
        const updated = await prisma.feedback.update({
          where: { id: feedbackId },
          data: { upvotes: { increment: 1 } },
        });
        updatedCount = updated.upvotes;
      }
    } catch (e) {
      console.warn('[upvoteFeedback] DB error:', e.message);
    }
  }

  return { ok: true, feedbackId, upvotes: updatedCount };
}
