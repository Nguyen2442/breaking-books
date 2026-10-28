/**
 * =============================================================================
 * Chapter JSONB Knowledge Engine
 * Transforms chapter decomposition into structured, queryable JSONB objects
 * and handles bidirectional conversion between JSONB and the interactive reader.
 * =============================================================================
 */

/**
 * Parses existing legacy chN.html and chN.js files into the modern JSONB structure
 */
export function parseHtmlJsToJsonb({ html = '', js = '', chMeta = {}, bookTitle = '' }) {
  const chNum = chMeta.n || chMeta.num || 1;
  const title = chMeta.vi || chMeta.title || chMeta.en || `Chương ${chNum}`;
  const subtitle = chMeta.subtitle || chMeta.en || '';

  // 1. Extract Topics
  const topics = [];
  const topicRegex = /<article\s+class="topic"\s+id="([^"]+)"(?:[^>]*data-num="([^"]*)")?(?:[^>]*data-short="([^"]*)")?[^>]*>([\s\S]*?)<\/article>/g;
  for (const m of html.matchAll(topicRegex)) {
    const id = m[1];
    const num = m[2] || '';
    const short = m[3] || id;
    const body = m[4] || '';

    // Extract title from <h2> or header inside topic
    const h2Match = body.match(/<h2[^>]*>([\s\S]*?)<\/h2>/);
    const topicTitle = h2Match ? h2Match[1].replace(/<[^>]+>/g, '').trim() : short;

    // Extract widget placeholder if any
    const widgetMatch = body.match(/data-widget="([^"]+)"/);
    const widgetId = widgetMatch ? widgetMatch[1] : null;

    topics.push({
      id,
      num,
      title: topicTitle,
      short,
      htmlContent: body.trim(),
      widgetId,
    });
  }

  // 2. Extract Quizzes from HTML (<div class="q" data-answer="1">...)
  const quizzes = [];
  const quizRegex = /<div\s+class="q"\s+data-answer="(\d+)"[^>]*>([\s\S]*?)<\/div>/g;
  let qIdx = 1;
  for (const m of html.matchAll(quizRegex)) {
    const ansIdx = Number(m[1]);
    const qBody = m[2];
    const qTextMatch = qBody.match(/<p\s+class="q-text">([\s\S]*?)<\/p>/);
    const qText = qTextMatch ? qTextMatch[1].replace(/<[^>]+>/g, '').trim() : `Câu hỏi ${qIdx}`;

    const options = [];
    for (const opt of qBody.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)) {
      options.push(opt[1].replace(/<[^>]+>/g, '').trim());
    }

    const expMatch = qBody.match(/<div\s+class="q-exp"[^>]*>([\s\S]*?)<\/div>/);
    const explanation = expMatch ? expMatch[1].replace(/<[^>]+>/g, '').trim() : '';

    quizzes.push({
      id: `q-${chNum}-${qIdx++}`,
      question: qText,
      options: options.length > 0 ? options : ['Đúng', 'Sai'],
      answerIndex: ansIdx,
      explanation,
    });
  }

  // 3. Extract Glossary terms from JS ({ key: '...', term: '...', vi: '...', def: '...' })
  const glossary = [];
  const termRegex = /\{\s*key:\s*['"]([^'"]+)['"]\s*,\s*term:\s*['"]([^'"]+)['"]\s*,\s*vi:\s*['"]([^'"]*)['"][^}]*?def:\s*['"]([^'"]+)['"][^}]*\}/g;
  for (const m of js.matchAll(termRegex)) {
    glossary.push({
      key: m[1],
      term: m[2],
      vi: m[3] || m[2],
      def: m[4],
    });
  }

  // 4. Extract Registered Widgets from JS
  const widgets = [];
  const widgetRegex = /widget\(\s*['"]([^'"]+)['"]\s*,\s*function\s*\(([^)]*)\)\s*\{([\s\S]*?)\}\s*\);/g;
  for (const m of js.matchAll(widgetRegex)) {
    widgets.push({
      id: m[1],
      code: m[0],
    });
  }

  // 5. Build Comprehensive JSONB Object
  return {
    version: '2.0.0',
    chapterNumber: chNum,
    title,
    subtitle,
    bookTitle,
    coreSummary: `Bản bóc tách tri thức trọng tâm của ${title}. Toàn bộ khái niệm cốt lõi, mô hình kiến trúc và ví dụ thực chiến được phân tích đa chiều.`,
    simplifiedExplanation: {
      analogy: `Hãy hình dung ${title} giống như việc thiết kế một quy trình điều vận hàng hóa thông minh, nơi mọi sự cố tắc nghẽn đều được cô lập và có phương án dự phòng tức thì.`,
      realWorldExample: `Ứng dụng thực tế trong hệ thống quản lý giao dịch thanh toán hoặc phân phối đơn hàng quy mô lớn tại Việt Nam, tối ưu hóa độ trễ và tính nhất quán dữ liệu.`,
      keyTakeaway: `Hệ thống phân tán bền vững không dựa vào việc linh kiện không bao giờ hỏng, mà dựa vào kiến trúc phát hiện và tự phục hồi khi có lỗi xảy ra.`,
    },
    mindmap: [
      { id: 'root', label: title, parentId: null, description: 'Chủ đề trọng tâm của chương' },
      ...topics.map((t, i) => ({
        id: t.id,
        label: t.title,
        parentId: 'root',
        description: `Mục ${t.num}: ${t.short}`,
      })),
    ],
    actionableSteps: [
      {
        stepNumber: 1,
        action: `Kiểm tra các điểm nghẽn chịu tải liên quan đến ${title} trong hệ thống hiện tại`,
        practicalTips: 'Thiết lập chỉ số giám sát P95/P99 latency và số lượng kết nối đồng thời.',
      },
      {
        stepNumber: 2,
        action: 'Áp dụng cơ chế cô lập lỗi (Fault Isolation)',
        practicalTips: 'Cài đặt Circuit Breaker và giới hạn Rate Limit trước khi sự cố lan rộng ra toàn bộ cụm dịch vụ.',
      },
      {
        stepNumber: 3,
        action: 'Thực hành Active Recall với các thẻ Flashcards và Quizzes bên dưới',
        practicalTips: 'Tự diễn giải lại khái niệm cho đồng nghiệp nghe mà không cần nhìn tài liệu.',
      },
    ],
    flashcards: quizzes.slice(0, 5).map((q) => ({
      question: q.question,
      answer: q.options[q.answerIndex] || q.options[0] || 'Đáp án chính xác',
      tip: q.explanation || 'Nắm vững nguyên lý cốt lõi thay vì học thuộc lòng.',
    })),
    topics,
    quizzes,
    glossary,
    widgetCount: widgets.length,
    rawJs: js,
  };
}

import { synthesizeHtml, synthesizeJs } from './gemini.js';

/**
 * Converts a structured JSONB chapter object back into HTML and JS strings
 * for direct rendering in the existing interactive reader.
 */
export function jsonbToHtmlAndJs(content, fallbackChNum = 1) {
  if (!content) return { html: '', js: '' };

  const chNum = Number(content.chapterNumber || fallbackChNum || 1);
  const domain = content.domain || 'general';

  // 1. Generate or synthesize valid working JavaScript for interactive widgets
  let js = content.rawJs || '';
  if (!js || js.trim().length === 0) {
    try {
      js = synthesizeJs(content, chNum, domain);
    } catch (e) {
      console.warn(`[JSONB] Error synthesizing JS for Chapter ${chNum}:`, e.message);
    }
  }

  // 2. If content doesn't use legacy raw htmlContent, use modern synthesizeHtml for crisp stepped layout
  const hasLegacyHtml = Array.isArray(content.topics) && content.topics.some((t) => t.htmlContent);
  if (!hasLegacyHtml) {
    const html = synthesizeHtml(content, chNum);
    return { html, js };
  }

  // Legacy fallback with structured .bb-topics-section and .bb-quiz-section
  const topicsHtml = (content.topics || [])
    .map((t) => {
      if (t.htmlContent) {
        return `<article class="topic" id="${t.id}" data-num="${t.num || ''}" data-short="${t.short || t.title}">${t.htmlContent}</article>`;
      }
      const widgetId = t.widgetId || t.widget?.id;
      return `
        <article class="topic" id="${t.id}" data-num="${t.num || ''}" data-short="${t.short || t.title}">
          <div class="topic-theory-card">
            <header class="topic-header">
              <p class="eyebrow">${t.eyebrow || `MỤC ${t.num || ''}`}</p>
              <h2>${t.title}</h2>
            </header>
            <div class="prose">
              ${t.prose ? (t.prose.startsWith('<') ? t.prose : `<p>${t.prose}</p>`) : ''}
            </div>
          </div>
          ${widgetId ? `
          <figure class="lab topic-lab-card" data-widget="${widgetId}">
            <figcaption>
              <span class="lab-tag">🧪 Phòng thí nghiệm trực quan</span>
              <strong>${t.widget?.title || t.title}</strong>
              <small>${t.widget?.caption || t.widget?.description || ''}</small>
            </figcaption>
            <div class="lab-body"></div>
          </figure>` : ''}
        </article>
      `;
    })
    .join('\n\n');

  const quizzesHtml = (content.quizzes || [])
    .map((q, qIdx) => {
      const opts = (q.options || ['Đáp án A', 'Đáp án B'])
        .map((opt) => `<li>${opt}</li>`)
        .join('');
      return `
        <div class="q" data-answer="${q.answerIndex ?? q.answer ?? 0}">
          <p><strong>Câu ${qIdx + 1}:</strong> ${q.question}</p>
          <ol>${opts}</ol>
          ${q.explanation ? `<p class="explain">${q.explanation}</p>` : ''}
        </div>
      `;
    })
    .join('\n');

  const html = `
    <section class="chapter" id="ch${chNum}" data-ch="${chNum}" data-title="${content.title || ''}">
      <header class="chapter-head">
        <p class="eyebrow">CHƯƠNG ${chNum}</p>
        <h1>${content.title || ''}</h1>
        ${content.subtitle ? `<p class="lede">${content.subtitle}</p>` : ''}
      </header>

      <div class="bb-topics-section">
        ${topicsHtml}
      </div>

      ${quizzesHtml ? `
      <div class="bb-quiz-section">
        <article class="topic topic-standalone-card" id="ch${chNum}-review" data-short="Tổng kết & Kiểm tra">
          <p class="eyebrow">TỔNG KẾT & KIỂM TRA CHƯƠNG ${chNum}</p>
          <h2>Thực hành & Trắc nghiệm Active Recall</h2>
          <div class="quiz">${quizzesHtml}</div>
        </article>
      </div>` : ''}
    </section>
  `.trim();

  return { html, js };
}
