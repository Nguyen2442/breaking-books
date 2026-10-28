import { NextResponse } from 'next/server';
import { startClaudeJob } from '@/lib/books';

export async function POST(request) {
  try {
    const body = await request.json();
    const job = startClaudeJob(body);
    return NextResponse.json({ ok: true, job });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
  }
}
