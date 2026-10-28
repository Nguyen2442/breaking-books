"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Copy,
  Check,
  Terminal,
  RefreshCw,
  Cpu,
  BookOpen,
  HelpCircle,
} from "lucide-react";
import { FloatingTextHighlighter } from "@/components/ReaderToolSuite";

export default function SingleChapterReaderPage() {
  const params = useParams();
  const bookId = params?.bookId || "ddia-2e";
  const chNum = Number(params?.chNum || 1);

  const [chapterData, setChapterData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [startingJob, setStartingJob] = useState(false);
  const [jobMessage, setJobMessage] = useState("");

  const contentRef = useRef(null);

  async function loadChapter() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/books/${bookId}/chapters/${chNum}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể tải chương");
      setChapterData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    loadChapter();
  }, [bookId, chNum]);

  // Auto-refresh when the chapter is being written or not yet complete
  const isComplete = chapterData?.ch?.status === "complete" || chapterData?.chapter?.status === "complete";
  useEffect(() => {
    if (isComplete || loading) return;
    const interval = setInterval(() => {
      loadChapter();
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
        ? `<div class="p-6 rounded-2xl bg-white dark:bg-[#10161D] border border-slate-200 dark:border-white/10 space-y-4">
            <div class="flex items-center gap-2 text-xs font-mono uppercase text-teal-600 dark:text-teal-400">
              <span class="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
              <span>Văn bản gốc đang bóc tách (Đọc trước)</span>
            </div>
            <div class="prose max-w-none text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap font-sans text-base">
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

    // 2. Execute chapter's SVG & Mini-Lab script (src/chN.js) FIRST so widgets & glossary are registered
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
      setJobMessage("Đã bắt đầu. Quay lại sau vài phút rồi bấm “Tải lại”.");
      loadChapter();
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

  return (
    <motion.div
      key={`${bookId}-ch-${chNum}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="max-w-[840px] mx-auto"
    >
      {/* Real-time status banner when the chapter is being written or not yet complete */}
      {!loading && !isComplete && (
        <div className="mb-8 rounded-2xl bg-teal-500/10 border border-teal-500/30 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-ping"></span>
              <p className="text-base font-semibold text-teal-800 dark:text-teal-300">
                {beingWritten ? "Gemini 3.5 AI đang bóc tách bài học cho chương này..." : "Chương này đang sẵn sàng để soạn bài học"}
              </p>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {beingWritten
                ? "Chỉ mất khoảng 15-20 giây. Bạn có thể đọc trước phần văn bản gốc bên dưới, bài học tương tác sẽ tự nạp ngay khi sẵn sàng!"
                : "Bấm “Bắt đầu bóc tách” để Gemini AI soạn tóm tắt, giải nghĩa và dựng phòng thí nghiệm SVG tương tác."}
            </p>
            {jobMessage && <p className="text-sm text-emerald-700 dark:text-emerald-400 pt-1">{jobMessage}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!beingWritten && (
              <button
                onClick={writeThisChapter}
                disabled={startingJob}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold bg-teal-700 hover:bg-teal-600 text-white disabled:opacity-50 cursor-pointer"
              >
                {startingJob ? "Đang bắt đầu…" : "Bắt đầu bóc tách"}
              </button>
            )}
            <button
              onClick={loadChapter}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-medium bg-white dark:bg-[#151E2E] border border-slate-200 dark:border-white/10 cursor-pointer"
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
          <div className="h-48 rounded-2xl bg-slate-100 dark:bg-[#0F1623] border border-slate-200/80 dark:border-white/[0.06] animate-pulse p-8" />
          <div className="h-80 rounded-2xl bg-slate-100 dark:bg-[#0F1623] border border-slate-200/80 dark:border-white/[0.06] animate-pulse p-8" />
        </div>
      )}

      {error && (
        <div className="p-8 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-sm">
          {error}
        </div>
      )}

      {/* Interactive Chapter Content Container */}
      <div
        ref={contentRef}
        className={`bb-chapter-reader ${loading ? "hidden" : "block"}`}
      />

      {/* Floating Text Highlighter & Annotation Toolbar */}
      {!loading && (
        <FloatingTextHighlighter
          bookId={bookId}
          chNum={chNum}
          containerRef={contentRef}
        />
      )}

      {/* Bottom Mintlify-Style Prev / Next Chapter Cards */}
      {!loading && (
        <div className="mt-14 pt-8 border-t border-slate-200/80 dark:border-white/[0.08] grid grid-cols-1 sm:grid-cols-2 gap-4">
          {prevCh ? (
            <Link
              href={`/books/${bookId}/ch/${prevCh.n}`}
              className="group p-5 rounded-2xl bg-slate-50/70 dark:bg-[#0F1623] border border-slate-200/90 dark:border-white/[0.08] hover:border-teal-500/60 transition-all flex items-center gap-4"
            >
              <div className="w-9 h-9 rounded-xl bg-white dark:bg-[#151E2E] border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-400 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors shrink-0">
                <ArrowLeft className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-mono uppercase text-slate-400">
                  Chương trước · {String(prevCh.n).padStart(2, "0")}
                </div>
                <div className="text-sm font-bold mt-0.5 truncate group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
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
              className="group p-5 rounded-2xl bg-slate-50/70 dark:bg-[#0F1623] border border-slate-200/90 dark:border-white/[0.08] hover:border-teal-500/60 transition-all flex items-center justify-between gap-4 text-right sm:col-start-2"
            >
              <div className="min-w-0 ml-auto">
                <div className="text-[11px] font-mono uppercase text-slate-400">
                  Chương tiếp theo · {String(nextCh.n).padStart(2, "0")}
                </div>
                <div className="text-sm font-bold mt-0.5 truncate group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                  {nextCh.title}
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-white dark:bg-[#151E2E] border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-400 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors shrink-0">
                <ArrowRight className="w-4 h-4" />
              </div>
            </Link>
          )}
        </div>
      )}
    </motion.div>
  );
}
