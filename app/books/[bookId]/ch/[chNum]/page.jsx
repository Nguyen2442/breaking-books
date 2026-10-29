"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  RefreshCw,
  BookOpen,
  Brain,
  FlaskConical,
} from "lucide-react";
import { FloatingTextHighlighter } from "@/components/ReaderToolSuite";
import { formatRawSourceTextHtml } from "@/lib/formatRawText";

// In-Memory Client Cache for 0ms chapter navigation
const CLIENT_CACHE = new Map();

function getCachedChapter(bookId, chNum) {
  const key = `${bookId}:${chNum}`;
  if (CLIENT_CACHE.has(key)) return CLIENT_CACHE.get(key);
  if (typeof window !== "undefined") {
    try {
      const stored = sessionStorage.getItem(`bb_ch_${key}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        CLIENT_CACHE.set(key, parsed);
        return parsed;
      }
    } catch {}
  }
  return null;
}

function setCachedChapter(bookId, chNum, data) {
  const key = `${bookId}:${chNum}`;
  CLIENT_CACHE.set(key, data);
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(`bb_ch_${key}`, JSON.stringify(data));
    } catch {}
  }
}

// Background prefetch for next chapter
function prefetchChapter(bookId, nextNum) {
  if (!nextNum || CLIENT_CACHE.has(`${bookId}:${nextNum}`)) return;
  fetch(`/api/books/${bookId}/chapters/${nextNum}`)
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (data && data.ok) {
        setCachedChapter(bookId, nextNum, data);
      }
    })
    .catch(() => {});
}

export default function SingleChapterReaderPage() {
  const params = useParams();
  const bookId = params?.bookId || "ddia-2e";
  const chNum = Number(params?.chNum || 1);

  const [chapterData, setChapterData] = useState(() => getCachedChapter(bookId, chNum));
  const [loading, setLoading] = useState(() => !getCachedChapter(bookId, chNum));
  const [error, setError] = useState("");
  const [startingJob, setStartingJob] = useState(false);
  const [jobMessage, setJobMessage] = useState("");
  const [viewMode, setViewMode] = useState("all"); // "all" | "theory" | "lab"
  const [readingStep, setReadingStep] = useState("lesson"); // "lesson" | "quiz"
  const [showLabs, setShowLabs] = useState(false); // Mặc định tắt Interactive Lab để tránh rối mắt

  // Sync showLabs with localStorage & global events
  useEffect(() => {
    try {
      const saved = localStorage.getItem("bb_show_labs");
      if (saved !== null) {
        setShowLabs(saved === "true");
      } else {
        setShowLabs(false);
      }
    } catch {}

    function handleToggle(e) {
      if (typeof e.detail?.showLabs === "boolean") {
        setShowLabs(e.detail.showLabs);
      }
    }
    window.addEventListener("bb:toggle-labs", handleToggle);
    return () => window.removeEventListener("bb:toggle-labs", handleToggle);
  }, []);

  function toggleLabs() {
    const next = !showLabs;
    setShowLabs(next);
    try {
      localStorage.setItem("bb_show_labs", String(next));
    } catch {}
    window.dispatchEvent(new CustomEvent("bb:toggle-labs", { detail: { showLabs: next } }));
  }

  const contentRef = useRef(null);

  async function loadChapter(silent = false) {
    if (!silent) setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/books/${bookId}/chapters/${chNum}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể tải chương");
      setChapterData(data);
      setCachedChapter(bookId, chNum, data);
    } catch (err) {
      if (!silent) setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  // Handle bookId / chNum changes with 0ms cache check & instant layout reset
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    setReadingStep("lesson");

    const cached = getCachedChapter(bookId, chNum);
    if (cached) {
      setChapterData(cached);
      setLoading(false);
      // Silent background refresh if still pending
      if (cached.ch?.status !== "complete") {
        loadChapter(true);
      }
    } else {
      setChapterData(null);
      if (contentRef.current) contentRef.current.innerHTML = "";
      loadChapter(false);
    }
  }, [bookId, chNum]);

  // Predictive background prefetch for next chapter
  useEffect(() => {
    const allChapters = chapterData?.book?.chapters || [];
    const nextCh = allChapters.find((c) => c.n === chNum + 1);
    if (nextCh?.n) {
      const timer = setTimeout(() => {
        prefetchChapter(bookId, nextCh.n);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [chapterData, bookId, chNum]);

  // Auto-refresh when the chapter is being written or not yet complete
  const isComplete = chapterData?.ch?.status === "complete" || chapterData?.chapter?.status === "complete";
  useEffect(() => {
    if (isComplete || loading) return;
    const interval = setInterval(() => {
      loadChapter(true);
    }, 3500);
    return () => clearInterval(interval);
  }, [isComplete, loading, bookId, chNum]);

  // Mount interactive quizzes, progress checkboxes, and execute chapter SVG/Lab scripts
  useEffect(() => {
    if (!chapterData || !contentRef.current) return;
    const root = contentRef.current;

    // 1. Inject HTML or preview raw text if lesson is still being synthesized
    if (chapterData.html) {
      root.innerHTML = chapterData.html;
    } else {
      const title = chapterData.ch?.title || `Chương ${chNum}`;
      const rawSubtitle = chapterData.ch?.subtitle || "";
      const hasDistinctSubtitle = rawSubtitle && rawSubtitle.trim().toLowerCase() !== title.trim().toLowerCase();
      
      const subtitleHtml = hasDistinctSubtitle
        ? `<p class="chapter-lead text-slate-600 dark:text-slate-300">${rawSubtitle}</p>`
        : `<p class="chapter-lead text-slate-500 dark:text-slate-400 font-normal">Bản xem trước văn bản gốc · Bạn có thể đọc trước ngay bây giờ trong khi AI đang bóc tách bài học tương tác.</p>`;

      const rawText = chapterData.sourceText || "";
      const wordCount = rawText ? rawText.trim().split(/\s+/).length : 0;
      const estMinutes = Math.max(1, Math.round(wordCount / 220));
      const formattedHtml = rawText ? formatRawSourceTextHtml(rawText) : "";

      const rawPreview = rawText
        ? `
          <div class="rounded-3xl bg-white dark:bg-[#0D131F] border border-slate-200/90 dark:border-white/10 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] overflow-hidden">
            <!-- Reader Card Header -->
            <div class="px-6 py-4 bg-slate-50/80 dark:bg-white/[0.02] border-b border-slate-200/80 dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
              <div class="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-700 dark:text-orange-400 text-xs font-semibold">
                <span class="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
                <span>Văn bản gốc đang bóc tách · Đọc trước</span>
              </div>
              <div class="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-mono">
                <span>📖 ~${estMinutes} phút đọc</span>
                <span>•</span>
                <span>${wordCount.toLocaleString()} từ</span>
              </div>
            </div>

            <!-- Helpful Guidance Banner -->
            <div class="mx-6 sm:mx-8 mt-6 p-4 rounded-2xl bg-orange-50/70 dark:bg-orange-500/[0.04] border border-orange-200/60 dark:border-orange-500/20 flex items-start gap-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
              <span class="text-base shrink-0 mt-0.5">💡</span>
              <p class="leading-relaxed">
                Đây là văn bản gốc trích xuất từ sách để bạn đọc ngay trong lúc chờ AI hoàn thiện bài học tương tác (sơ đồ SVG, tóm tắt và câu hỏi trắc nghiệm). Mọi thao tác <strong>bôi đen highlight, ghi chú và đánh dấu</strong> đều hoạt động bình thường trên văn bản này.
              </p>
            </div>

            <!-- Beautifully Formatted Text Content -->
            <div class="px-6 sm:px-10 py-8 prose max-w-none text-slate-800 dark:text-slate-200">
              ${formattedHtml}
            </div>
          </div>
        `
        : `<div class="p-8 text-center text-slate-400">Đang chuẩn bị nội dung chương...</div>`;

      root.innerHTML = `
        <div class="chapter">
          <div class="chapter-head mb-8">
            <span class="eyebrow text-orange-600 dark:text-orange-400 font-semibold tracking-wide">CHƯƠNG ${chNum}</span>
            <h1 class="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white mt-1 mb-3">${title}</h1>
            ${subtitleHtml}
          </div>
          <div class="topic">
            ${rawPreview}
          </div>
        </div>
      `;
    }

    // 2. Execute chapter's SVG & Mini-Lab script FIRST so widgets & glossary are registered
    if (chapterData.js && chapterData.js.trim().length > 0) {
      try {
        const fn = new Function(chapterData.js);
        fn();
      } catch (err) {
        console.warn(`Error executing ch${chNum}.js:`, err);
      }
    }

    // 3. Mount DDIA interactive runtime (Widgets, Quizzes, Glossary Tooltips, Mark Read buttons)
    let cleanupRuntime = null;
    if (typeof window !== "undefined" && window.DDIA?.mountChapter) {
      cleanupRuntime = window.DDIA.mountChapter(root, bookId, (prog) => {
        window.dispatchEvent(
          new CustomEvent("bb-progress-change", { detail: prog })
        );
      });
    }

    // 4. If URL has a #hash (e.g. #t1-2), scroll smoothly to that topic
    if (window.location.hash) {
      const id = window.location.hash.slice(1);
      setTimeout(() => {
        const target = document.getElementById(id);
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 80);
    }

    return () => {
      if (typeof cleanupRuntime === "function") cleanupRuntime();
    };
  }, [chapterData, bookId, chNum]);

  async function writeThisChapter() {
    setStartingJob(true);
    setJobMessage("");
    try {
      const res = await fetch("/api/library/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId, chapters: [chNum] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không bắt đầu được.");
      setJobMessage("Đã bắt đầu. AI đang soạn bài học...");
      loadChapter(false);
    } catch (e) {
      setJobMessage(`Lỗi: ${e.message}`);
    } finally {
      setStartingJob(false);
    }
  }

  const chMeta = chapterData?.chapter || chapterData?.ch;
  const allChapters = chapterData?.book?.chapters || [];
  const prevCh = allChapters.find((c) => c.n === chNum - 1);
  const nextCh = allChapters.find((c) => c.n === chNum + 1);
  const processing = chapterData?.book?.processing || {};
  const beingWritten = [...(processing.running || []), ...(processing.queued || [])].includes(chNum);

  // Compute number of quiz questions
  const quizCount = chapterData?.content?.quizzes?.length || 0;

  return (
    <motion.div
      key={`${bookId}-ch-${chNum}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className="max-w-[840px] mx-auto pb-16"
    >
      {/* Real-time status banner when chapter is pending */}
      {!loading && !isComplete && (
        <div className="mb-8 rounded-2xl bg-orange-500/[0.07] border border-orange-500/25 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[0_2px_12px_-2px_rgba(234,88,12,0.06)]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-600 animate-ping"></span>
              <p className="text-base font-semibold text-orange-900">
                {beingWritten ? "Hệ thống AI đang bóc tách bài học cho chương này..." : "Chương này đang sẵn sàng để soạn bài học"}
              </p>
            </div>
            <p className="text-sm text-slate-600">
              {beingWritten
                ? "Chỉ mất khoảng 15 giây. Bạn có thể đọc trước phần văn bản gốc bên dưới, bài học tương tác sẽ tự nạp ngay khi sẵn sàng!"
                : "Bấm “Bắt đầu bóc tách” để AI soạn tóm tắt, giải nghĩa và dựng phòng thí nghiệm SVG tương tác."}
            </p>
            {jobMessage && <p className="text-sm text-orange-800 font-medium pt-1">{jobMessage}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!beingWritten && (
              <button
                onClick={writeThisChapter}
                disabled={startingJob}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold bg-orange-600 hover:bg-orange-500 text-white disabled:opacity-50 cursor-pointer shadow-sm transition-all"
              >
                {startingJob ? "Đang bắt đầu…" : "Bắt đầu bóc tách"}
              </button>
            )}
            <button
              onClick={() => loadChapter(false)}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-medium bg-white border border-slate-200/90 text-slate-700 hover:bg-slate-50 cursor-pointer shadow-sm transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              Tải lại
            </button>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-6 py-4">
          <div className="h-44 rounded-2xl bg-white border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.03)] animate-pulse p-8" />
          <div className="h-72 rounded-2xl bg-white border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.03)] animate-pulse p-8" />
        </div>
      )}

      {error && (
        <div className="p-8 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm shadow-sm">
          {error}
        </div>
      )}

      {/* Stepped Reader Top Navigation Bar */}
      {!loading && chapterData?.html && (
        <div className="mb-6 space-y-3">
          {/* Main 2-Step Phase Stepper: Phase 1 (Lesson) vs Phase 2 (Quiz) */}
          <div className="p-2 rounded-2xl bg-white border border-slate-200/90 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.03)] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100/80">
              <button
                onClick={() => {
                  setReadingStep("lesson");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  readingStep === "lesson"
                    ? "bg-white text-orange-800 shadow-[0_2px_8px_-1px_rgba(0,0,0,0.08)]"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 text-orange-600" />
                <span>1. Lý thuyết & Thử nghiệm</span>
              </button>

              <button
                onClick={() => {
                  setReadingStep("quiz");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  readingStep === "quiz"
                    ? "bg-white text-orange-800 shadow-[0_2px_8px_-1px_rgba(0,0,0,0.08)]"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Brain className="w-3.5 h-3.5 text-orange-600" />
                <span>2. Thực hành & Trắc nghiệm</span>
                {quizCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-800 text-[10px] font-mono font-bold">
                    {quizCount}
                  </span>
                )}
              </button>
            </div>

            {/* Reading Mode & Interactive Lab Toggle */}
            {readingStep === "lesson" && (
              <div className="flex items-center gap-2 px-2 border-t sm:border-t-0 border-slate-100 dark:border-white/10 pt-2 sm:pt-0">
                <button
                  type="button"
                  onClick={toggleLabs}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${
                    showLabs
                      ? "bg-orange-500 text-white border-orange-500 shadow-sm shadow-orange-500/25"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                  title={showLabs ? "Ẩn Interactive Lab để tránh rối mắt khi đọc" : "Bật lại Interactive Lab để xem mô phỏng tương tác"}
                >
                  <FlaskConical className={`w-3.5 h-3.5 ${showLabs ? "text-white" : "text-slate-400"}`} />
                  <span>Interactive lab:</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    showLabs ? "bg-white/25 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                  }`}>
                    {showLabs ? "Bật" : "Tắt"}
                  </span>
                </button>
              </div>
            )}

            {readingStep === "quiz" && (
              <div className="text-xs text-slate-500 px-3 py-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-600"></span>
                <span>Ôn tập Active Recall & Kiểm tra phản xạ</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Helpful banner when Interactive Labs are toggled off */}
      {!loading && chapterData?.html && !showLabs && readingStep === "lesson" && (
        <div className="mb-6 p-4 rounded-2xl bg-orange-50/60 dark:bg-orange-950/20 border border-orange-200/60 dark:border-orange-500/20 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-700 dark:text-slate-300">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-orange-500 shrink-0" />
            <span>Chế độ đọc thuần tuý: Các <strong>Interactive Lab</strong> đang được ẩn để tránh rối mắt.</span>
          </div>
          <button
            type="button"
            onClick={toggleLabs}
            className="font-bold text-orange-600 dark:text-orange-400 hover:underline cursor-pointer"
          >
            Bật lại lab
          </button>
        </div>
      )}

      {/* Interactive Chapter Content Container with separated theory & lab cards */}
      <div
        ref={contentRef}
        data-view={viewMode}
        data-step={readingStep}
        data-hide-labs={!showLabs}
        className={`bb-chapter-reader ${loading ? "hidden" : "block"}`}
      />

      {/* In Step 1 (Lesson): Prominent Stepped Transition CTA Card to Quiz */}
      {!loading && chapterData?.html && readingStep === "lesson" && (
        <div className="my-10 p-7 rounded-3xl bg-gradient-to-r from-orange-500/[0.08] via-amber-500/[0.04] to-transparent border border-orange-500/25 shadow-[0_6px_24px_-2px_rgba(234,88,12,0.06)] flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="space-y-1 text-center sm:text-left">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-orange-800">
              <Sparkles className="w-4 h-4 text-orange-600" />
              <span>Bạn đã hoàn thành phần Lý thuyết & Thử nghiệm!</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              Sẵn sàng kiểm tra Active Recall & Trắc nghiệm?
            </h3>
            <p className="text-xs text-slate-600">
              Tách biệt hoàn toàn phần câu hỏi giúp bạn tập trung ôn tập, không bị phân tâm bởi việc cuộn trang quá dài.
            </p>
          </div>
          <button
            onClick={() => {
              setReadingStep("quiz");
              window.scrollTo({ top: 80, behavior: "smooth" });
            }}
            className="inline-flex items-center gap-2.5 h-12 px-7 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm shadow-[0_4px_14px_-2px_rgba(234,88,12,0.3)] transition-all shrink-0 cursor-pointer hover:-translate-y-0.5"
          >
            <span>Làm câu hỏi thực hành</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* In Step 2 (Quiz): Back to Theory helper banner at top */}
      {!loading && chapterData?.html && readingStep === "quiz" && (
        <div className="my-6 flex items-center justify-between">
          <button
            onClick={() => {
              setReadingStep("lesson");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200/90 text-slate-700 hover:text-orange-600 cursor-pointer transition-colors shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>← Quay lại đọc Lý thuyết</span>
          </button>
          <span className="text-xs text-slate-500">
            {quizCount > 0 ? `${quizCount} câu hỏi trắc nghiệm` : "Kiểm tra kiến thức"}
          </span>
        </div>
      )}

      {/* Floating Text Highlighter & Annotation Toolbar */}
      {!loading && (
        <FloatingTextHighlighter
          bookId={bookId}
          chNum={chNum}
          containerRef={contentRef}
        />
      )}

      {/* Bottom Chapter Completion Banner & Prev / Next Chapter Navigation */}
      {!loading && (
        <div className="mt-12 pt-8 border-t border-slate-200/80 space-y-6">
          <div className="p-6 rounded-3xl bg-white border border-orange-500/25 shadow-[0_4px_24px_-2px_rgba(234,88,12,0.06)] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-orange-600 text-white flex items-center justify-center font-bold text-lg shadow-sm shrink-0">
                ✓
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Chương {chNum}: {chMeta?.title || chMeta?.en || `Chương ${chNum}`}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {nextCh ? `Tiếp tục hành trình sang Chương ${nextCh.n}: ${nextCh.title}` : "Chúc mừng bạn đã hoàn thành chương cuối của cuốn sách này!"}
                </p>
              </div>
            </div>

            {nextCh && (
              <Link
                href={`/books/${bookId}/ch/${nextCh.n}`}
                onMouseEnter={() => prefetchChapter(bookId, nextCh.n)}
                className="inline-flex items-center gap-2 h-11 px-6 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-semibold text-sm shadow-[0_2px_8px_-1px_rgba(234,88,12,0.25)] hover:shadow-[0_4px_14px_-2px_rgba(234,88,12,0.35)] transition-all shrink-0 cursor-pointer"
              >
                <span>Đọc tiếp Chương {nextCh.n}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {prevCh ? (
              <Link
                href={`/books/${bookId}/ch/${prevCh.n}`}
                onMouseEnter={() => prefetchChapter(bookId, prevCh.n)}
                className="group p-5 rounded-2xl bg-white border border-slate-200/90 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_32px_-4px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 hover:border-orange-500/40 transition-all flex items-center gap-4 cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200/90 flex items-center justify-center text-slate-400 group-hover:text-orange-600 group-hover:border-orange-500/30 transition-all shrink-0">
                  <ArrowLeft className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-mono uppercase text-slate-400">
                    Chương trước · {String(prevCh.n).padStart(2, "0")}
                  </div>
                  <div className="text-sm font-bold mt-0.5 truncate group-hover:text-orange-600 transition-colors">
                    {prevCh.title}
                  </div>
                </div>
              </Link>
            ) : (
              <div />
            )}

            {nextCh && (
              <Link
                href={`/books/${bookId}/ch/${nextCh.n}`}
                onMouseEnter={() => prefetchChapter(bookId, nextCh.n)}
                className="group p-5 rounded-2xl bg-white border border-slate-200/90 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_32px_-4px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 hover:border-orange-500/40 transition-all flex items-center justify-between gap-4 text-right sm:col-start-2 cursor-pointer"
              >
                <div className="min-w-0 ml-auto">
                  <div className="text-[11px] font-mono uppercase text-slate-400">
                    Chương tiếp theo · {String(nextCh.n).padStart(2, "0")}
                  </div>
                  <div className="text-sm font-bold mt-0.5 truncate group-hover:text-orange-600 transition-colors">
                    {nextCh.title}
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200/90 flex items-center justify-center text-slate-400 group-hover:text-orange-600 group-hover:border-orange-500/30 transition-all shrink-0">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Floating Quick Action Pill for Interactive Lab Toggle */}
      {!loading && chapterData?.html && readingStep === "lesson" && (
        <button
          type="button"
          onClick={toggleLabs}
          className={`fixed bottom-6 right-6 z-30 inline-flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg border transition-colors cursor-pointer backdrop-blur-md active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${
            showLabs
              ? "bg-white/95 dark:bg-slate-900/95 border-orange-200 dark:border-orange-500/30 text-orange-600 dark:text-orange-400 hover:bg-orange-50/80 shadow-orange-500/10"
              : "bg-slate-900/95 dark:bg-slate-800/95 border-slate-700 text-slate-200 hover:bg-slate-800"
          }`}
          title={showLabs ? "Ẩn Interactive Lab để tránh rối mắt" : "Bật lại Interactive Lab để xem mô phỏng"}
        >
          <FlaskConical className="w-4 h-4 shrink-0" />
          <span className="text-xs font-bold whitespace-nowrap">
            {showLabs ? "Interactive lab: Bật" : "Interactive lab: Tắt"}
          </span>
        </button>
      )}
    </motion.div>
  );
}