import { NextResponse } from 'next/server';
import { getFeedbacks, createFeedback, upvoteFeedback } from '@/lib/portal';
import { getCurrentUser } from '@/lib/user-auth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const category = url.searchParams.get('category') || 'all';
    const status = url.searchParams.get('status') || 'all';

    const feedbacks = await getFeedbacks({ category, status });
    return NextResponse.json({ ok: true, feedbacks });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'upvote') {
      const { feedbackId } = body;
      if (!feedbackId) {
        return NextResponse.json({ ok: false, error: 'Thiếu feedbackId' }, { status: 400 });
      }
      const res = await upvoteFeedback(feedbackId);
      return NextResponse.json(res);
    }

    // Default action: create feedback
    const currentUser = await getCurrentUser();
    const newFeedback = await createFeedback({
      title: body.title,
      description: body.description,
      category: body.category || 'feature',
      authorName: currentUser?.name || body.authorName || 'Thành viên ẩn danh',
      authorEmail: currentUser?.email || body.authorEmail || '',
      userId: currentUser?.id || null,
    });

    return NextResponse.json({ ok: true, feedback: newFeedback });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
  }
}
