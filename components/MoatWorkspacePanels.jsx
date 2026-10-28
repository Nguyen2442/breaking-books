"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  BookOpen,
  Brain,
  CheckCircle2,
  Clock,
  ChevronRight,
  RotateCw,
  Search,
  Layers,
  ArrowRight,
  Flame,
  Award,
  Filter,
  Check,
  Send,
  ExternalLink,
} from "lucide-react";

/**
 * -----------------------------------------------------------------------------
 * 1. Cross-Book Knowledge Graph RAG Panel
 * -----------------------------------------------------------------------------
 */
export function CrossBookRagPanel() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const sampleQueries = [
    "So sánh quan điểm về độ tin cậy và lỗi mạng giữa Martin Kleppmann và Sam Newman",
    "Khi nào nên dùng Eventual Consistency thay vì Strong Consistency?",
    "Làm thế nào để xử lý Replication Lag trong thực tế?",
  ];

  async function handleSearch(q) {
    const text = q || query;
    if (!text.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/rag/cross-book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: text }),
      });
      const data = await res.json();
      if (data.ok) {
        setResult(data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-[#10141D]/80 backdrop-blur-xl p-6 sm:p-8 shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 dark:bg-indigo-400/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
          <Brain className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight">Hỏi đáp Liên Sách (Cross-Book Knowledge Graph RAG)</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Truy vấn chéo đa nguồn qua pgvector (HNSW) · Đối chiếu các tác giả & tổng hợp luận điểm độc quyền
          </p>
        </div>
      </div>

      {/* Search Input Box */}
      <div className="mt-5 relative">
        <div className="flex items-center gap-2 p-2 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#090D16] shadow-inner focus-within:border-indigo-500 transition-colors">
          <Search className="w-5 h-5 text-slate-400 ml-2 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Đặt câu hỏi chéo qua toàn bộ thư viện sách của bạn..."
            className="w-full bg-transparent text-sm focus:outline-none placeholder:text-slate-400 text-slate-800 dark:text-slate-100"
          />
          <button
            onClick={() => handleSearch()}
            disabled={loading || !query.trim()}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
          >
            {loading ? <RotateCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Tổng hợp
          </button>
        </div>

        {/* Suggestion Pills */}
        <div className="mt-3 flex flex-wrap gap-2">
          {sampleQueries.map((sq, i) => (
            <button
              key={i}
              onClick={() => {
                setQuery(sq);
                handleSearch(sq);
              }}
              className="text-xs px-3 py-1.5 rounded-full bg-slate-100 dark:bg-white/5 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200/60 dark:border-white/5 transition-all cursor-pointer text-left"
            >
              💡 {sq}
            </button>
          ))}
        </div>
      </div>

      {/* RAG Results Display */}
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 space-y-6 pt-6 border-t border-slate-200/60 dark:border-white/10"
        >
          {/* Metadata Badges */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              ✓ Đã phân tích {result.perspectivesCount.books} cuốn sách
            </span>
            <span className="text-xs font-medium px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              ✓ Đối chiếu {result.perspectivesCount.authors} tác giả
            </span>
            <span className="text-xs font-medium px-3 py-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              ✓ {result.perspectivesCount.chunks} đoạn trích HNSW
            </span>
          </div>

          {/* Synthesized Answer with Markdown styling */}
          <div className="p-6 rounded-2xl bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/10 space-y-4">
            <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed whitespace-pre-line">
              {result.synthesizedAnswer}
            </div>
          </div>

          {/* Author Perspective Cards */}
          <div>
            <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-3">
              Góc nhìn độc lập từ các tác phẩm trích dẫn
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {result.perspectives.map((p, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-white dark:bg-[#141822] border border-slate-200 dark:border-white/10 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h5 className="font-semibold text-sm line-clamp-1">{p.bookTitle}</h5>
                      <span className="text-xs text-indigo-600 dark:text-indigo-400">Tác giả: {p.author}</span>
                    </div>
                    <BookOpen className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  </div>
                  <ul className="space-y-1.5 mt-2">
                    {p.relevantExcerpts.map((excerpt, eIdx) => (
                      <li key={eIdx} className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                        • {excerpt}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

/**
 * -----------------------------------------------------------------------------
 * 2. Adaptive Spaced Repetition (SM-2) Deck
 * -----------------------------------------------------------------------------
 */
export function SpacedRepetitionDeck() {
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/spaced-repetition?action=due")
      .then((r) => r.json())
      .then((d) => d.ok && setData(d.data))
      .catch(console.error);

    fetch("/api/spaced-repetition?action=stats")
      .then((r) => r.json())
      .then((d) => d.ok && setStats(d.data))
      .catch(console.error);
  }, []);

  const cards = data?.cards || [];
  const currentCard = cards[currentIndex] || null;

  async function handleGrade(quality) {
    if (!currentCard || submitting) return;
    setSubmitting(true);
    try {
      await fetch("/api/spaced-repetition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: currentCard.id, quality }),
      });
      setFlipped(false);
      setCurrentIndex((prev) => prev + 1);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  }

  const grades = [
    { label: "Quên hẳn", score: 0, color: "hover:bg-red-500/20 text-red-600 dark:text-red-400" },
    { label: "Sai sót", score: 1, color: "hover:bg-orange-500/20 text-orange-600 dark:text-orange-400" },
    { label: "Khó", score: 3, color: "hover:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400" },
    { label: "Nhớ tốt", score: 4, color: "hover:bg-blue-500/20 text-blue-600 dark:text-blue-400" },
    { label: "Rất dễ", score: 5, color: "hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" },
  ];

  return (
    <div className="rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-[#10141D]/80 backdrop-blur-xl p-6 sm:p-8 shadow-sm">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl font-bold tracking-tight">Adaptive Spaced Repetition (SM-2)</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Ôn luyện ngắt quãng thích ứng · Lên lịch tự động 1d - 3d - 7d - 30d
            </p>
          </div>
        </div>

        {stats && (
          <div className="hidden sm:flex items-center gap-3 bg-slate-100 dark:bg-white/5 px-4 py-2 rounded-2xl border border-slate-200/60 dark:border-white/5">
            <div className="text-right">
              <span className="text-[10px] uppercase font-mono text-slate-400 block">Độ ghi nhớ dài hạn</span>
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{stats.retentionScore}</span>
            </div>
            <Award className="w-5 h-5 text-amber-500" />
          </div>
        )}
      </div>

      {/* Flashcard 3D Viewer */}
      {currentCard ? (
        <div className="space-y-5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>
              Thẻ {currentIndex + 1} / {cards.length} · Chương {currentCard.chapterNumber}: {currentCard.chapterTitle}
            </span>
            <span className="font-mono">Chu kỳ hiện tại: {currentCard.interval} ngày</span>
          </div>

          {/* Interactive Card */}
          <div
            onClick={() => setFlipped(!flipped)}
            className="min-h-[220px] p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-white to-slate-50 dark:from-[#141822] dark:to-[#0C0F17] border border-slate-200 dark:border-white/10 shadow-md cursor-pointer flex flex-col justify-between hover:border-indigo-500/50 transition-all select-none"
          >
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-500 block mb-2">
                {flipped ? "💡 ĐÁP ÁN & MẸO GHI NHỚ" : "❓ CÂU HỎI ACTIVE RECALL"}
              </span>
              <p className="text-base sm:text-lg font-medium text-slate-800 dark:text-slate-100 leading-relaxed">
                {flipped ? currentCard.answer : currentCard.question}
              </p>
            </div>

            {flipped && currentCard.tip && (
              <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-white/10 text-xs text-amber-600 dark:text-amber-400">
                ✨ Mẹo ghi nhớ: {currentCard.tip}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
              <span className="italic">Nhấn vào thẻ để lật mặt</span>
              <span className="text-slate-500">{currentCard.bookTitle}</span>
            </div>
          </div>

          {/* SM-2 Rating Buttons */}
          <div className="space-y-2">
            <span className="text-xs text-slate-400 block text-center">Đánh giá mức độ ghi nhớ để thuật toán SM-2 điều chỉnh lịch ôn:</span>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {grades.map((g) => (
                <button
                  key={g.score}
                  onClick={() => handleGrade(g.score)}
                  disabled={submitting}
                  className={`p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#141822] font-semibold text-xs transition-all cursor-pointer ${g.color}`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
          <h4 className="font-semibold text-sm">Tuyệt vời! Bạn đã hoàn thành toàn bộ thẻ ôn tập hôm nay.</h4>
          <p className="text-xs text-slate-500 mt-1">Các khái niệm tiếp theo sẽ tự động được lên lịch vào ngày mai.</p>
        </div>
      )}
    </div>
  );
}

/**
 * -----------------------------------------------------------------------------
 * 3. Action Engine (Habit & Directive Tracker)
 * -----------------------------------------------------------------------------
 */
export function ActionHabitTracker() {
  const [data, setData] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [activeItem, setActiveItem] = useState(null);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    fetch("/api/action-engine?action=items")
      .then((r) => r.json())
      .then((d) => d.ok && setData(d.data))
      .catch(console.error);

    fetch("/api/action-engine?action=metrics")
      .then((r) => r.json())
      .then((d) => d.ok && setMetrics(d.data))
      .catch(console.error);
  }, []);

  async function updateStatus(id, newStatus, customNotes) {
    try {
      await fetch("/api/action-engine", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId: id, status: newStatus, reflectionNotes: customNotes }),
      });
      // Refresh local state
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          actions: prev.actions.map((it) => (it.id === id ? { ...it, status: newStatus, reflectionNotes: customNotes } : it)),
        };
      });
      setActiveItem(null);
    } catch (e) {
      console.error(e);
    }
  }

  const actions = data?.actions || [];

  return (
    <div className="rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-[#10141D]/80 backdrop-blur-xl p-6 sm:p-8 shadow-sm">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl font-bold tracking-tight">Động cơ Hành động (Action Engine)</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Biến tri thức trong sách thành hành động thực tế ngoài đời
            </p>
          </div>
        </div>

        {metrics && (
          <div className="text-right">
            <span className="text-[10px] uppercase font-mono text-slate-400 block">Tỷ lệ thực thi</span>
            <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{metrics.executionRate}</span>
          </div>
        )}
      </div>

      {/* Action Items List */}
      <div className="space-y-3">
        {actions.map((item) => (
          <div
            key={item.id}
            className={`p-4 rounded-2xl border transition-all ${
              item.status === "COMPLETED"
                ? "bg-emerald-500/5 border-emerald-500/20 text-slate-500 dark:text-slate-400"
                : "bg-white dark:bg-[#141822] border-slate-200 dark:border-white/10"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400">
                    Bước {item.stepNumber}
                  </span>
                  <span className="text-xs text-indigo-600 dark:text-indigo-400">{item.bookTitle}</span>
                </div>
                <h4 className={`text-sm font-semibold ${item.status === "COMPLETED" ? "line-through text-slate-400" : ""}`}>
                  {item.action}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">💡 Mẹo thực thi: {item.practicalTips}</p>
                {item.reflectionNotes && (
                  <p className="text-xs italic text-emerald-600 dark:text-emerald-400 mt-1">
                    📝 Nhật ký thực tế: {item.reflectionNotes}
                  </p>
                )}
              </div>

              {/* Status Switcher */}
              <div className="shrink-0 flex items-center gap-1.5">
                {item.status !== "COMPLETED" ? (
                  <button
                    onClick={() => {
                      setActiveItem(item);
                      setNotes(item.reflectionNotes || "");
                    }}
                    className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs flex items-center gap-1 cursor-pointer transition-all"
                  >
                    <Check className="w-4 h-4" /> Hoàn thành
                  </button>
                ) : (
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Đã xong
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Reflection Modal */}
      {activeItem && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#141822] rounded-3xl p-6 max-w-md w-full border border-slate-200 dark:border-white/10 shadow-2xl space-y-4">
            <h4 className="font-bold text-base">Ghi chép kết quả áp dụng thực tế</h4>
            <p className="text-xs text-slate-500">Hành động: {activeItem.action}</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Bạn đã áp dụng việc này vào dự án hoặc công việc như thế nào? Kết quả ra sao?"
              className="w-full h-24 p-3 rounded-xl border border-slate-200 dark:border-white/10 text-xs bg-slate-50 dark:bg-white/5 focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setActiveItem(null)}
                className="px-3 py-1.5 rounded-xl border text-xs text-slate-500 cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={() => updateStatus(activeItem.id, "COMPLETED", notes)}
                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
              >
                Lưu & Đánh dấu hoàn thành
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

