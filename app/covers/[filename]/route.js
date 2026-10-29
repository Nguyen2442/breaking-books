import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { NextResponse } from 'next/server';
import { generateSvgCover } from '@/lib/covers';

export const dynamic = 'force-dynamic';

const MIME_MAP = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  svg: 'image/svg+xml',
};

export async function GET(request, { params }) {
  const { filename } = await params;
  if (!filename || filename.includes('..') || filename.includes('/')) {
    return new NextResponse('Invalid filename', { status: 400 });
  }

  const root = process.cwd();
  const ext = (filename.split('.').pop() || 'jpg').toLowerCase();
  const slug = filename.replace(/\.[^/.]+$/, '');

  // 1. Check storage/covers/
  const storagePath = join(root, 'storage', 'covers', filename);
  if (existsSync(storagePath)) {
    const buffer = readFileSync(storagePath);
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': MIME_MAP[ext] || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'Content-Length': buffer.length.toString(),
      },
    });
  }

  // 2. Check public/covers/
  const publicPath = join(root, 'public', 'covers', filename);
  if (existsSync(publicPath)) {
    const buffer = readFileSync(publicPath);
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': MIME_MAP[ext] || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'Content-Length': buffer.length.toString(),
      },
    });
  }

  // 3. Fallback: check if alternate format exists
  const altJpg = join(root, 'storage', 'covers', `${slug}.jpg`);
  if (existsSync(altJpg)) {
    const buffer = readFileSync(altJpg);
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'Content-Length': buffer.length.toString(),
      },
    });
  }

  const altSvg = join(root, 'storage', 'covers', `${slug}.svg`);
  if (existsSync(altSvg)) {
    const buffer = readFileSync(altSvg);
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'Content-Length': buffer.length.toString(),
      },
    });
  }

  // 4. Procedural fallback: generate dynamic SVG on the fly so image NEVER breaks
  const title = slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const svgContent = generateSvgCover({ title, author: 'Breaking Books' });
  const svgBuffer = Buffer.from(svgContent, 'utf8');

  return new NextResponse(svgBuffer, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      'Content-Length': svgBuffer.length.toString(),
    },
  });
}
