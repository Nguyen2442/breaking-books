import { NextResponse } from 'next/server';
import { detectAiEngine, detectClaudeCli, listPdfFiles, listAllBooks, listUnprocessedPdfs, getJobsList } from '@/lib/books';

export const dynamic = 'force-dynamic';

export async function GET() {
  const books = listAllBooks();
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
