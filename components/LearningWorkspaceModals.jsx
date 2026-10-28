"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  X,
  BookOpen,
  Cpu,
  Sparkles,
  FileText,
  Download,
  RotateCcw,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  Layers,
  StickyNote,
  Trash2,
  ArrowUpRight,
} from "lucide-react";

export function CommandSearchModal({ bookId = "ddia-2e", open, onClose }) {
  const router = useRouter();
  const [indexData, setIndexData] = useState(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setTimeout(() => inputRef.current?.focus(), 40);
    fetch(`/api/books/${bookId}/search-index`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setIndexData(d);
      })
      .catch(console.error);
  }, [open, bookId]);

  const results = useMemo(() => {
    const items = indexData?.items || [];
    const q = query.trim().toLowerCase();
    return items
      .filter((it) => {
        if (typeFilter !== "all" && it.type !== typeFilter) return false;
        if (!q) return true;
        return (
          it.title?.toLowerCase().includes(q) ||
          it.subtitle?.toLowerCase().includes(q) ||
          it.snippet?.toLowerCase().includes(q) ||
          it.num?.toLowerCase().includes(q)
        );
      })
      .slice(0, 35);
  }, [indexData, query, typeFilter]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, typeFilter]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e) {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, Math.max(0, results.length - 1)));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && results[selectedIndex]) {
        e.preventDefault();
        const target = results[selectedIndex];
        onClose();
        router.push(target.url);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, results, selectedIndex, onClose, router]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/45 flex items-start justify-center pt-16 sm:pt-24 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: -8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl rounded-2xl bg-white dark:bg-[#14171C] border border-black/[0.08] dark:border-white/[0.1] overflow-hidden shadow-2xl"
          >
            {/* Search Input Bar */}
            <div className="p-4 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center gap-3">
              <Search className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm kiếm chủ đề, thuật ngữ (LSM, Raft, MVCC...), hoặc mô phỏng SVG..."
                className="flex-1 bg-transparent text-sm focus:outline-none text-zinc-900 dark:text-zinc-100"
              />
              <kbd className="hidden sm:inline-block text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                ESC
              </kbd>
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Category Filter Pills */}
            <div className="px-4 py-2.5 bg-[#FAF9F5] dark:bg-[#0D0F12] border-b border-black/[0.05] dark:border-white/[0.06] flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                {[
                  { id: "all", label: "Tất cả" },
                  { id: "topic", label: "Chủ đề" },
                  { id: "lab", label: "Mô phỏng SVG" },
                  { id: "term", label: "Thuật ngữ" },
                  { id: "chapter", label: "Chương" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setTypeFilter(tab.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      typeFilter === tab.id
                        ? "bg-indigo-600 text-white"
                        : "text-zinc-600 dark:text-zinc-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <span className="text-[11px] font-mono text-zinc-400">
                {indexData ? `${indexData.totalItems} mục đã lập chỉ mục` : "Đang tải..."}
              </span>
            </div>

            {/* Results List */}
            <div className="max-h-[420px] overflow-y-auto divide-y divide-black/[0.04] dark:divide-white/[0.05]">
              {results.length === 0 ? (
                <div className="py-14 text-center text-xs text-zinc-400">
                  Không tìm thấy kết quả phù hợp với &ldquo;{query}&rdquo;.
                </div>
              ) : (
                results.map((item, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      onClick={() => {
                        onClose();
                        router.push(item.url);
                      }}
                      className={`w-full text-left px-4 py-3 flex items-start justify-between gap-3 transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-indigo-500/10 dark:bg-indigo-500/15"
                          : "hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded font-medium ${
                              item.type === "lab"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : item.type === "term"
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                            }`}
                          >
                            {item.num || item.type}
                          </span>
                          <span className="text-sm font-semibold truncate text-zinc-900 dark:text-zinc-100">
                            {item.title}
                          </span>
                        </div>
                        {item.snippet && (
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1 mt-1">
                            {item.snippet}
                          </p>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-zinc-400 shrink-0 mt-0.5">
                        Ch.{item.chNum}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer Hints */}
            <div className="px-4 py-2.5 bg-[#FAF9F5] dark:bg-[#0D0F12] border-t border-black/[0.05] dark:border-white/[0.06] flex items-center justify-between text-[11px] text-zinc-400">
              <span>Dùng phím ↑ ↓ để chọn, Enter để mở bài học</span>
              <span className="font-mono">Cmd + K</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function FlashcardsModal({ bookId = "ddia-2e", open, onClose }) {
  const [glossary, setGlossary] = useState([]);
  const [chFilter, setChFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all"); // all | review | mastered
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [masteredSet, setMasteredSet] = useState(new Set());

  const storageKey = `${bookId}:flashcards-mastered`;

  useEffect(() => {
    if (!open) return;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
      setMasteredSet(new Set(saved));
    } catch {}

    fetch(`/api/books/${bookId}/search-index`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.glossary) setGlossary(d.glossary);
      })
      .catch(console.error);
  }, [open, bookId, storageKey]);

  const filteredCards = useMemo(() => {
    return glossary.filter((g) => {
      if (chFilter !== "all" && g.ch !== Number(chFilter)) return false;
      if (statusFilter === "mastered" && !masteredSet.has(g.key)) return false;
      if (statusFilter === "review" && masteredSet.has(g.key)) return false;
      return true;
    });
  }, [glossary, chFilter, statusFilter, masteredSet]);

  useEffect(() => {
    setCurrentIndex(0);
    setFlipped(false);
  }, [chFilter, statusFilter]);

  const currentCard = filteredCards[currentIndex] || null;

  function toggleMastered(key) {
    const next = new Set(masteredSet);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setMasteredSet(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify([...next]));
    } catch {}
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-3xl bg-white dark:bg-[#14171C] border border-black/[0.08] dark:border-white/[0.1] p-6 sm:p-8"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <span className="text-xs font-mono uppercase text-indigo-600 dark:text-indigo-400">
                  Phase 4 · Active Recall & Spaced Repetition
                </span>
                <h3 className="text-lg font-semibold mt-0.5">
                  Flashcards Thuật ngữ Song ngữ ({glossary.length} thẻ)
                </h3>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-1.5">
                {[
                  { id: "all", label: `Tất cả (${glossary.length})` },
                  {
                    id: "review",
                    label: `Cần ôn (${Math.max(0, glossary.length - masteredSet.size)})`,
                  },
                  { id: "mastered", label: `Đã thuộc (${masteredSet.size})` },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setStatusFilter(t.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer ${
                      statusFilter === t.id
                        ? "bg-indigo-600 text-white"
                        : "bg-[#FAF9F5] dark:bg-[#0D0F12] text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <select
                value={chFilter}
                onChange={(e) => setChFilter(e.target.value)}
                className="text-xs rounded-xl px-3 py-1.5 bg-[#FAF9F5] dark:bg-[#0D0F12] border border-black/[0.08] dark:border-white/[0.1]"
              >
                <option value="all">Mọi chương</option>
                {Array.from({ length: 13 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    Chương {n}
                  </option>
                ))}
              </select>
            </div>

            {/* Flashcard Box */}
            {!currentCard ? (
              <div className="h-64 rounded-2xl bg-[#FAF9F5] dark:bg-[#0D0F12] border border-black/[0.06] dark:border-white/[0.07] flex items-center justify-center text-xs text-zinc-400">
                Không có thẻ nào trong bộ lọc này.
              </div>
            ) : (
              <div
                onClick={() => setFlipped(!flipped)}
                className="min-h-[250px] rounded-2xl bg-[#FAF9F5] dark:bg-[#0D0F12] border border-black/[0.08] dark:border-white/[0.09] hover:border-indigo-500/40 p-8 flex flex-col justify-between cursor-pointer select-none transition-all"
              >
                <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                  <span>
                    CHƯƠNG {currentCard.ch} · THẺ {currentIndex + 1}/
                    {filteredCards.length}
                  </span>
                  <span>{flipped ? "MẶT SAU (ĐỊNH NGHĨA)" : "MẶT TRƯỚC (THUẬT NGỮ)"}</span>
                </div>

                <div className="my-6 text-center space-y-2">
                  {!flipped ? (
                    <>
                      <div className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                        {currentCard.term}
                      </div>
                      {currentCard.vi && (
                        <div className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">
                          {currentCard.vi}
                        </div>
                      )}
                      <p className="text-[11px] text-zinc-400 pt-3">
                        (Bấm vào thẻ để lật xem giải nghĩa chi tiết)
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                        {currentCard.term} — {currentCard.vi}
                      </div>
                      <p className="text-sm sm:text-base text-zinc-700 dark:text-zinc-200 leading-relaxed max-w-md mx-auto">
                        {currentCard.def}
                      </p>
                    </>
                  )}
                </div>

                <div
                  className="flex items-center justify-between pt-3 border-t border-black/[0.05] dark:border-white/[0.06]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => toggleMastered(currentCard.key)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer ${
                      masteredSet.has(currentCard.key)
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                        : "bg-white dark:bg-[#14171C] border border-black/[0.08] dark:border-white/[0.08] text-zinc-600 dark:text-zinc-300"
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      {masteredSet.has(currentCard.key)
                        ? "Đã thuộc thẻ này"
                        : "Đánh dấu Đã thuộc"}
                    </span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setFlipped(false);
                        setCurrentIndex((i) =>
                          i > 0 ? i - 1 : filteredCards.length - 1
                        );
                      }}
                      className="p-2 rounded-xl bg-white dark:bg-[#14171C] border border-black/[0.08] dark:border-white/[0.08] cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setFlipped(false);
                        setCurrentIndex((i) =>
                          i + 1 < filteredCards.length ? i + 1 : 0
                        );
                      }}
                      className="p-2 rounded-xl bg-white dark:bg-[#14171C] border border-black/[0.08] dark:border-white/[0.08] cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Footer Export to Anki */}
            <div className="mt-5 pt-4 border-t border-black/[0.06] dark:border-white/[0.07] flex items-center justify-between gap-2">
              <span className="text-xs text-zinc-500">
                Xuất toàn bộ thuật ngữ sang phần mềm Anki:
              </span>
              <a
                href={`/api/books/${bookId}/export?format=anki`}
                download
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Tải Anki Deck (.tsv)</span>
              </a>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function NotesAndExportModal({ bookId = "ddia-2e", open, onClose }) {
  const router = useRouter();
  const [notesMap, setNotesMap] = useState({});
  const [exporting, setExporting] = useState(false);
  const [exportReport, setExportReport] = useState(null);

  const notesKey = `${bookId}:notes`;

  useEffect(() => {
    if (!open) return;
    try {
      setNotesMap(JSON.parse(localStorage.getItem(notesKey) || "{}"));
    } catch {}
  }, [open, notesKey]);

  const notesList = Object.values(notesMap).sort(
    (a, b) => (a.chNum || 1) - (b.chNum || 1)
  );

  function deleteNote(id) {
    const next = { ...notesMap };
    delete next[id];
    setNotesMap(next);
    try {
      localStorage.setItem(notesKey, JSON.stringify(next));
    } catch {}
    window.dispatchEvent(new CustomEvent("bb:notes-updated", { detail: { notes: next } }));
  }

  function downloadPersonalNotesMarkdown() {
    const lines = [
      `# Sổ tay Ghi chú Cá nhân — ${bookId}`,
      `> Xuất ngày: ${new Date().toLocaleString("vi-VN")}`,
      ``,
    ];
    for (const n of notesList) {
      lines.push(`## Chương ${n.chNum} · ${n.num || ""} ${n.title || n.id}`);
      lines.push(n.text);
      lines.push(``);
    }
    const blob = new Blob([lines.join("\n")], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${bookId}-personal-notes.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function runFullBuildAndExport() {
    setExporting(true);
    try {
      const res = await fetch(`/api/books/${bookId}/export`, { method: "POST" });
      const data = await res.json();
      if (data.ok) setExportReport(data);
    } catch (e) {
      console.error(e);
    } finally {
      setExporting(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl rounded-3xl bg-white dark:bg-[#14171C] border border-black/[0.08] dark:border-white/[0.1] p-6 sm:p-8 max-h-[88vh] flex flex-col justify-between"
          >
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
              <div>
                <span className="text-xs font-mono uppercase text-indigo-600 dark:text-indigo-400">
                  Phase 4 & 5 · Sổ tay Ghi chú & Xuất bản Sách (Publisher)
                </span>
                <h3 className="text-lg font-semibold mt-0.5">
                  Ghi chú cá nhân ({notesList.length}) & Đóng gói Web Book
                </h3>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="my-5 flex-1 overflow-y-auto space-y-6 pr-1">
              {/* Section 1: Personal Topic Notes */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-mono uppercase tracking-wider text-zinc-500">
                    1. Ghi chú của bạn trên từng mục bài học
                  </h4>
                  {notesList.length > 0 && (
                    <button
                      onClick={downloadPersonalNotesMarkdown}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Tải ghi chú (.md)</span>
                    </button>
                  )}
                </div>

                {notesList.length === 0 ? (
                  <div className="p-5 rounded-2xl bg-[#FAF9F5] dark:bg-[#0D0F12] border border-black/[0.05] dark:border-white/[0.06] text-xs text-zinc-500">
                    Bạn chưa có ghi chú nào. Khi đọc bất kỳ chương nào, hãy bấm nút{" "}
                    <b>+ Ghi chú</b> ở cuối mỗi mục để lưu lại ý chính hoặc câu hỏi
                    của riêng bạn.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {notesList.map((n) => (
                      <div
                        key={n.id}
                        className="p-4 rounded-2xl bg-[#FAF9F5] dark:bg-[#0D0F12] border border-black/[0.06] dark:border-white/[0.07] flex items-start justify-between gap-3"
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <button
                            onClick={() => {
                              onClose();
                              router.push(`/books/${bookId}/ch/${n.chNum}#${n.id}`);
                            }}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                          >
                            <span>
                              Chương {n.chNum} · {n.num} {n.title}
                            </span>
                            <ArrowUpRight className="w-3 h-3" />
                          </button>
                          <p className="text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                            {n.text}
                          </p>
                        </div>
                        <button
                          onClick={() => deleteNote(n.id)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 cursor-pointer"
                          title="Xoá ghi chú"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 2: Phase 5 Static Export & Study Pack Publisher */}
              <div className="pt-4 border-t border-black/[0.06] dark:border-white/[0.08]">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-xs font-mono uppercase tracking-wider text-zinc-500">
                      2. Xuất bản & Đóng gói Sách độc lập (Phase 5 Publisher)
                    </h4>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Đóng gói toàn bộ cuốn sách thành 1 file HTML duy nhất chạy
                      offline hoặc tải bộ Study Guide & Anki Flashcards.
                    </p>
                  </div>
                  <button
                    onClick={runFullBuildAndExport}
                    disabled={exporting}
                    className="px-3.5 py-2 rounded-xl text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    {exporting ? "Đang kiểm tra & đóng gói..." : "Kiểm tra & Build lại"}
                  </button>
                </div>

                {exportReport && (
                  <div className="mb-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-300">
                    ✓ Đã kiểm tra cú pháp & đóng gói thành công:{" "}
                    <b>
                      {exportReport.book.completeCount}/
                      {exportReport.book.totalChapters} chương hoàn chỉnh
                    </b>{" "}
                    · {exportReport.book.totalWidgets} SVG widgets ·{" "}
                    {exportReport.files.ankiCount} thẻ Anki.
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <a
                    href={`/api/books/${bookId}/export?format=html`}
                    download
                    className="p-4 rounded-2xl bg-[#FAF9F5] dark:bg-[#0D0F12] border border-black/[0.06] dark:border-white/[0.08] hover:border-indigo-500/40 transition-colors flex flex-col justify-between gap-2"
                  >
                    <div className="text-xs font-semibold">
                      📦 Standalone Web Book (.html)
                    </div>
                    <p className="text-[11px] text-zinc-500">
                      1 file HTML độc lập chứa trọn bộ chương & SVG chạy không cần
                      server.
                    </p>
                    <span className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400">
                      Tải xuống →
                    </span>
                  </a>

                  <a
                    href={`/api/books/${bookId}/export?format=markdown`}
                    download
                    className="p-4 rounded-2xl bg-[#FAF9F5] dark:bg-[#0D0F12] border border-black/[0.06] dark:border-white/[0.08] hover:border-indigo-500/40 transition-colors flex flex-col justify-between gap-2"
                  >
                    <div className="text-xs font-semibold">
                      📄 Study Guide Tóm tắt (.md)
                    </div>
                    <p className="text-[11px] text-zinc-500">
                      Tổng hợp mọi TL;DR, lưu ý thực tế và từ điển thuật ngữ của 13
                      chương.
                    </p>
                    <span className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400">
                      Tải xuống →
                    </span>
                  </a>

                  <a
                    href={`/api/books/${bookId}/export?format=anki`}
                    download
                    className="p-4 rounded-2xl bg-[#FAF9F5] dark:bg-[#0D0F12] border border-black/[0.06] dark:border-white/[0.08] hover:border-indigo-500/40 transition-colors flex flex-col justify-between gap-2"
                  >
                    <div className="text-xs font-semibold">
                      🗂️ Bộ thẻ Anki (.tsv)
                    </div>
                    <p className="text-[11px] text-zinc-500">
                      Import trực tiếp vào Anki Desktop / AnkiMobile để ôn tập ngắt
                      quãng.
                    </p>
                    <span className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400">
                      Tải xuống →
                    </span>
                  </a>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
