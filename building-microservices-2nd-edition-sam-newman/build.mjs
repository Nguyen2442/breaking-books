// Assemble src/ parts into one self-contained page.
//   dist/index.html    — full document, open directly in a browser
//   dist/artifact.html — body fragment (the Artifact host adds the doctype/head skeleton)
// `node build.mjs ch2` builds only that chapter into dist/ch2/ (for working on one chapter in isolation).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const src = (f) => join(root, 'src', f);
const read = (f) => readFileSync(src(f), 'utf8');
const metaPath = join(root, 'book.json');
const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : null;
const maxCh = (meta && Array.isArray(meta.chapters) && meta.chapters.length) ? meta.chapters.length : 13;
const only = process.argv.slice(2);
const CHAPTERS = only.length ? only : Array.from({ length: maxCh }, (_, i) => `ch${i + 1}`);
const outDir = join(root, 'dist', ...(only.length ? [only.join('-')] : []));

const metaScript = meta ? `<script>window.BOOK_META = ${JSON.stringify(meta).replace(/<\/script/gi, '<\\/script')};</script>\n` : '';
const scripts = metaScript + ['core.js', ...CHAPTERS.map((c) => `${c}.js`)]
  .filter((f) => existsSync(src(f)))
  .map((f) => {
    const code = read(f);
    if (/<\/script/i.test(code)) throw new Error(`${f} contains a literal </script> and would break inlining`);
    return `<script>\n/* ---- ${f} ---- */\n${code}\n</script>`;
  })
  .join('\n');

const top = existsSync(src('shell-top.html'))
  ? read('shell-top.html').replace('/*__STYLES__*/', () => (existsSync(src('styles.css')) ? read('styles.css') : ''))
  : '<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Breaking Books</title></head><body><div class="shell"><main><div class="page">';

const bottom = existsSync(src('shell-bottom.html'))
  ? read('shell-bottom.html').replace('/*__SCRIPTS__*/', () => scripts)
  : `</div></main></div>\n${scripts}</body></html>`;
const chapters = CHAPTERS.filter((c) => existsSync(src(`${c}.html`))).map((c) => read(`${c}.html`)).join('\n');
const fragment = `${top}\n${chapters}\n${bottom}`;

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'artifact.html'), fragment);
writeFileSync(join(outDir, 'index.html'),
  `<!doctype html>\n<html lang="vi">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body>\n${fragment}\n</body>\n</html>\n`);
console.log(`built ${outDir}/index.html (${(fragment.length / 1024).toFixed(0)} KB)`);
