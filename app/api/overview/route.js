import { NextResponse } from 'next/server';
import { detectAiEngine, detectClaudeCli, listPdfFiles, listAllBooksAsync, listUnprocessedPdfs, getJobsList } from '@/lib/books';

export const dynamic = 'force-dynamic';

export async function GET() {
  const books = await listAllBooksAsync();
  const ai = detectAiEngine();
  return NextResponse.json({
    ok: true,
    ai,
    claude: ai, // backwards compatibility
    pdfs: listPdfFiles(),
    unprocessedPdfs: listUnprocessedPdfs(books),
    books,
    jobs: getJobsList(),
  });
}
