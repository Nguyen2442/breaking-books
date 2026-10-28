#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, inspectBook, getAllGlossaryFromBook } from '../lib/books.js';

const bookId = process.argv[2] || 'ddia-2e';
const book = inspectBook(bookId);

if (!book) {
  console.error(`❌ Không tìm thấy sách: ${bookId}`);
  process.exit(1);
}

console.log(`\n📚 Kiểm tra chất lượng sách: ${book.title} (${book.id})`);
console.log(`================================================================`);

let hasError = false;
const bookDir = join(ROOT, bookId);

for (const ch of book.chapters) {
  const jsPath = join(bookDir, 'src', `ch${ch.n}.js`);
  let syntaxOk = true;
  if (ch.hasJs && existsSync(jsPath)) {
    try {
      execFileSync('node', ['--check', jsPath], { stdio: 'pipe' });
    } catch {
      syntaxOk = false;
      hasError = true;
    }
  }
  const icon = ch.status === 'complete' && syntaxOk ? '✅' : '⚠️';
  console.log(
    `${icon} Chương ${String(ch.n).padStart(2, '0')} | ${ch.status.padEnd(8)} | ${String(ch.topicsCount).padStart(2)} topics | ${String(ch.jsWidgets.length).padStart(2)}/${String(ch.htmlWidgets.length).padStart(2)} SVG labs | ${ch.quizCount} quiz | ${syntaxOk ? 'JS OK' : 'JS SYNTAX ERR'}${
      ch.missingWidgets.length ? ` | Thiếu: ${ch.missingWidgets.join(', ')}` : ''
    }`
  );
}

const glossary = getAllGlossaryFromBook(bookId);
console.log(`================================================================`);
console.log(
  `📊 Tổng kết: ${book.completeCount}/${book.totalChapters} chương hoàn chỉnh · ${book.totalTopics} topics · ${book.totalWidgets} SVG widgets · ${book.totalQuizzes} câu quiz · ${glossary.length} thuật ngữ`
);

if (hasError) process.exit(1);
