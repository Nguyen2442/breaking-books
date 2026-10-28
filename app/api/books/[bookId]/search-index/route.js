import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, inspectBook, getAllGlossaryFromBook } from '@/lib/books';

function stripTags(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function GET(_request, { params }) {
  try {
    const { bookId } = await params;
    const book = inspectBook(bookId);
    if (!book) {
      return NextResponse.json({ ok: false, error: 'Book not found' }, { status: 404 });
    }

    const bookDir = join(ROOT, bookId);
    const items = [];

    for (const ch of book.chapters) {
      // 1. Chapter entry
      items.push({
        type: 'chapter',
        id: `ch-${ch.n}`,
        chNum: ch.n,
        num: `Chương ${ch.n}`,
        title: ch.title,
        subtitle: ch.subtitle || ch.en,
        snippet: ch.part || '',
        url: `/books/${bookId}/ch/${ch.n}`,
      });

      const htmlPath = join(bookDir, 'src', `ch${ch.n}.html`);
      if (!existsSync(htmlPath)) continue;
      const html = readFileSync(htmlPath, 'utf8');

      // 2. Topic entries with TL;DR snippets
      const articleBlocks = html.split(/<article\s+class="topic"/g).slice(1);
      for (const rawBlock of articleBlocks) {
        const block = '<article class="topic"' + rawBlock;
        const idMatch = block.match(/id="([^"]+)"/);
        const numMatch = block.match(/data-num="([^"]*)"/);
        const shortMatch = block.match(/data-short="([^"]*)"/);
        const h2Match = block.match(/<h2>([\s\S]*?)<\/h2>/);
        const tldrMatch = block.match(/<p\s+class="tldr">([\s\S]*?)<\/p>/);

        const id = idMatch ? idMatch[1] : `ch${ch.n}-topic`;
        const num = numMatch ? numMatch[1] : '';
        const title = shortMatch
          ? shortMatch[1]
          : h2Match
          ? stripTags(h2Match[1])
          : id;
        const snippet = tldrMatch ? stripTags(tldrMatch[1]) : `Chương ${ch.n}: ${ch.title}`;

        items.push({
          type: 'topic',
          id,
          chNum: ch.n,
          num,
          title,
          subtitle: `Chương ${ch.n} · ${ch.title}`,
          snippet,
          url: `/books/${bookId}/ch/${ch.n}#${id}`,
        });

        // 3. Interactive Lab entries inside this topic
        const figRegex = /<figure\s+class="lab"\s+data-widget="([^"]+)"[\s\S]*?(?:<figcaption>([\s\S]*?)<\/figcaption>)?[\s\S]*?<\/figure>/g;
        for (const fm of block.matchAll(figRegex)) {
          const widgetName = fm[1];
          const caption = fm[2] ? stripTags(fm[2]) : `Mô phỏng tương tác ${widgetName}`;
          items.push({
            type: 'lab',
            id: `lab-${ch.n}-${widgetName}`,
            chNum: ch.n,
            num: num || `Ch.${ch.n}`,
            title: `Lab: ${widgetName}`,
            subtitle: `${num ? num + ' ' : ''}${title}`,
            snippet: caption,
            url: `/books/${bookId}/ch/${ch.n}#${id}`,
          });
        }
      }
    }

    // 4. Glossary Terms (also used by Flashcards deck)
    const glossary = getAllGlossaryFromBook(bookId);
    for (const g of glossary) {
      items.push({
        type: 'term',
        id: `term-${g.key}`,
        chNum: g.ch,
        num: `Thuật ngữ`,
        title: `${g.term}${g.vi ? ` — ${g.vi}` : ''}`,
        subtitle: `Chương ${g.ch}`,
        snippet: g.def,
        termKey: g.key,
        url: `/books/${bookId}/ch/${g.ch}#${g.topic}`,
      });
    }

    return NextResponse.json({
      ok: true,
      bookId,
      totalItems: items.length,
      glossaryCount: glossary.length,
      glossary,
      items,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
