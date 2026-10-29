# Authoring contract — Sổ tay DDIA 2e

One self-contained page. `node build.mjs` concatenates:
`src/shell-top.html` → `src/ch1.html` → `src/ch2.html` → `src/ch3.html` → `src/shell-bottom.html`,
and inlines `src/styles.css` plus scripts in order `core.js, ch1.js, ch2.js, ch3.js`.
Output: `dist/index.html` (open locally) and `dist/artifact.html`.

Each chapter author owns exactly two files: `src/chN.html` and `src/chN.js`. Do not edit other files.
If you need a new CSS rule, put it in a `<style>` block at the top of your `chN.html`, scoped under `#chN`, using only the tokens from `styles.css`.

## Language and tone
- Vietnamese for all prose, labels, buttons. Keep English technical terms, in italics or in a `dfn`, the first time they appear: "độ trễ đuôi (*tail latency*)".
- Plain, direct sentences, written for a developer reading the book. Explain *why*, not only *what*.
- Stay faithful to the book. Use the book's numbers and examples (5,700 posts/s, 200 followers, 2–5% HDD AFR, Lucy & Alain, sharks per month, conference booking…). When a widget needs numbers the book does not give, label them in the UI as "số liệu minh hoạ".
- Do not copy long passages from the book. Summarize and explain in your own words. Short code examples from the book (SQL, Cypher, etc.) are fine.
- No emoji. No lorem ipsum.

## Chapter markup
```html
<section class="chapter" id="ch2" data-chapter="2" data-title="Yêu cầu phi chức năng">
  <header class="chapter-head">
    <p class="eyebrow">Chương 2</p>
    <h1>Defining Nonfunctional Requirements <span class="vi">Định nghĩa các yêu cầu phi chức năng</span></h1>
    <blockquote class="epigraph">Quote in English as in the book<cite>— Alan Kay, 2012</cite></blockquote>
    <p class="lede">2–3 sentences: what the chapter is about and why it matters.</p>
    <nav class="chapter-map"></nav>   <!-- filled automatically with topic chips -->
  </header>

  <article class="topic" id="ch2-percentiles" data-num="2.5" data-short="Percentile" data-keywords="p50 p99 median mean tail">
    <p class="eyebrow">2.5 · Describing Performance</p>      <!-- book section name in English -->
    <h2>Trung bình, trung vị và percentile <span class="vi">Average, Median, and Percentiles</span></h2>
    <div class="tldr"><h3>Tóm tắt</h3><ul><li>…</li><li>…</li></ul></div>
    <div class="prose">
      <p>… <dfn data-term="p99">p99</dfn> …</p>
      <h3>Sub-heading</h3> …
    </div>
    <figure class="lab" data-widget="percentiles">
      <figcaption><span class="lab-tag">Thử nghiệm</span> Phân bố thời gian phản hồi của 100 request
        <small>Kéo thanh “tỉ lệ request chậm” và xem trung bình bị kéo lệch thế nào so với p50.</small></figcaption>
      <div class="lab-body"></div>
    </figure>
    <aside class="callout callout-key"><b>Ghi nhớ</b><p>…</p></aside>
    <!-- also: callout-warn <b>Cạm bẫy</b>, callout-real <b>Thực tế</b>, callout-book <b>Trong sách</b> -->
  </article>
  …
  <article class="topic" id="ch2-review" data-num="2.★" data-short="Tổng kết & kiểm tra">
    … chapter summary (prose) + quiz:
    <div class="quiz">
      <div class="q" data-answer="1">         <!-- 0-based index of correct option -->
        <p>Câu hỏi?</p>
        <ol><li>Đáp án A</li><li>Đáp án B</li><li>Đáp án C</li></ol>
        <p class="explain">Vì sao B đúng, A/C sai.</p>
      </div>
    </div>
  </article>
</section>
```
- Topic ids: `chN-slug` (letters, digits, hyphens only). `data-num` like `2.5`; `data-short` = short Vietnamese title for the sidebar (≤ 32 chars).
- The core adds the "Đánh dấu đã đọc" footer, sidebar, chapter chips, search, popovers. Do not build these.
- Other available blocks: `.table-wrap > table.data` (add `class="num"` on numeric cells), `pre.code` with spans `.k` keyword, `.s` string, `.c` comment, `.n` number, `.fn` function, `mark` for highlight; `mark` inside prose for highlighter emphasis.

## Widgets (`src/chN.js`)
```js
(function () {
  const { h, s, clear, fmt, fmtBig, fmtMs, pct, rng, normal, percentile, clamp, sleep,
          slider, seg, button, checkbox, stat, log, jsonHTML, widget, glossary, reducedMotion } = window.DDIA;

  widget('percentiles', (root) => {          // root = the .lab-body element
    const out = h('div', { class: 'stats' });
    const sl = slider({ label: 'Tỉ lệ request chậm', min: 0, max: 20, value: 3, format: (v) => v + '%', onInput: render });
    root.append(h('div', { class: 'controls' }, sl.el), out /*, h('div', {class:'viz'}, svgEl) */);
    function render() { … }
    render();
  });

  glossary.add([
    { key: 'p99', term: 'p99 (99th percentile)', vi: 'phân vị thứ 99', ch: 2, topic: 'ch2-percentiles',
      def: 'Ngưỡng thời gian mà 99% request nhanh hơn. Dùng để đo trải nghiệm của nhóm người dùng chậm nhất.' },
  ]);
})();
```
Helpers (see `src/core.js`):
- `h(tag, attrs, ...children)` DOM builder; `s(tag, attrs, ...children)` SVG builder. attrs: `class`, `text`, `html`, `onClick`, `style:{}`, any attribute.
- `slider({label,min,max,step,value,format,onInput})` → `{el, value, set(v)}`; `seg({options:[{value,label}],value,onChange})` → `{el, value, set}`; `button(label, onClick, 'ghost'|'danger')`; `checkbox(label, checked, onChange)` → `{el, value}`.
- `stat(label, value, tone, sub)` → element with `.update(value, tone, sub)`; tones: `ok warn bad accent`. Wrap several in `h('div',{class:'stats'})`.
- `log()` → element with `.add(text, tone)` / `.reset()`; tones `ok bad warn acc t`.
- `jsonHTML(obj)` → highlighted HTML string for `h('pre',{class:'json', html})`.
- `fmt(n, digits)` vi-VN numbers, `fmtBig(n)` (nghìn/triệu/tỷ), `fmtMs(ms)`, `pct(x)`.
- `rng(seed)` deterministic RNG, `normal(r)`, `percentile(sortedArr, 0.99)`, `clamp`, `sleep(ms)` (0 under reduced motion), `reducedMotion`.
- Layout classes: `.controls`, `.btn-row`, `.lab-split` (2 cols → 1 on phone), `.box` (+ `h5` title), `.stats/.stat`, `.pill.(ok|warn|bad|accent|violet)`, `.lab-note`, `.log`, `.json`, `.table-wrap > table.data` (`tr.hit` highlights a row).

### Visual rules (both light and dark themes must work)
- Never use literal colors in JS or inline styles. In SVG use classes: fills `f-accent f-accent-soft f-mark f-mark-soft f-violet f-violet-soft f-ok f-warn f-bad f-bad-soft f-ink f-ink2 f-ink3 f-surface f-surface2 f-bg f-none`; strokes `s-accent s-mark s-violet s-ok s-warn s-bad s-ink s-ink3 s-line`; `.grid` `.axis` for chart lines; `.lbl-strong` for bold labels; `.dash` dashed; `.pulse` animation. In HTML use `style="background:var(--accent-soft)"` only via tokens.
- Every drawn SVG shape needs an explicit fill class (`f-none` for outlines). Use a `viewBox` and let it scale (`.viz svg` is width:100%). Leave margin for labels. Draw charts to scale and label axes with units.
- Widgets must work at 400px width: wrap controls, no fixed widths > 360px, wide tables/diagrams inside `.viz` or `.table-wrap` (they scroll).
- Open in a meaningful state (sample data loaded, a result already shown). Nothing hidden until a click.
- Animations: short, use `sleep()`, always allow re-run, guard against double-clicks (disable button while running). Stop timers when finished; no infinite `setInterval` running in the background unless the user pressed Start (then offer Stop).
- Give each control a visible label. Buttons say what they do ("Đăng bài", "Chạy truy vấn", "Giết node ngẫu nhiên").
- Never write the literal text `</script>` anywhere in JS.

## Checks before you finish
1. `node --check src/chN.js`
2. `node build.mjs`
3. `node /private/tmp/claude-501/-Users-elysion-Developments-breaking-books/a38516ad-5844-4c14-ab7a-6531b399ae06/scratchpad/pw/smoke.mjs chN-some-topic-id …` — must report no errors for your widgets, `failed: []`, no `missingTerms`, no `wide` elements in your chapter, `docScrollW == innerW`. Screenshots land in `…/scratchpad/pw/shots/`; look at a few (desktop light + phone dark) and fix what looks broken.
   Other chapters may be missing or mid-edit while you work; only your own chapter's results matter.

## Chapters 4–13 (sourced from the 1st edition)
The page follows the 2nd-edition chapter order. Chapters 4–13 are written from the **1st edition (2017)** text:
slot `ch4` ← 1e Ch.3 Storage and Retrieval, `ch5` ← 1e Ch.4, … `ch13` ← 1e Ch.12 The Future of Data Systems.
Source text per slot: `/private/tmp/claude-501/-Users-elysion-Developments-breaking-books/a38516ad-5844-4c14-ab7a-6531b399ae06/scratchpad/text/e1/chN.txt`
(1e glossary: `…/text/e1/glossary.txt`). Ch.6 includes the Part II intro; ch11 includes the Part III intro.

Header for these chapters — put the edition badge in the eyebrow:
```html
<section class="chapter" id="ch6" data-chapter="6" data-title="Sao chép dữ liệu" data-edition="1e">
  <header class="chapter-head">
    <p class="eyebrow">Chương 6 <span class="ed-badge">Nguồn: ấn bản 1 · Chương 5</span></p>
    <h1>Replication <span class="vi">Sao chép dữ liệu</span></h1>
    …
```
Cross-chapter references use the 2nd-edition numbering of this page ("xem Chương 8 — Transactions"), linking with `<a href="#ch8">`.
Aim for 10–16 topics per chapter (follow the book's own section structure), every topic with a lab, plus a review topic `chN-review` with 6–8 quiz questions. 25–45 glossary terms per chapter. Keys are plain kebab-case English; if a term already exists in another chapter it is fine to define it again with your chapter's wording.
