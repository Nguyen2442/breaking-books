"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Highlighter,
  Bookmark,
  BookmarkCheck,
  StickyNote,
  Sliders,
  Copy,
  Trash2,
  Check,
  X,
  ExternalLink,
  Download,
  Search,
  Maximize2,
  Minimize2,
  Sun,
  Moon,
  Type,
  AlignLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";

export const HIGHLIGHT_COLORS = [
  { id: "yellow", name: "Vàng", bg: "bg-amber-400", border: "border-amber-500", markClass: "bb-highlight-yellow" },
  { id: "green", name: "Xanh lá", bg: "bg-emerald-400", border: "border-emerald-500", markClass: "bb-highlight-green" },
  { id: "blue", name: "Xanh dương", bg: "bg-sky-400", border: "border-sky-500", markClass: "bb-highlight-blue" },
  { id: "purple", name: "Tím", bg: "bg-purple-400", border: "border-purple-500", markClass: "bb-highlight-purple" },
  { id: "coral", name: "Cam / Đỏ", bg: "bg-rose-400", border: "border-rose-500", markClass: "bb-highlight-coral" },
];

/* ==========================================================================
   1. FLOATING TEXT HIGHLIGHTER & ANNOTATION TOOLBAR
   ========================================================================== */
export function FloatingTextHighlighter({ bookId, chNum, containerRef }) {
  const [floatingPos, setFloatingPos] = useState(null);
  const [selectedText, setSelectedText] = useState("");
  const [selectedRange, setSelectedRange] = useState(null);
  const [activeHighlight, setActiveHighlight] = useState(null); // When clicking an existing mark
  const [activeMarkEl, setActiveMarkEl] = useState(null);
  const [popoverPos, setPopoverPos] = useState(null);
  const [editingNote, setEditingNote] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [copied, setCopied] = useState(false);

  // Load existing highlights onto DOM whenever chapter reloads
  const restoreHighlights = useCallback(() => {
    if (!containerRef.current) return;
    try {
      const raw = localStorage.getItem(`${bookId}:highlights`);
      if (!raw) return;
      const list = JSON.parse(raw);
      const chHighlights = list.filter((h) => Number(h.chNum) === Number(chNum));

      chHighlights.forEach((h) => {
        // If already rendered on DOM, skip
        if (containerRef.current.querySelector(`mark[data-highlight-id="${h.id}"]`)) return;

        // Search ONLY inside the topic where the user made the highlight
        const topicRoot = (h.topicId && containerRef.current.querySelector(`#${h.topicId}`)) || containerRef.current;

        const walker = document.createTreeWalker(
          topicRoot,
          NodeFilter.SHOW_TEXT,
          null,
          false
        );

        let node;
        let matched = false;
        while ((node = walker.nextNode()) && !matched) {
          if (!node.textContent || node.parentElement?.closest("mark.bb-highlight")) continue;

          let startSearch = 0;
          while (startSearch < node.textContent.length) {
            const idx = node.textContent.indexOf(h.text, startSearch);
            if (idx === -1) break;

            // Context check if prefix/suffix were stored
            let isContextMatch = true;
            if (h.prefix && h.prefix.length >= 4) {
              const beforeText = node.textContent.slice(Math.max(0, idx - h.prefix.length), idx);
              const anchor = h.prefix.slice(-6);
              if (!beforeText.includes(anchor)) {
                isContextMatch = false;
              }
            }

            if (isContextMatch) {
              try {
                const range = document.createRange();
                range.setStart(node, idx);
                range.setEnd(node, idx + h.text.length);

                const mark = document.createElement("mark");
                mark.className = `bb-highlight bb-highlight-${h.color || "yellow"}`;
                mark.dataset.highlightId = h.id;
                mark.dataset.color = h.color;
                if (h.note) mark.dataset.hasNote = "true";

                range.surroundContents(mark);
                matched = true;
                break;
              } catch (e) {
                // If surroundContents fails on split node, use extractContents
                try {
                  const range = document.createRange();
                  range.setStart(node, idx);
                  range.setEnd(node, idx + h.text.length);
                  const mark = document.createElement("mark");
                  mark.className = `bb-highlight bb-highlight-${h.color || "yellow"}`;
                  mark.dataset.highlightId = h.id;
                  mark.dataset.color = h.color;
                  if (h.note) mark.dataset.hasNote = "true";
                  const frag = range.extractContents();
                  mark.appendChild(frag);
                  range.insertNode(mark);
                  matched = true;
                  break;
                } catch {}
              }
            }
            startSearch = idx + 1;
          }
        }
      });
    } catch (e) {
      console.warn("restoreHighlights failed", e);
    }
  }, [bookId, chNum, containerRef]);

  useEffect(() => {
    const timer = setTimeout(restoreHighlights, 300);
    return () => clearTimeout(timer);
  }, [restoreHighlights]);

  // Listen for selection changes inside container
  useEffect(() => {
    function handleMouseUp(e) {
      // If clicking inside floating toolbar or popover, don't clear
      if (e.target.closest(".bb-floating-toolbar") || e.target.closest(".bb-highlight-popover")) {
        return;
      }

      // Check if clicked on an existing mark
      const clickedMark = e.target.closest("mark.bb-highlight");
      if (clickedMark) {
        const id = clickedMark.dataset.highlightId;
        const raw = localStorage.getItem(`${bookId}:highlights`);
        const list = raw ? JSON.parse(raw) : [];
        const item = list.find((x) => x.id === id);
        if (item) {
          const rect = clickedMark.getBoundingClientRect();
          setPopoverPos({
            top: rect.bottom + window.scrollY + 8,
            left: Math.max(16, Math.min(rect.left + window.scrollX, window.innerWidth - 320)),
          });
          setActiveHighlight(item);
          setActiveMarkEl(clickedMark);
          setNoteText(item.note || "");
          setEditingNote(false);
          setFloatingPos(null);
          return;
        }
      } else {
        setActiveHighlight(null);
        setActiveMarkEl(null);
      }

      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        setFloatingPos(null);
        setSelectedText("");
        setSelectedRange(null);
        return;
      }

      const text = sel.toString().trim();
      if (text.length < 2) {
        setFloatingPos(null);
        return;
      }

      // Ensure selection is inside the reader container
      if (!containerRef.current || !containerRef.current.contains(sel.anchorNode)) {
        setFloatingPos(null);
        return;
      }

      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      setSelectedText(text);
      setSelectedRange(range.cloneRange());
      setFloatingPos({
        top: Math.max(10, rect.top + window.scrollY - 54),
        left: Math.max(16, Math.min(rect.left + rect.width / 2 + window.scrollX - 140, window.innerWidth - 300)),
      });
    }

    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, [bookId, containerRef]);

  // Expand range to full word boundaries if user selected partial word accidentally
  function expandToFullWord() {
    if (!selectedRange) return;
    try {
      const range = selectedRange.cloneRange();
      const node = range.startContainer;
      if (node && node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent;
        let start = range.startOffset;
        let end = range.endOffset;
        // Expand backwards to word boundary
        while (start > 0 && /\S/.test(text[start - 1])) {
          start--;
        }
        // Expand forwards to word boundary
        while (end < text.length && /\S/.test(text[end])) {
          end++;
        }
        range.setStart(node, start);
        range.setEnd(node, end);
        const newText = text.slice(start, end).trim();
        setSelectedText(newText);
        setSelectedRange(range);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    } catch (e) {
      console.warn("expandToFullWord failed", e);
    }
  }

  // Safe wrapper for Range to avoid surroundContents DOMException on split nodes
  function wrapRange(range, mark) {
    try {
      range.surroundContents(mark);
    } catch {
      const frag = range.extractContents();
      mark.appendChild(frag);
      range.insertNode(mark);
    }
  }

  // Apply highlight with selected color
  function applyHighlight(colorId) {
    if (!selectedRange || !selectedText) return;

    const id = `hl_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const topicEl = selectedRange.startContainer.parentElement?.closest("article.topic");
    const topicId = topicEl?.id || `ch${chNum}`;
    const topicTitle = topicEl?.querySelector("h2")?.textContent?.trim() || `Chương ${chNum}`;

    const startNode = selectedRange.startContainer;
    const fullText = startNode?.textContent || "";
    const prefix = fullText.slice(Math.max(0, selectedRange.startOffset - 25), selectedRange.startOffset);
    const suffix = fullText.slice(selectedRange.endOffset, selectedRange.endOffset + 25);

    const newHl = {
      id,
      bookId,
      chNum: Number(chNum),
      topicId,
      topicTitle,
      color: colorId,
      text: selectedText,
      prefix,
      suffix,
      note: noteText.trim(),
      createdAt: new Date().toISOString(),
    };

    try {
      const raw = localStorage.getItem(`${bookId}:highlights`);
      const list = raw ? JSON.parse(raw) : [];
      list.unshift(newHl);
      localStorage.setItem(`${bookId}:highlights`, JSON.stringify(list));

      // Wrap selection in mark tag using safe wrapper
      const mark = document.createElement("mark");
      mark.className = `bb-highlight bb-highlight-${colorId}`;
      mark.dataset.highlightId = id;
      mark.dataset.color = colorId;
      if (noteText.trim()) mark.dataset.hasNote = "true";

      wrapRange(selectedRange, mark);
      window.getSelection()?.removeAllRanges();

      window.dispatchEvent(new CustomEvent("bb:highlights-updated", { detail: { count: list.length } }));
    } catch (e) {
      console.error("Failed to highlight", e);
    } finally {
      setFloatingPos(null);
      setSelectedText("");
      setSelectedRange(null);
      setEditingNote(false);
      setNoteText("");
    }
  }

  // Delete an existing highlight
  function deleteHighlight(id) {
    try {
      const raw = localStorage.getItem(`${bookId}:highlights`);
      const list = raw ? JSON.parse(raw) : [];
      const filtered = list.filter((x) => x.id !== id);
      localStorage.setItem(`${bookId}:highlights`, JSON.stringify(filtered));

      if (activeMarkEl) {
        const parent = activeMarkEl.parentNode;
        while (activeMarkEl.firstChild) {
          parent.insertBefore(activeMarkEl.firstChild, activeMarkEl);
        }
        parent.removeChild(activeMarkEl);
      }

      window.dispatchEvent(new CustomEvent("bb:highlights-updated", { detail: { count: filtered.length } }));
    } catch (e) {
      console.error(e);
    } finally {
      setActiveHighlight(null);
      setActiveMarkEl(null);
      setPopoverPos(null);
    }
  }

  // Update existing highlight's color or note
  function updateHighlight(updates) {
    if (!activeHighlight) return;
    try {
      const raw = localStorage.getItem(`${bookId}:highlights`);
      const list = raw ? JSON.parse(raw) : [];
      const updatedList = list.map((item) => {
        if (item.id === activeHighlight.id) {
          return { ...item, ...updates, updatedAt: new Date().toISOString() };
        }
        return item;
      });
      localStorage.setItem(`${bookId}:highlights`, JSON.stringify(updatedList));

      if (activeMarkEl) {
        if (updates.color) {
          activeMarkEl.className = `bb-highlight bb-highlight-${updates.color}`;
          activeMarkEl.dataset.color = updates.color;
        }
        if (updates.note !== undefined) {
          activeMarkEl.dataset.hasNote = updates.note ? "true" : "false";
        }
      }

      setActiveHighlight((prev) => ({ ...prev, ...updates }));
      window.dispatchEvent(new CustomEvent("bb:highlights-updated", { detail: { count: updatedList.length } }));
    } catch (e) {
      console.error(e);
    }
  }

  function copyCitation(text) {
    const citation = `> "${text}"\n— [Trích từ Chương ${chNum} · ${bookId}]`;
    navigator.clipboard.writeText(citation);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      {/* Floating Toolbar on Text Selection */}
      <AnimatePresence>
        {floatingPos && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 6 }}
            transition={{ duration: 0.15 }}
            style={{ top: floatingPos.top, left: floatingPos.left }}
            className="bb-floating-toolbar fixed z-50 rounded-2xl bg-slate-900/95 dark:bg-[#0F1623]/95 backdrop-blur-md border border-white/15 shadow-2xl p-2 flex flex-col gap-2 min-w-[290px] max-w-[360px]"
          >
            {/* Top Selection Info Bar: Shows exact selection with Expand option */}
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 px-1 pb-1 border-b border-white/10 gap-2">
              <span className="truncate" title={selectedText}>
                Đoạn chọn: <b className="text-white">"{selectedText.length > 24 ? selectedText.slice(0, 24) + '...' : selectedText}"</b>
              </span>
              <button
                onClick={expandToFullWord}
                className="text-[10px] font-semibold text-teal-400 hover:text-teal-300 hover:underline cursor-pointer flex items-center gap-0.5 shrink-0 bg-teal-500/10 px-1.5 py-0.5 rounded border border-teal-500/20"
                title="Mở rộng để lấy trọn vẹn cả từ (ví dụ lỡ chọn thiếu chữ)"
              >
                <span>⚡ Mở rộng cả từ</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 px-1">
              {/* Color options */}
              <div className="flex items-center gap-1.5 pr-2 border-r border-white/10">
                {HIGHLIGHT_COLORS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => applyHighlight(c.id)}
                    title={`Highlight màu ${c.name}`}
                    className={`w-6 h-6 rounded-full ${c.bg} hover:scale-115 active:scale-95 transition-transform cursor-pointer border border-white/20`}
                  />
                ))}
              </div>

              {/* Note toggle */}
              <button
                onClick={() => setEditingNote((v) => !v)}
                className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                  editingNote ? "bg-teal-500 text-white" : "text-slate-300 hover:text-white hover:bg-white/10"
                }`}
                title="Gắn ghi chú vào đoạn này"
              >
                <StickyNote className="w-3.5 h-3.5" />
                <span className="text-[11px]">Ghi chú</span>
              </button>

              {/* Copy Quote */}
              <button
                onClick={() => copyCitation(selectedText)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Sao chép trích dẫn"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>

              {/* Close */}
              <button
                onClick={() => {
                  setFloatingPos(null);
                  setSelectedText("");
                  setSelectedRange(null);
                  window.getSelection()?.removeAllRanges();
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer ml-auto"
                title="Bỏ chọn (✕)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Note input expandable section */}
            {editingNote && (
              <div className="pt-1.5 border-t border-white/10 px-1 space-y-2">
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Nhập ghi chú hoặc suy nghĩ của bạn..."
                  rows={2}
                  className="w-full text-xs text-slate-100 bg-white/10 rounded-xl p-2 border border-white/15 focus:outline-none focus:border-teal-400 placeholder-slate-400"
                  autoFocus
                />
                <div className="flex justify-end gap-1.5 pb-1">
                  <button
                    onClick={() => applyHighlight("yellow")}
                    className="px-3 py-1 rounded-lg text-xs font-semibold bg-teal-500 hover:bg-teal-400 text-white cursor-pointer"
                  >
                    Lưu highlight & ghi chú
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Popover on Existing Highlight Click */}
      <AnimatePresence>
        {activeHighlight && popoverPos && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 4 }}
            transition={{ duration: 0.15 }}
            style={{ top: popoverPos.top, left: popoverPos.left }}
            className="bb-highlight-popover fixed z-50 w-80 rounded-2xl bg-white dark:bg-[#0F1623] border border-slate-200 dark:border-white/10 shadow-2xl p-4 text-slate-900 dark:text-slate-100 space-y-3"
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-white/10 pb-2.5">
              <span className="text-xs font-mono font-semibold text-slate-400">
                ĐOẠN ĐÃ HIGHLIGHT
              </span>
              <div className="flex items-center gap-1.5">
                {HIGHLIGHT_COLORS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => updateHighlight({ color: c.id })}
                    className={`w-4 h-4 rounded-full ${c.bg} cursor-pointer border ${
                      activeHighlight.color === c.id ? "ring-2 ring-teal-500 ring-offset-1" : "opacity-60 hover:opacity-100"
                    }`}
                  />
                ))}
                <button
                  onClick={() => deleteHighlight(activeHighlight.id)}
                  className="p-1 rounded-lg text-rose-500 hover:bg-rose-500/10 cursor-pointer ml-1"
                  title="Xoá highlight"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setActiveHighlight(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 italic line-clamp-3 bg-slate-50 dark:bg-[#090D16] p-2 rounded-lg border border-slate-200/60 dark:border-white/5">
              "{activeHighlight.text}"
            </p>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span>Ghi chú của bạn:</span>
                {activeHighlight.note && (
                  <span className="text-[10px] text-teal-600 dark:text-teal-400">✓ Đã lưu</span>
                )}
              </label>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Thêm ghi chú cá nhân cho đoạn trích này..."
                rows={2}
                className="w-full text-xs bg-slate-50 dark:bg-[#090D16] rounded-xl p-2.5 border border-slate-200 dark:border-white/10 focus:outline-none focus:border-teal-500"
              />
              <div className="flex justify-between items-center pt-1">
                <button
                  onClick={() => copyCitation(activeHighlight.text)}
                  className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy trích dẫn</span>
                </button>
                <button
                  onClick={() => {
                    updateHighlight({ note: noteText.trim() });
                    setActiveHighlight(null);
                  }}
                  className="px-3 py-1 rounded-lg text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white cursor-pointer"
                >
                  Lưu
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ==========================================================================
   2. TOPIC BOOKMARK BUTTON COMPONENT
   ========================================================================== */
export function TopicBookmarkButton({ bookId, chNum, topicId, topicTitle }) {
  const [isBookmarked, setIsBookmarked] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`${bookId}:bookmarks`);
      const set = raw ? JSON.parse(raw) : [];
      setIsBookmarked(set.some((b) => b.topicId === topicId));
    } catch {}
  }, [bookId, topicId]);

  function toggleBookmark() {
    try {
      const raw = localStorage.getItem(`${bookId}:bookmarks`);
      let list = raw ? JSON.parse(raw) : [];
      const exists = list.some((b) => b.topicId === topicId);

      if (exists) {
        list = list.filter((b) => b.topicId !== topicId);
        setIsBookmarked(false);
      } else {
        list.push({
          bookId,
          chNum: Number(chNum),
          topicId,
          topicTitle: topicTitle || topicId,
          bookmarkedAt: new Date().toISOString(),
        });
        setIsBookmarked(true);
      }
      localStorage.setItem(`${bookId}:bookmarks`, JSON.stringify(list));
      window.dispatchEvent(new CustomEvent("bb:bookmarks-updated", { detail: { count: list.length } }));
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <button
      type="button"
      onClick={toggleBookmark}
      aria-pressed={isBookmarked}
      className={`topic-bookmark-btn ${isBookmarked ? "text-teal-600 border-teal-500 font-semibold" : ""}`}
      title={isBookmarked ? "Bỏ đánh dấu bài học này" : "Đánh dấu vị trí / bài học quan trọng này"}
    >
      {isBookmarked ? (
        <>
          <BookmarkCheck className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
          <span>Đã đánh dấu</span>
        </>
      ) : (
        <>
          <Bookmark className="w-3.5 h-3.5" />
          <span>Đánh dấu</span>
        </>
      )}
    </button>
  );
}

/* ==========================================================================
   3. READER PREFERENCES MODAL (Cỡ chữ, Font, Độ thoáng dòng, Focus mode)
   ========================================================================== */
export function ReaderPreferencesModal({ open, onClose }) {
  const [fontSize, setFontSize] = useState("17");
  const [lineHeight, setLineHeight] = useState("1.88");
  const [fontFamily, setFontFamily] = useState("sans");
  const [focusMode, setFocusMode] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("bb_reader_prefs");
      if (raw) {
        const p = JSON.parse(raw);
        if (p.fontSize) setFontSize(p.fontSize);
        if (p.lineHeight) setLineHeight(p.lineHeight);
        if (p.fontFamily) setFontFamily(p.fontFamily);
        if (p.focusMode != null) setFocusMode(p.focusMode);
      }
    } catch {}
  }, []);

  function applySettings(fs, lh, ff, fm) {
    setFontSize(fs);
    setLineHeight(lh);
    setFontFamily(ff);
    setFocusMode(fm);

    document.documentElement.style.setProperty("--reader-font-size", `${fs}px`);
    document.documentElement.style.setProperty("--reader-line-height", lh);
    document.documentElement.classList.toggle("font-serif-mode", ff === "serif");
    document.documentElement.classList.toggle("font-mono-mode", ff === "mono");
    document.body.classList.toggle("bb-focus-mode", fm);

    try {
      localStorage.setItem(
        "bb_reader_prefs",
        JSON.stringify({ fontSize: fs, lineHeight: lh, fontFamily: ff, focusMode: fm })
      );
      window.dispatchEvent(new CustomEvent("bb:prefs-updated", { detail: { focusMode: fm } }));
    } catch {}
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-white dark:bg-[#0F1623] border border-slate-200 dark:border-white/10 shadow-2xl p-6 space-y-6"
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Tùy biến hiển thị văn bản</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 1. Font Size */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Cỡ chữ văn bản</label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { id: "15", label: "Nhỏ (15px)" },
              { id: "17", label: "Vừa (17px)" },
              { id: "19", label: "Lớn (19px)" },
              { id: "21", label: "Cực lớn (21px)" },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => applySettings(opt.id, lineHeight, fontFamily, focusMode)}
                className={`py-2 px-1 text-xs rounded-xl font-medium border transition-colors cursor-pointer text-center ${
                  fontSize === opt.id
                    ? "bg-teal-500/15 border-teal-500 text-teal-700 dark:text-teal-300 font-bold"
                    : "border-slate-200 dark:border-white/10 hover:border-teal-500/40 text-slate-600 dark:text-slate-400"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Line Height */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Độ thoáng dòng (Line Spacing)</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "1.7", label: "Gọn gàng (1.7)" },
              { id: "1.88", label: "Chuẩn thoáng (1.9)" },
              { id: "2.15", label: "Rất thoáng (2.2)" },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => applySettings(fontSize, opt.id, fontFamily, focusMode)}
                className={`py-2 px-2 text-xs rounded-xl font-medium border transition-colors cursor-pointer text-center ${
                  lineHeight === opt.id
                    ? "bg-teal-500/15 border-teal-500 text-teal-700 dark:text-teal-300 font-bold"
                    : "border-slate-200 dark:border-white/10 hover:border-teal-500/40 text-slate-600 dark:text-slate-400"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Font Family */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Phông chữ</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "sans", label: "Sans (Hiện đại)", font: "font-sans" },
              { id: "serif", label: "Serif (Sách in)", font: "font-serif" },
              { id: "mono", label: "Mono (Kỹ thuật)", font: "font-mono" },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => applySettings(fontSize, lineHeight, opt.id, focusMode)}
                className={`py-2.5 px-2 text-xs rounded-xl border transition-colors cursor-pointer text-center ${opt.font} ${
                  fontFamily === opt.id
                    ? "bg-teal-500/15 border-teal-500 text-teal-700 dark:text-teal-300 font-bold"
                    : "border-slate-200 dark:border-white/10 hover:border-teal-500/40 text-slate-600 dark:text-slate-400"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 4. Focus Mode Toggle */}
        <div className="pt-2 border-t border-slate-100 dark:border-white/10 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">Chế độ tập trung (Zen Mode)</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Ẩn 2 sidebar trái/phải để đọc tập trung 100%</div>
          </div>
          <button
            onClick={() => applySettings(fontSize, lineHeight, fontFamily, !focusMode)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
              focusMode
                ? "bg-teal-600 text-white border-teal-600"
                : "border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-teal-500/50"
            }`}
          >
            {focusMode ? "Đang BẬT" : "Đang TẮT"}
          </button>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white transition-colors cursor-pointer"
          >
            Xong
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ==========================================================================
   4. HIGHLIGHTS & NOTES DRAWER (Ngăn quản lý toàn diện Highlight, Note & Bookmark)
   ========================================================================== */
export function HighlightsAndNotesDrawer({ bookId, open, onClose }) {
  const [activeTab, setActiveTab] = useState("highlights"); // "highlights" | "notes" | "bookmarks"
  const [highlights, setHighlights] = useState([]);
  const [notes, setNotes] = useState({});
  const [bookmarks, setBookmarks] = useState([]);
  const [filterColor, setFilterColor] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const refreshData = useCallback(() => {
    try {
      const hlRaw = localStorage.getItem(`${bookId}:highlights`);
      setHighlights(hlRaw ? JSON.parse(hlRaw) : []);

      const notesRaw = localStorage.getItem(`${bookId}:notes`);
      setNotes(notesRaw ? JSON.parse(notesRaw) : {});

      const bmRaw = localStorage.getItem(`${bookId}:bookmarks`);
      setBookmarks(bmRaw ? JSON.parse(bmRaw) : []);
    } catch {}
  }, [bookId]);

  useEffect(() => {
    if (open) refreshData();
  }, [open, refreshData]);

  // Filtered Highlights
  const filteredHighlights = highlights.filter((h) => {
    if (filterColor !== "all" && h.color !== filterColor) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        h.text?.toLowerCase().includes(q) ||
        h.note?.toLowerCase().includes(q) ||
        h.topicTitle?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Filtered Notes
  const notesList = Object.values(notes).filter((n) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return n.text?.toLowerCase().includes(q) || n.title?.toLowerCase().includes(q);
    }
    return true;
  });

  // Export all highlights, notes & bookmarks to Markdown
  function exportMarkdown() {
    let md = `# Sổ tay Ghi chú & Trích dẫn — ${bookId}\n`;
    md += `*Xuất bản lúc: ${new Date().toLocaleString("vi-VN")}*\n\n---\n\n`;

    md += `## 🖍️ Các đoạn trích dẫn nổi bật (${highlights.length})\n\n`;
    if (highlights.length === 0) {
      md += `*Chưa có highlight nào.*\n\n`;
    } else {
      highlights.forEach((h, i) => {
        md += `### ${i + 1}. [Chương ${h.chNum} · ${h.topicTitle || h.topicId}]\n`;
        md += `> "${h.text}"\n\n`;
        if (h.note) md += `**Ghi chú cá nhân:** ${h.note}\n\n`;
        md += `*Màu: ${h.color} · Ngày lưu: ${new Date(h.createdAt).toLocaleDateString("vi-VN")}*\n\n---\n\n`;
      });
    }

    md += `## 📝 Ghi chú bài học (${Object.keys(notes).length})\n\n`;
    if (Object.keys(notes).length === 0) {
      md += `*Chưa có ghi chú bài học nào.*\n\n`;
    } else {
      Object.values(notes).forEach((n, i) => {
        md += `### ${i + 1}. [Chương ${n.chNum} · ${n.num} ${n.title}]\n`;
        md += `${n.text}\n\n---\n\n`;
      });
    }

    md += `## 🔖 Danh sách bài học đã đánh dấu (${bookmarks.length})\n\n`;
    bookmarks.forEach((b) => {
      md += `- [x] Chương ${b.chNum} · ${b.topicTitle} (#${b.topicId})\n`;
    });

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `notes-and-highlights-${bookId}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function deleteHl(id) {
    const next = highlights.filter((x) => x.id !== id);
    setHighlights(next);
    localStorage.setItem(`${bookId}:highlights`, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("bb:highlights-updated", { detail: { count: next.length } }));
  }

  function deleteBm(topicId) {
    const next = bookmarks.filter((x) => x.topicId !== topicId);
    setBookmarks(next);
    localStorage.setItem(`${bookId}:bookmarks`, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("bb:bookmarks-updated", { detail: { count: next.length } }));
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex justify-end" onClick={onClose}>
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.22 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl h-full bg-white dark:bg-[#0F1623] border-l border-slate-200 dark:border-white/10 p-6 flex flex-col justify-between shadow-2xl"
          >
            {/* Header */}
            <div>
              <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-white/10 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
                    <Highlighter className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Highlight, Ghi chú & Đánh dấu
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Toàn bộ kiến thức cá nhân đã lưu trên sách này
                    </p>
                  </div>
                </div>
                <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Tab navigation pills */}
              <div className="flex items-center gap-2 mt-4 p-1 rounded-xl bg-slate-100 dark:bg-[#090D16] border border-slate-200/80 dark:border-white/5">
                <button
                  onClick={() => setActiveTab("highlights")}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    activeTab === "highlights"
                      ? "bg-white dark:bg-[#1E293B] text-teal-600 dark:text-teal-400 shadow-xs"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  Highlights ({highlights.length})
                </button>
                <button
                  onClick={() => setActiveTab("notes")}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    activeTab === "notes"
                      ? "bg-white dark:bg-[#1E293B] text-teal-600 dark:text-teal-400 shadow-xs"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  Ghi chú ({Object.keys(notes).length})
                </button>
                <button
                  onClick={() => setActiveTab("bookmarks")}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    activeTab === "bookmarks"
                      ? "bg-white dark:bg-[#1E293B] text-teal-600 dark:text-teal-400 shadow-xs"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  Đánh dấu ({bookmarks.length})
                </button>
              </div>

              {/* Search & Filter Bar */}
              <div className="mt-4 flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm trong trích dẫn & ghi chú..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-[#090D16] border border-slate-200 dark:border-white/10 focus:outline-none focus:border-teal-500"
                  />
                </div>

                {activeTab === "highlights" && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setFilterColor("all")}
                      className={`text-[10px] font-semibold px-2 py-1.5 rounded-lg border cursor-pointer ${
                        filterColor === "all"
                          ? "bg-teal-500/15 border-teal-500 text-teal-600 dark:text-teal-400"
                          : "border-slate-200 dark:border-white/10 text-slate-500"
                      }`}
                    >
                      Tất cả
                    </button>
                    {HIGHLIGHT_COLORS.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setFilterColor(c.id)}
                        className={`w-5 h-5 rounded-full ${c.bg} border cursor-pointer ${
                          filterColor === c.id ? "ring-2 ring-teal-500" : "opacity-60 hover:opacity-100"
                        }`}
                        title={c.name}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Middle Scrollable Content List */}
            <div className="flex-1 overflow-y-auto my-4 space-y-3.5 pr-1">
              {activeTab === "highlights" && (
                <>
                  {filteredHighlights.length === 0 ? (
                    <div className="py-16 text-center text-xs text-slate-400 space-y-1">
                      <p>Chưa có đoạn highlight nào được lưu.</p>
                      <p className="text-[11px] text-slate-500">
                        Bôi đen bất kỳ đoạn văn nào trong sách để hiện thanh công cụ highlight!
                      </p>
                    </div>
                  ) : (
                    filteredHighlights.map((h) => (
                      <div
                        key={h.id}
                        className="rounded-xl p-3.5 bg-slate-50 dark:bg-[#090D16] border border-slate-200/80 dark:border-white/10 space-y-2 hover:border-teal-500/40 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-mono font-semibold text-teal-600 dark:text-teal-400 truncate">
                            Chương {h.chNum} · {h.topicTitle || h.topicId}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={`w-3 h-3 rounded-full ${HIGHLIGHT_COLORS.find((c) => c.id === h.color)?.bg || "bg-amber-400"}`} />
                            <button
                              onClick={() => deleteHl(h.id)}
                              className="p-1 rounded text-slate-400 hover:text-rose-500 cursor-pointer"
                              title="Xoá highlight này"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <p className="text-xs text-slate-700 dark:text-slate-300 italic pl-2.5 border-l-2 border-teal-500/50 leading-relaxed">
                          "{h.text}"
                        </p>

                        {h.note && (
                          <div className="text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-[#151E2E] p-2.5 rounded-lg border border-slate-200/60 dark:border-white/5 space-y-0.5">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                              Ghi chú cá nhân:
                            </span>
                            <p>{h.note}</p>
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400 font-mono">
                          <span>{new Date(h.createdAt).toLocaleDateString("vi-VN")}</span>
                          <a
                            href={`/books/${bookId}/ch/${h.chNum}#${h.topicId}`}
                            onClick={onClose}
                            className="inline-flex items-center gap-1 text-teal-600 dark:text-teal-400 hover:underline"
                          >
                            <span>Mở đoạn này</span>
                            <ChevronRight className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}

              {activeTab === "notes" && (
                <>
                  {notesList.length === 0 ? (
                    <div className="py-16 text-center text-xs text-slate-400 space-y-1">
                      <p>Chưa có ghi chú bài học nào.</p>
                      <p className="text-[11px] text-slate-500">
                        Bấm nút “+ Ghi chú” ở cuối mỗi bài học để viết suy nghĩ cá nhân.
                      </p>
                    </div>
                  ) : (
                    notesList.map((n) => (
                      <div
                        key={n.id}
                        className="rounded-xl p-3.5 bg-slate-50 dark:bg-[#090D16] border border-slate-200/80 dark:border-white/10 space-y-2 hover:border-teal-500/40 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-mono font-semibold text-teal-600 dark:text-teal-400">
                            Chương {n.chNum} · {n.num} {n.title}
                          </span>
                        </div>
                        <p className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                          {n.text}
                        </p>
                        <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400 font-mono">
                          <span>{n.updatedAt ? new Date(n.updatedAt).toLocaleDateString("vi-VN") : ""}</span>
                          <a
                            href={`/books/${bookId}/ch/${n.chNum}#${n.id}`}
                            onClick={onClose}
                            className="inline-flex items-center gap-1 text-teal-600 dark:text-teal-400 hover:underline"
                          >
                            <span>Tới bài học</span>
                            <ChevronRight className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}

              {activeTab === "bookmarks" && (
                <>
                  {bookmarks.length === 0 ? (
                    <div className="py-16 text-center text-xs text-slate-400 space-y-1">
                      <p>Chưa có bài học nào được đánh dấu.</p>
                      <p className="text-[11px] text-slate-500">
                        Bấm nút “Đánh dấu” trên đầu bài học hoặc trong mục lục để ghim bài học yêu thích!
                      </p>
                    </div>
                  ) : (
                    bookmarks.map((b) => (
                      <div
                        key={b.topicId}
                        className="rounded-xl p-3.5 bg-slate-50 dark:bg-[#090D16] border border-slate-200/80 dark:border-white/10 flex items-center justify-between gap-3 hover:border-teal-500/40 transition-colors"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <BookmarkCheck className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                              {b.topicTitle}
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-slate-400">
                            Chương {b.chNum} · #{b.topicId}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <a
                            href={`/books/${bookId}/ch/${b.chNum}#${b.topicId}`}
                            onClick={onClose}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-teal-600 text-white hover:bg-teal-500"
                          >
                            Đọc tiếp
                          </a>
                          <button
                            onClick={() => deleteBm(b.topicId)}
                            className="p-1 rounded text-slate-400 hover:text-rose-500 cursor-pointer"
                            title="Bỏ đánh dấu"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}
            </div>

            {/* Footer: Export Button */}
            <div className="pt-4 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-400 font-mono">
                Tổng: {highlights.length} highlight · {Object.keys(notes).length} ghi chú
              </span>
              <button
                onClick={exportMarkdown}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white transition-colors cursor-pointer shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Xuất file Markdown (.md)</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
