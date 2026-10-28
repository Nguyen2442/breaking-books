import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getGeminiApiKeys, callGemini } from '@/lib/gemini';
import { getSweeperState, setSweeperEnabled, getSystemErrorLogs, clearSystemErrorLogs } from '@/lib/books';

export const dynamic = 'force-dynamic';

async function checkAdminAuth() {
  const cookieStore = await cookies();
  const session = cookieStore.get('bb_admin_session');
  return session?.value === 'authenticated_admin_ok';
}

export async function GET() {
  const isAuth = await checkAdminAuth();
  if (!isAuth) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const rawKeys = getGeminiApiKeys();
  const keys = rawKeys.map((k, i) => ({
    index: i + 1,
    masked: `${k.slice(0, 7)}...${k.slice(-4)}`,
    length: k.length,
    active: true,
  }));

  const mem = process.memoryUsage();
  const system = {
    nodeVersion: process.version,
    platform: process.platform,
    uptimeSeconds: Math.floor(process.uptime()),
    memory: {
      rssMb: Math.round(mem.rss / 1024 / 1024),
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
    },
    pid: process.pid,
  };

  const sweeper = getSweeperState();
  const errors = getSystemErrorLogs();

  return NextResponse.json({
    ok: true,
    keys,
    system,
    sweeper,
    errors,
  });
}

export async function POST(req) {
  const isAuth = await checkAdminAuth();
  if (!isAuth) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'ping-key') {
      const { keyIndex } = body;
      const keys = getGeminiApiKeys();
      const targetKey = keys[keyIndex - 1];
      if (!targetKey) {
        return NextResponse.json({ ok: false, error: `Key index ${keyIndex} không tồn tại` }, { status: 400 });
      }

      const start = Date.now();
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${targetKey}`;
      const payload = {
        contents: [{ parts: [{ text: 'Ping. Chỉ trả về một từ PONG.' }] }],
        generationConfig: { maxOutputTokens: 10, temperature: 0.1 },
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const latencyMs = Date.now() - start;
      const data = await res.json();

      if (!res.ok) {
        return NextResponse.json({
          ok: false,
          status: res.status,
          latencyMs,
          error: data.error?.message || `HTTP ${res.status}`,
        });
      }

      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'OK';
      return NextResponse.json({
        ok: true,
        status: res.status,
        latencyMs,
        reply,
      });
    }

    if (action === 'test-prompt') {
      const { prompt, model } = body;
      if (!prompt) return NextResponse.json({ ok: false, error: 'Thiếu prompt' }, { status: 400 });

      const start = Date.now();
      const reply = await callGemini({
        prompt,
        model: model || 'gemini-3.5-flash',
        temperature: 0.2,
      });
      const latencyMs = Date.now() - start;

      return NextResponse.json({
        ok: true,
        reply,
        latencyMs,
      });
    }

    if (action === 'toggle-sweeper') {
      const { enabled } = body;
      const state = setSweeperEnabled(enabled);
      return NextResponse.json({ ok: true, sweeper: state });
    }

    if (action === 'clear-errors') {
      clearSystemErrorLogs();
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: 'Hành động không hợp lệ' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
