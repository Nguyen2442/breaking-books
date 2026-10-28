import { NextResponse } from 'next/server';
import { stopClaudeJob } from '@/lib/books';

export async function POST(_request, { params }) {
  const { jobId } = await params;
  const job = stopClaudeJob(jobId);
  if (!job) return NextResponse.json({ ok: false, error: 'Job not found' }, { status: 404 });
  return NextResponse.json({ ok: true, job });
}
