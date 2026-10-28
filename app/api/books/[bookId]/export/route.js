import { NextResponse } from 'next/server';
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, inspectBook, getAllGlossaryFromBook } from '@/lib/books';

function stripTags(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildStudyArtifacts(bookId) {
  const book = inspectBook(bookId);
  if (!book) throw new Error(`Không tìm thấy sách: ${bookId}`);
  const bookDir = join(ROOT, bookId);
  const distDir = join(bookDir, 'dist');
  mkdirSync(distDir, { recursive: true });

  // 1. Validate JS syntax for every chapter that has a .js file
  const syntaxErrors = [];
  for (const ch of book.chapters) {
    const jsPath = join(bookDir, 'src', `ch${ch.n}.js`);
    if (existsSync(jsPath)) {
      try {
        execFileSync('node', ['--check', jsPath], { encoding: 'utf8' });
      } catch (e) {
        syntaxErrors.push({ ch: ch.n, error: e.message });
      }
    }
  }

  // 2. Run build.mjs if present to generate standalone dist/index.html
  const buildScript = join(bookDir, 'build.mjs');
  let buildOutput = '';
  if (existsSync(buildScript)) {
    try {
      buildOutput = execFileSync('node', ['build.mjs'], {
        cwd: bookDir,
        encoding: 'utf8',
      }).trim();
    } catch (e) {
      buildOutput = `Warning: ${e.message}`;
    }
  }

  // 3. Build Anki TSV Flashcards deck (Front \t Back \t Tags)
  const glossary = getAllGlossaryFromBook(bookId);
  const ankiLines = [];
  for (const g of glossary) {
    const front = `${g.term}${g.vi ? ` (${g.vi})` : ''}`;
    const back = `${g.def} [Chương ${g.ch}]`;
    const tag = `${bookId}::ch${g.ch}`;
    ankiLines.push(
      `${front.replace(/\t|\n/g, ' ')}\t${back.replace(/\t|\n/g, ' ')}\t${tag}`
    );
  }
  const ankiPath = join(distDir, 'flashcards-anki.tsv');
  writeFileSync(ankiPath, ankiLines.join('\n'), 'utf8');

  // 4. Build Complete Markdown Study Guide (TL;DRs + Key Takeaways + Glossary)
  const mdLines = [
    `# ${book.title} — Study Guide & Active Recall Summary`,
    `> ${book.subtitle} · Tác giả: ${book.author}`,
    ``,
    `## Tổng quan`,
    `- **Số chương hoàn thành:** ${book.completeCount}/${book.totalChapters}`,
    `- **Tổng số chủ đề (Topics):** ${book.totalTopics}`,
    `- **Tổng số sơ đồ & Mini-Labs:** ${book.totalWidgets}`,
    `- **Tổng số câu hỏi Quiz:** ${book.totalQuizzes}`,
    `- **Tổng số thuật ngữ (Glossary):** ${glossary.length}`,
    ``,
  ];

  for (const ch of book.chapters) {
    mdLines.push(`---`);
    mdLines.push(`## Chương ${ch.n}: ${ch.title} (${ch.en})`);
    const htmlPath = join(bookDir, 'src', `ch${ch.n}.html`);
    if (existsSync(htmlPath)) {
      const html = readFileSync(htmlPath, 'utf8');
      const articles = html.split(/<article\s+class="topic"/g).slice(1);
      for (const raw of articles) {
        const block = '<article class="topic"' + raw;
        const num = block.match(/data-num="([^"]*)"/)?.[1] || '';
        const short = block.match(/data-short="([^"]*)"/)?.[1] || '';
        const tldr = block.match(/<p\s+class="tldr">([\s\S]*?)<\/p>/)?.[1] || '';
        const callout = block.match(/<aside\s+class="callout[^"]*">([\s\S]*?)<\/aside>/)?.[1] || '';
        mdLines.push(`### ${num} ${short}`);
        if (tldr) mdLines.push(`- **TL;DR:** ${stripTags(tldr)}`);
        if (callout) mdLines.push(`- **Lưu ý thực tế:** ${stripTags(callout)}`);
        mdLines.push(``);
      }
    }
  }

  mdLines.push(`---`);
  mdLines.push(`## Từ điển Thuật ngữ Song ngữ (${glossary.length} thuật ngữ)`);
  for (const g of glossary) {
    mdLines.push(`- **${g.term}** (${g.vi || 'Ch.' + g.ch}): ${g.def}`);
  }

  const mdPath = join(distDir, 'study-guide.md');
  writeFileSync(mdPath, mdLines.join('\n'), 'utf8');

  const updatedBook = inspectBook(bookId);
  return {
    book: updatedBook,
    syntaxErrors,
    buildOutput,
    files: {
      htmlSize: existsSync(join(distDir, 'index.html'))
        ? statSync(join(distDir, 'index.html')).size
        : 0,
      ankiCount: ankiLines.length,
      mdSize: statSync(mdPath).size,
    },
  };
}

export async function POST(_request, { params }) {
  try {
    const { bookId } = await params;
    const result = buildStudyArtifacts(bookId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function GET(request, { params }) {
  try {
    const { bookId } = await params;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'html';

    // Ensure artifacts exist
    buildStudyArtifacts(bookId);
    const distDir = join(ROOT, bookId, 'dist');

    if (format === 'anki') {
      const content = readFileSync(join(distDir, 'flashcards-anki.tsv'), 'utf8');
      return new Response(content, {
        headers: {
          'Content-Type': 'text/tab-separated-values; charset=utf-8',
          'Content-Disposition': `attachment; filename="${bookId}-anki-flashcards.tsv"`,
        },
      });
    }

    if (format === 'markdown') {
      const content = readFileSync(join(distDir, 'study-guide.md'), 'utf8');
      return new Response(content, {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': `attachment; filename="${bookId}-study-guide.md"`,
        },
      });
    }

    const htmlPath = join(distDir, 'index.html');
    const content = existsSync(htmlPath)
      ? readFileSync(htmlPath, 'utf8')
      : '<h1>Standalone build not available</h1>';
    return new Response(content, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="${bookId}-standalone-reader.html"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
