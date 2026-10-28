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
} from "lucide-react";
import { FloatingTextHighlighter } from "@/components/ReaderToolSuite";

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
      const subtitle = chapterData.ch?.subtitle || "Đang được Gemini 3.5 AI xử lý...";
      const rawPreview = chapterData.sourceText
        ? `<div class="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.03)] space-y-4">
            <div class="flex items-center gap-2 text-xs font-mono uppercase text-teal-700">
              <span class="w-2 h-2 rounded-full bg-teal-600 animate-pulse"></span>
              <span>Văn bản gốc đang bóc tách (Đọc trước)</span>
            </div>
            <div class="prose max-w-none text-slate-800 leading-relaxed whitespace-pre-wrap font-sans text-base">
              ${chapterData.sourceText.slice(0, 20000)}
            </div>
          </div>`
        : `<p class="text-slate-500">Đang chuẩn bị nội dung chương...</p>`;

      root.innerHTML = `
        <div class="chapter">
          <div class="chapter-head">
            <span class="eyebrow">CHƯƠNG ${chNum}</span>
            <h1>${title}</h1>
            <p class="chapter-lead">${subtitle}</p>
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
      setJobMessage("Đã bắt đầu. Gemini AI đang soạn bài học...");
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
        <div className="mb-8 rounded-2xl bg-teal-500/[0.07] border border-teal-500/25 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[0_2px_12px_-2px_rgba(13,148,136,0.06)]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-600 animate-ping"></span>
              <p className="text-base font-semibold text-teal-900">
                {beingWritten ? "Gemini 3.5 AI đang bóc tách bài học cho chương này..." : "Chương này đang sẵn sàng để soạn bài học"}
              </p>
            </div>
            <p className="text-sm text-slate-600">
              {beingWritten
                ? "Chỉ mất khoảng 15 giây. Bạn có thể đọc trước phần văn bản gốc bên dưới, bài học tương tác sẽ tự nạp ngay khi sẵn sàng!"
                : "Bấm “Bắt đầu bóc tách” để Gemini AI soạn tóm tắt, giải nghĩa và dựng phòng thí nghiệm SVG tương tác."}
            </p>
            {jobMessage && <p className="text-sm text-teal-800 font-medium pt-1">{jobMessage}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!beingWritten && (
              <button
                onClick={writeThisChapter}
                disabled={startingJob}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold bg-teal-700 hover:bg-teal-600 text-white disabled:opacity-50 cursor-pointer shadow-sm transition-all"
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
                    ? "bg-white text-teal-800 shadow-[0_2px_8px_-1px_rgba(0,0,0,0.08)]"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 text-teal-700" />
                <span>1. Lý thuyết & Thử nghiệm</span>
              </button>

              <button
                onClick={() => {
                  setReadingStep("quiz");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  readingStep === "quiz"
                    ? "bg-white text-teal-800 shadow-[0_2px_8px_-1px_rgba(0,0,0,0.08)]"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Brain className="w-3.5 h-3.5 text-teal-700" />
                <span>2. Thực hành & Trắc nghiệm</span>
                {quizCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-800 text-[10px] font-mono font-bold">
                    {quizCount}
                  </span>
                )}
              </button>
            </div>

            {/* Filter within Lesson: All | Theory Only | Visual Labs Only */}
            {readingStep === "lesson" && (
              <div className="flex items-center gap-1 px-2 border-t sm:border-t-0 border-slate-100 pt-2 sm:pt-0">
                <button
                  onClick={() => setViewMode("all")}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                    viewMode === "all" ? "bg-teal-50 text-teal-800 font-bold" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Tất cả
                </button>
                <button
                  onClick={() => setViewMode("theory")}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                    viewMode === "theory" ? "bg-teal-50 text-teal-800 font-bold" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Chỉ Lý thuyết
                </button>
                <button
                  onClick={() => setViewMode("lab")}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                    viewMode === "lab" ? "bg-teal-50 text-teal-800 font-bold" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Chỉ Thử nghiệm
                </button>
              </div>
            )}

            {readingStep === "quiz" && (
              <div className="text-xs text-slate-500 px-3 py-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-600"></span>
                <span>Ôn tập Active Recall & Kiểm tra phản xạ</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Interactive Chapter Content Container with separated theory & lab cards */}
      <div
        ref={contentRef}
        data-view={viewMode}
        data-step={readingStep}
        className={`bb-chapter-reader ${loading ? "hidden" : "block"}`}
      />

      {/* In Step 1 (Lesson): Prominent Stepped Transition CTA Card to Quiz */}
      {!loading && chapterData?.html && readingStep === "lesson" && (
        <div className="my-10 p-7 rounded-3xl bg-gradient-to-r from-teal-500/[0.08] via-emerald-500/[0.04] to-transparent border border-teal-500/25 shadow-[0_6px_24px_-2px_rgba(13,148,136,0.06)] flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="space-y-1 text-center sm:text-left">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-800">
              <Sparkles className="w-4 h-4 text-teal-600" />
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
            className="inline-flex items-center gap-2.5 h-12 px-7 rounded-2xl bg-teal-700 hover:bg-teal-600 text-white font-bold text-sm shadow-[0_4px_14px_-2px_rgba(13,148,136,0.3)] transition-all shrink-0 cursor-pointer hover:-translate-y-0.5"
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
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200/90 text-slate-700 hover:text-teal-700 cursor-pointer transition-colors shadow-sm"
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
          <div className="p-6 rounded-3xl bg-white border border-teal-500/25 shadow-[0_4px_24px_-2px_rgba(13,148,136,0.06)] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-teal-700 text-white flex items-center justify-center font-bold text-lg shadow-sm shrink-0">
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
                className="inline-flex items-center gap-2 h-11 px-6 rounded-2xl bg-teal-700 hover:bg-teal-600 text-white font-semibold text-sm shadow-[0_2px_8px_-1px_rgba(13,148,136,0.25)] hover:shadow-[0_4px_14px_-2px_rgba(13,148,136,0.35)] transition-all shrink-0 cursor-pointer"
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
                className="group p-5 rounded-2xl bg-white border border-slate-200/90 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_32px_-4px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 hover:border-teal-500/40 transition-all flex items-center gap-4 cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200/90 flex items-center justify-center text-slate-400 group-hover:text-teal-700 group-hover:border-teal-500/30 transition-all shrink-0">
                  <ArrowLeft className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-mono uppercase text-slate-400">
                    Chương trước · {String(prevCh.n).padStart(2, "0")}
                  </div>
                  <div className="text-sm font-bold mt-0.5 truncate group-hover:text-teal-700 transition-colors">
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
                className="group p-5 rounded-2xl bg-white border border-slate-200/90 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_32px_-4px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 hover:border-teal-500/40 transition-all flex items-center justify-between gap-4 text-right sm:col-start-2 cursor-pointer"
              >
                <div className="min-w-0 ml-auto">
                  <div className="text-[11px] font-mono uppercase text-slate-400">
                    Chương tiếp theo · {String(nextCh.n).padStart(2, "0")}
                  </div>
                  <div className="text-sm font-bold mt-0.5 truncate group-hover:text-teal-700 transition-colors">
                    {nextCh.title}
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200/90 flex items-center justify-center text-slate-400 group-hover:text-teal-700 group-hover:border-teal-500/30 transition-all shrink-0">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </Link>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}