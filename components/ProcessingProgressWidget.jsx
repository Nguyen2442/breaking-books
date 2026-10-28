"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  X,
  BookOpen,
  CheckCircle2,
  Clock,
  ExternalLink,
} from "lucide-react";

export function ProcessingProgressWidget() {
  const [activeJobs, setActiveJobs] = useState([]);
  const [processingBooks, setProcessingBooks] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let timer = null;

    async function poll() {
      try {
        const res = await fetch("/api/overview");
        if (!res.ok) return;
        const data = await res.json();
        const books = data.books || [];

        // Books with active processing
        const active = books.filter(
          (b) => b.processing?.active || (b.stats && b.stats.completeChapters < b.stats.totalChapters && (b.processing?.running?.length > 0 || b.processing?.queued?.length > 0))
        );

        setProcessingBooks(active);

        // Individual running jobs
        const jobs = data.jobs || [];
        const running = jobs.filter((j) => j.status === "running");
        setActiveJobs(running);
      } catch {}
    }

    poll();
    timer = setInterval(poll, 3500);
    return () => clearInterval(timer);
  }, []);

  const totalRunningCount = processingBooks.reduce(
    (acc, b) => acc + (b.processing?.running?.length || 0),
    0
  );
  const totalQueuedCount = processingBooks.reduce(
    (acc, b) => acc + (b.processing?.queued?.length || 0),
    0
  );

  const hasActivity = totalRunningCount > 0 || totalQueuedCount > 0 || activeJobs.length > 0;

  if (!hasActivity || dismissed) return null;

  return (
    <div className="fixed bottom-6 right-6 z-40 select-none">
      <AnimatePresence>
        {!expanded ? (
          /* Minimized Floating Pill Button */
          <motion.button
            key="pill"
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setExpanded(true)}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-slate-900/95 dark:bg-[#0F1623]/95 backdrop-blur-md text-white border border-orange-500/40 shadow-[0_8px_24px_-4px_rgba(234,88,12,0.35)] cursor-pointer text-xs font-semibold group transition-all"
            title="Bấm để xem chi tiết tiến độ soạn sách"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span>
            </span>
            <span className="text-orange-300">
              ⚡ AI đang bóc tách:
            </span>
            <span className="text-white max-w-[160px] truncate">
              {processingBooks[0]?.title || "Đang soạn bài học..."}
            </span>
            <span className="px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-[10px] font-mono border border-orange-500/30">
              {totalRunningCount} đang chạy
            </span>
          </motion.button>
        ) : (
          /* Expanded Progress Modal / Card */
          <motion.div
            key="card"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.16 }}
            className="w-88 sm:w-96 rounded-2xl bg-white dark:bg-[#0F1623] border border-slate-200 dark:border-white/10 shadow-[0_20px_40px_-8px_rgba(0,0,0,0.25)] p-4 text-slate-900 dark:text-slate-100 space-y-3.5"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Tiến độ Bóc tách AI
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    {totalRunningCount} đang soạn · {totalQueuedCount} trong hàng đợi
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setExpanded(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                  title="Thu nhỏ thành thanh nổi"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setExpanded(false);
                    setDismissed(true);
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-500 cursor-pointer"
                  title="Tạm ẩn hoàn toàn trong phiên này"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* List of Processing Books */}
            <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
              {processingBooks.map((b) => {
                const complete = b.stats?.completeChapters || 0;
                const total = b.stats?.totalChapters || b.chapters?.length || 1;
                const pct = Math.round((complete / total) * 100);
                const runningChs = b.processing?.running || [];
                const queuedChs = b.processing?.queued || [];

                return (
                  <div
                    key={b.id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/5 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate block">
                          {b.title}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {complete}/{total} chương hoàn thành ({pct}%)
                        </span>
                      </div>
                      <a
                        href={`/books/${b.id}/ch/1`}
                        className="text-[10px] font-semibold text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-0.5 shrink-0"
                      >
                        <span>Đọc ngay</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-500 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    {/* Running & Queued badges */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {runningChs.map((n) => (
                        <span
                          key={`r-${n}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-500/15 border border-orange-500/30 text-orange-700 dark:text-orange-300 text-[10px] font-mono font-semibold"
                        >
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          <span>Chương {n}</span>
                        </span>
                      ))}

                      {queuedChs.slice(0, 4).map((n) => (
                        <span
                          key={`q-${n}`}
                          className="px-1.5 py-0.5 rounded-md bg-slate-200/60 dark:bg-white/5 text-slate-600 dark:text-slate-400 text-[10px] font-mono"
                        >
                          Ch {n} (chờ)
                        </span>
                      ))}

                      {queuedChs.length > 4 && (
                        <span className="text-[10px] text-slate-400 font-mono">
                          +{queuedChs.length - 4} chương...
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-white/10 text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-orange-500" />
                <span>AI xử lý ngầm tự động</span>
              </span>
              <button
                onClick={() => setExpanded(false)}
                className="text-[11px] text-orange-600 dark:text-orange-400 hover:underline cursor-pointer font-medium"
              >
                Thu nhỏ
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
