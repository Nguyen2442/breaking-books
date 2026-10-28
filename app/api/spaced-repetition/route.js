import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.AURAMIND_BACKEND_URL || 'http://localhost:4000';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId') || 'guest-user';
  const action = searchParams.get('action') || 'due'; // 'due' | 'stats'

  try {
    const endpoint = action === 'stats' ? `/spaced-repetition/stats` : `/spaced-repetition/due`;
    const res = await fetch(`${BACKEND_URL}${endpoint}?userId=${userId}`, {
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(3000),
    });

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({ ok: true, data });
    }
  } catch {}

  // Fallback data
  if (action === 'stats') {
    return NextResponse.json({
      ok: true,
      data: {
        userId,
        totalCards: 18,
        dueToday: 4,
        masteredCards: 12,
        retentionScore: '86%',
        status: 'Excellent Long-term Retention',
      },
    });
  }

  return NextResponse.json({
    ok: true,
    data: {
      userId,
      totalDueToday: 3,
      cardsInBatch: 3,
      cards: [
        {
          id: 'card-1',
          question: 'Fault khác Failure ở điểm cốt lõi nào trong hệ thống phân tán?',
          answer: 'Fault là một thành phần riêng lẻ gặp sự cố; Failure là khi toàn bộ hệ thống ngừng phục vụ người dùng. Mục tiêu thiết kế là Fault-tolerance: ngăn ngừa Fault biến thành Failure.',
          tip: 'Fault là mầm mống, Failure là thảm họa.',
          chapterNumber: 1,
          chapterTitle: 'Reliability & Scalability',
          bookTitle: 'Designing Data-Intensive Applications',
          author: 'Martin Kleppmann',
          repetitions: 1,
          interval: 3,
          easeFactor: 2.5,
        },
        {
          id: 'card-2',
          question: 'Tại sao Sam Newman khuyến nghị Choreography hơn Orchestration trong Saga Pattern?',
          answer: 'Choreography phân tán quyền quyết định cho từng service phản ứng với sự kiện, tránh được hiện tượng "God Service" (điểm nghẽn tập trung và ghép nối chặt).',
          tip: 'Choreography = Vũ điệu tự do; Orchestration = Nhạc trưởng độc đoán.',
          chapterNumber: 4,
          chapterTitle: 'Integration',
          bookTitle: 'Building Microservices',
          author: 'Sam Newman',
          repetitions: 2,
          interval: 7,
          easeFactor: 2.6,
        },
        {
          id: 'card-3',
          question: 'Read-After-Write Consistency giải quyết hiện tượng gì?',
          answer: 'Ngăn chặn hiện tượng người dùng vừa cập nhật thông tin nhưng khi reload trang lại thấy dữ liệu cũ do replication lag giữa Leader và Follower.',
          tip: 'Đọc dữ liệu của chính mình luôn đọc từ Leader.',
          chapterNumber: 5,
          chapterTitle: 'Replication',
          bookTitle: 'Designing Data-Intensive Applications',
          author: 'Martin Kleppmann',
          repetitions: 0,
          interval: 1,
          easeFactor: 2.5,
        },
      ],
    },
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { cardId, quality, userId = 'guest-user' } = body;

    try {
      const res = await fetch(`${BACKEND_URL}/spaced-repetition/review?userId=${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId, quality }),
        signal: AbortSignal.timeout(3000),
      });

      if (res.ok) {
        const data = await res.json();
        return NextResponse.json({ ok: true, data });
      }
    } catch {}

    // Calculation fallback
    const nextIntervalDays = quality >= 3 ? 7 : 1;
    return NextResponse.json({
      ok: true,
      data: {
        cardId,
        qualityScore: quality,
        reviewStatus: quality >= 3 ? 'REVIEWING' : 'RELEARNING',
        nextIntervalDays,
        message: quality >= 3 ? `Xuất sắc! Sẽ ôn lại sau ${nextIntervalDays} ngày.` : `Đã chuyển về ôn lại ngày mai.`,
      },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

