import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.AURAMIND_BACKEND_URL || 'http://localhost:4000';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId') || 'guest-user';
  const action = searchParams.get('action') || 'items'; // 'items' | 'metrics'

  try {
    const endpoint = action === 'metrics' ? `/action-engine/metrics` : `/action-engine/items`;
    const res = await fetch(`${BACKEND_URL}${endpoint}?userId=${userId}`, {
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(3000),
    });

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({ ok: true, data });
    }
  } catch {}

  if (action === 'metrics') {
    return NextResponse.json({
      ok: true,
      data: {
        userId,
        totalTasks: 5,
        completed: 3,
        inProgress: 1,
        pending: 1,
        executionRate: '60%',
        habitLevel: 'Active Practitioner (Người hành động tích cực)',
      },
    });
  }

  return NextResponse.json({
    ok: true,
    data: {
      userId,
      totalCount: 3,
      actions: [
        {
          id: 'action-1',
          stepNumber: 1,
          action: 'Thiết lập Circuit Breaker cho mọi lời gọi mạng ra ngoài hệ thống',
          practicalTips: 'Sử dụng timeout tối đa 2.5s và kích hoạt fallback sau 5 lần lỗi liên tiếp.',
          status: 'COMPLETED',
          dueDate: new Date(Date.now() + 86400000 * 2).toISOString(),
          reflectionNotes: 'Đã triển khai Resilience4j vào service Order, ngăn ngừa sự cố sập dây chuyền.',
          chapterTitle: 'Reliability & Fault-Tolerance',
          bookTitle: 'Designing Data-Intensive Applications',
          author: 'Martin Kleppmann',
        },
        {
          id: 'action-2',
          stepNumber: 2,
          action: 'Chuyển đổi giao tiếp đồng bộ (REST) sang bất đồng bộ qua Transactional Outbox',
          practicalTips: 'Dùng bảng outbox trong cùng database transaction rồi cho worker de-queue vào Kafka.',
          status: 'IN_PROGRESS',
          dueDate: new Date(Date.now() + 86400000 * 5).toISOString(),
          reflectionNotes: 'Đang thiết lập Debezium CDC để capture events.',
          chapterTitle: 'Integration & Saga',
          bookTitle: 'Building Microservices',
          author: 'Sam Newman',
        },
        {
          id: 'action-3',
          stepNumber: 3,
          action: 'Thiết lập Read-After-Write Consistency cho trang cá nhân người dùng',
          practicalTips: 'Route truy vấn đọc thông tin của chính user vừa sửa về DB Primary trong vòng 60 giây.',
          status: 'PENDING',
          dueDate: new Date(Date.now() + 86400000 * 7).toISOString(),
          reflectionNotes: null,
          chapterTitle: 'Replication Lag Mitigation',
          bookTitle: 'Designing Data-Intensive Applications',
          author: 'Martin Kleppmann',
        },
      ],
    },
  });
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const { actionId, status, reflectionNotes, userId = 'guest-user' } = body;

    try {
      const res = await fetch(`${BACKEND_URL}/action-engine/items/${actionId}?userId=${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reflectionNotes }),
        signal: AbortSignal.timeout(3000),
      });

      if (res.ok) {
        const data = await res.json();
        return NextResponse.json({ ok: true, data });
      }
    } catch {}

    return NextResponse.json({
      ok: true,
      data: {
        id: actionId,
        status,
        reflectionNotes,
        message: status === 'COMPLETED' ? 'Chúc mừng bạn đã biến sách thành hành động!' : 'Đã cập nhật trạng thái.',
      },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

