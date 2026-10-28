import { NextResponse } from 'next/server';
import { getChangelogs } from '@/lib/portal';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const changelogs = await getChangelogs();
    return NextResponse.json({ ok: true, changelogs });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
