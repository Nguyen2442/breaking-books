import { NextResponse } from 'next/server';
import { detectAiEngine, detectClaudeCli, listPdfFiles, listAllBooksAsync, listUnprocessedPdfs, getJobsList } from '@/lib/books';
import { getCurrentUser } from '@/lib/user-auth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const currentUser = await getCurrentUser();
  const url = new URL(request.url);
  const showAll = url.searchParams.get('all') === '1' && currentUser?.role === 'admin';

  const books = await listAllBooksAsync({
    userId: currentUser ? currentUser.id : null,
    isAdmin: showAll || currentUser?.role === 'admin',
  });
  const ai = detectAiEngine();

  return NextResponse.json(
    {
      ok: true,
      user: currentUser || null,
      ai,
      claude: ai, // backwards compatibility
      pdfs: listPdfFiles(),
      unprocessedPdfs: listUnprocessedPdfs(books),
      books,
      jobs: getJobsList(),
    },
    {
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
      },
    }
  );
}
