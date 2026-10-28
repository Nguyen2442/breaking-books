"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import {
  ArrowLeft,
  Menu,
  X,
  Sun,
  Moon,
  Search,
  CheckCircle2,
  Clock,
  ChevronRight,
  BookOpen,
  Layers,
  StickyNote,
  Sparkles,
  ArrowUp,
  Type,
  AlignLeft,
} from "lucide-react";
import {
  CommandSearchModal,
  FlashcardsModal,
  NotesAndExportModal,
} from "@/components/LearningWorkspaceModals";
import {
  HighlightsAndNotesDrawer,
  ReaderPreferencesModal,
} from "@/components/ReaderToolSuite";
import {
  Highlighter,
  Sliders,
  BookmarkCheck,
  Minimize2,
} from "lucide-react";

export default function BookReaderLayout({ children }) {
  const params = useParams();
  const pathname = usePathname();
  const bookId = params?.bookId || "ddia-2e";
  const activeChNum = Number(params?.chNum || 1);

  const [book, setBook] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [isSerif, setIsSerif] = useState(false);
  const [readProgress, setReadProgress] = useState({ done: 0, total: 0, read: [] });
  const [activeTopicId, setActiveTopicId] = useState("");

  // Phase 4 & 5 Modals & Text Reading Suite
  const [cmdSearchOpen, setCmdSearchOpen] = useState(false);
  const [flashcardsOpen, setFlashcardsOpen] = useState(false);
  const [notesExportOpen, setNotesExportOpen] = useState(false);
  const [notesCount, setNotesCount] = useState(0);

  // Text & Reading Tools
  const [notesDrawerOpen, setNotesDrawerOpen] = useState(false);
  const [prefsModalOpen, setPrefsModalOpen] = useState(false);
  const [highlightsCount, setHighlightsCount] = useState(0);
  const [bookmarksList, setBookmarksList] = useState([]);
  const [focusMode, setFocusMode] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
    setIsSerif(document.documentElement.classList.contains("font-serif-mode"));

    // Check stored reader preferences
    try {
      const prefs = JSON.parse(localStorage.getItem("bb_reader_prefs") || "{}");
      if (prefs.fontSize) document.documentElement.style.setProperty("--reader-font-size", `${prefs.fontSize}px`);
      if (prefs.lineHeight) document.documentElement.style.setProperty("--reader-line-height", prefs.lineHeight);
      if (prefs.fontFamily === "serif") document.documentElement.classList.add("font-serif-mode");
      if (prefs.fontFamily === "mono") document.documentElement.classList.add("font-mono-mode");
      if (prefs.focusMode) {
        setFocusMode(true);
        document.body.classList.add("bb-focus-mode");
      }
    } catch {}

    fetch("/api/overview", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        const found =
          (data.books || []).find((b) => b.id === bookId) || data.books?.[0];
        if (found) setBook(found);
      })
      .catch(console.error);

    // Preload book-wide glossary so <dfn data-term> works across all chapters
    fetch(`/api/books/${bookId}/search-index`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (
          d.glossary &&
          typeof window !== "undefined" &&
          window.DDIA?.glossary?.add
        ) {
          window.DDIA.glossary.add(d.glossary);
        }
      })
      .catch(() => {});

    const refreshCounts = () => {
      try {
        const map = JSON.parse(localStorage.getItem(`${bookId}:notes`) || "{}");
        setNotesCount(Object.keys(map).length);

        const hl = JSON.parse(localStorage.getItem(`${bookId}:highlights`) || "[]");
        setHighlightsCount(hl.length);

        const bm = JSON.parse(localStorage.getItem(`${bookId}:bookmarks`) || "[]");
        setBookmarksList(bm);
      } catch {}
    };
    refreshCounts();

    const handlePrefs = (e) => {
      if (e.detail?.focusMode != null) setFocusMode(e.detail.focusMode);
    };

    window.addEventListener("bb:notes-updated", refreshCounts);
    window.addEventListener("bb:highlights-updated", refreshCounts);
    window.addEventListener("bb:bookmarks-updated", refreshCounts);
    window.addEventListener("bb:prefs-updated", handlePrefs);
    return () => {
      window.removeEventListener("bb:notes-updated", refreshCounts);
      window.removeEventListener("bb:highlights-updated", refreshCounts);
      window.removeEventListener("bb:bookmarks-updated", refreshCounts);
      window.removeEventListener("bb:prefs-updated", handlePrefs);
    };
  }, [bookId]);

  // Global Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    function onKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdSearchOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Listen for custom progress events emitted by the chapter page
  useEffect(() => {
    function handleProgress(e) {
      if (e.detail) {
        setReadProgress(e.detail);
      }
    }
    window.addEventListener("bb-progress-change", handleProgress);
    return () =>
      window.removeEventListener("bb-progress-change", handleProgress);
  }, []);

  // Lightweight Passive IntersectionObserver for Right Sidebar ("Trong chương này")
  // Never calls scrollIntoView — zero wheel lag!
  useEffect(() => {
    const timer = setTimeout(() => {
      const articles = document.querySelectorAll(".bb-chapter-reader article.topic");
      if (!articles.length) return;
      setActiveTopicId(articles[0].id);

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              setActiveTopicId(entry.target.id);
              break;
            }
          }
        },
        { rootMargin: "-80px 0px -65% 0px", threshold: 0 }
      );
      articles.forEach((a) => observer.observe(a));
      return () => observer.disconnect();
    }, 250);
    return () => clearTimeout(timer);
  }, [pathname, activeChNum]);

  useEffect(() => {
    try {
      localStorage.setItem(`${bookId}:lastCh`, JSON.stringify(activeChNum));
    } catch {}
  }, [bookId, activeChNum]);

  // Close mobile drawer when route changes
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("bb_theme", next ? "dark" : "light");
    } catch {}
  }

  function toggleFontMode() {
    const next = !isSerif;
    setIsSerif(next);
    document.documentElement.classList.toggle("font-serif-mode", next);
    try {
      localStorage.setItem("bb_font", next ? "serif" : "sans");
    } catch {}
  }

  const chapters = book?.chapters || [];
  const activeChapter = chapters.find((c) => c.num === activeChNum);
  const activeTopics = activeChapter?.topics || [];
  const readSet = useMemo(
    () => new Set(readProgress.read || []),
    [readProgress.read]
  );

  // Group chapters by Part for Mintlify-style left navigation
  const groupedParts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = chapters.filter((ch) => {
      if (!q) return true;
      return (
        ch.title?.toLowerCase().includes(q) ||
        ch.en?.toLowerCase().includes(q) ||
        `chương ${ch.num}`.includes(q) ||
        (ch.topics || []).some((t) => t.title?.toLowerCase().includes(q))
      );
    });

    const groups = [];
    const map = new Map();
    // A chapter without its own part belongs to the part of the chapter before it
    let lastPart = "Danh sách chương";
    const partOf = new Map(chapters.map((ch) => [ch.num, (lastPart = ch.part || lastPart)]));
    for (const ch of filtered) {
      const partName = partOf.get(ch.num);
      if (!map.has(partName)) {
        const g = { part: partName, chapters: [] };
        map.set(partName, g);
        groups.push(g);
      }
      map.get(partName).chapters.push(ch);
    }
    return groups;
  }, [chapters, searchQuery]);

  const pct =
    readProgress.total > 0
      ? Math.round((readProgress.done / readProgress.total) * 100)
      : 0;

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#090D16] text-slate-900 dark:text-slate-100">
      {/* =====================================================================
          MINTLIFY / STRIPE DOCS TOP STICKY NAVBAR
         ===================================================================== */}
      <header className="sticky top-0 z-40 h-14 bg-white/95 dark:bg-[#090D16]/95 border-b border-slate-200/80 dark:border-white/[0.08]">
        <div className="max-w-[1480px] mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4">
          {/* Left: mobile table of contents + back to library + where am I */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden inline-flex items-center gap-1.5 h-9 px-2.5 rounded-lg border border-slate-200 dark:border-white/10 text-sm text-slate-700 dark:text-slate-200 cursor-pointer"
              aria-label="Mở mục lục"
            >
              <Menu className="w-4 h-4" />
              <span className="hidden sm:inline">Mục lục</span>
            </button>

            <Link
              href="/"
              className="inline-flex items-center gap-1.5 h-9 px-2.5 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Thư viện</span>
            </Link>

            <div className="hidden sm:flex items-center gap-1.5 text-sm min-w-0">
              <span className="text-slate-400 shrink-0">/</span>
              <span className="text-slate-600 dark:text-slate-300 truncate max-w-[220px]">
                {book?.subtitle || book?.shortTitle || ""}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="font-semibold text-teal-700 dark:text-teal-400 shrink-0">
                Chương {activeChNum}
              </span>
            </div>
          </div>

          {/* Right: labelled actions & Text Reading Suite */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={() => setCmdSearchOpen(true)}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 dark:border-white/10 text-sm text-slate-700 dark:text-slate-200 hover:border-teal-500/60 cursor-pointer"
              title="Tìm trong cả cuốn sách (⌘K)"
            >
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">Tìm</span>
            </button>

            {/* Highlights & Notes Drawer Button */}
            <button
              onClick={() => setNotesDrawerOpen(true)}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 dark:border-white/10 text-sm text-slate-700 dark:text-slate-200 hover:border-teal-500/60 cursor-pointer"
              title="Xem toàn bộ Highlight, Ghi chú & Đánh dấu bài học"
            >
              <Highlighter className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span className="hidden md:inline">Ghi chú & Highlight</span>
              {highlightsCount + notesCount + bookmarksList.length > 0 && (
                <span className="text-[11px] font-mono px-1.5 py-0.2 rounded-full bg-teal-500/15 text-teal-700 dark:text-teal-300 font-bold">
                  {highlightsCount + notesCount + bookmarksList.length}
                </span>
              )}
            </button>

            {/* Reader Preferences (Font Size, Spacing, Zen mode) */}
            <button
              onClick={() => setPrefsModalOpen(true)}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 dark:border-white/10 text-sm text-slate-700 dark:text-slate-200 hover:border-teal-500/60 cursor-pointer"
              title="Tùy biến cỡ chữ, độ dãn dòng, phông chữ & chế độ tập trung"
            >
              <Sliders className="w-4 h-4 text-slate-500" />
              <span className="hidden lg:inline">Hiển thị</span>
            </button>

            <MenuButton icon={Layers} label="Ôn tập">
              <MenuItem onClick={() => setFlashcardsOpen(true)}>Thẻ ghi nhớ thuật ngữ</MenuItem>
              <MenuItem onClick={() => setNotesExportOpen(true)}>
                Tải bản trọn gói Offline / Anki
              </MenuItem>
            </MenuButton>

            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-teal-500/60 cursor-pointer"
              title="Đổi giao diện Sáng / Tối"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* =====================================================================
          3-COLUMN MINTLIFY / STRIPE DOCS BODY (With Zen/Focus Mode Support)
         ===================================================================== */}
      <div className={`w-full mx-auto flex-1 flex items-start ${focusMode ? "max-w-[960px] justify-center" : "max-w-[1480px]"}`}>
        {/* Mobile Sidebar Backdrop */}
        {sidebarOpen && !focusMode && (
          <div
            className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* COLUMN 1: LEFT CHAPTER SIDEBAR (Hidden in Focus Mode) */}
        {!focusMode && (
          <aside
            aria-label="Mục lục sách"
            className={`fixed lg:sticky top-14 left-0 z-50 lg:z-20 h-[calc(100vh-3.5rem)] w-72 shrink-0 bg-white dark:bg-[#090D16] border-r border-slate-200/80 dark:border-white/[0.07] flex flex-col transition-transform duration-200 ease-out ${
              sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
            }`}
          >
            <div className="p-3.5 border-b border-slate-200/70 dark:border-white/[0.06] flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Mục lục</span>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden inline-flex items-center gap-1 h-8 px-2 rounded-lg text-sm text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
                Đóng
              </button>
            </div>

            {/* Part-grouped Chapter List */}
            <nav className="flex-1 overflow-y-auto px-4 py-5 space-y-7">
              {groupedParts.map((group) => (
                <div key={group.part}>
                  <div className="px-2.5 mb-2.5 text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 leading-snug">
                    {group.part}
                  </div>
                  <div className="space-y-1.5 border-l border-slate-200 dark:border-white/[0.08] ml-2 pl-2.5">
                    {group.chapters.map((ch) => {
                      const isCurrent = ch.num === activeChNum;
                      return (
                        <Link
                          key={ch.num}
                          href={`/books/${bookId}/ch/${ch.num}`}
                          className={`group relative flex items-start justify-between gap-2.5 px-3 py-2.5 rounded-xl text-[13px] transition-all ${
                            isCurrent
                              ? "bg-teal-500/10 dark:bg-teal-400/10 text-teal-700 dark:text-teal-300 font-semibold"
                              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/[0.04]"
                          }`}
                        >
                          {isCurrent && (
                            <span className="absolute -left-[11px] top-2 bottom-2 w-[2.5px] rounded-full bg-teal-600 dark:bg-teal-400" />
                          )}
                          <div className="flex items-start gap-2.5 min-w-0">
                            <span
                              className={`font-mono text-[11px] mt-0.5 shrink-0 ${
                                isCurrent
                                  ? "text-teal-600 dark:text-teal-400 font-bold"
                                  : "text-slate-400 dark:text-slate-500"
                              }`}
                            >
                              {String(ch.num).padStart(2, "0")}
                            </span>
                            <span className="leading-relaxed">
                              {ch.title}
                            </span>
                          </div>
                          {ch.status !== "complete" && (
                            <span className="text-[11px] px-1.5 py-0.5 rounded shrink-0 mt-0.5 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                              Đang soạn
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            {/* Reading Progress Footer */}
            <div className="p-3.5 border-t border-slate-100 dark:border-white/[0.07] bg-white dark:bg-[#090D16]">
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1.5">
                <span className="font-medium">Tiến độ Chương {activeChNum}</span>
                <span className="font-mono font-semibold text-teal-600 dark:text-teal-400">
                  {readProgress.done}/{readProgress.total} ({pct}%)
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-teal-500 to-indigo-500 transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </aside>
        )}

        {/* COLUMN 2: CENTER ARTICLE CONTENT */}
        <main className={`flex-1 min-w-0 px-4 sm:px-8 py-8 sm:py-10 ${focusMode ? "max-w-[880px] mx-auto" : "lg:px-12"}`}>
          {children}
        </main>

        {/* COLUMN 3: RIGHT STICKY "ON THIS PAGE / TRONG CHƯƠNG NÀY" TOC (Hidden in Focus Mode) */}
        {!focusMode && (
          <aside className="hidden xl:block w-72 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto py-8 pr-6 pl-4">
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-900 dark:text-slate-200 mb-3.5">
                  <div className="flex items-center gap-2">
                    <AlignLeft className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                    <span>Trong chương này</span>
                  </div>
                  {bookmarksList.length > 0 && (
                    <button
                      onClick={() => setNotesDrawerOpen(true)}
                      className="text-[10px] font-mono text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
                    >
                      {bookmarksList.length} ghim
                    </button>
                  )}
                </div>

                {activeTopics.length === 0 ? (
                  <p className="text-xs text-slate-400">Đang tải mục lục...</p>
                ) : (
                  <div className="relative border-l border-slate-200 dark:border-white/[0.08] space-y-1.5">
                    {activeTopics.map((t) => {
                      const isActive = activeTopicId === t.id;
                      const isDone = readSet.has(t.id);
                      const isBm = bookmarksList.some((b) => b.topicId === t.id);
                      return (
                        <a
                          key={t.id}
                          href={`#${t.id}`}
                          onClick={() => setActiveTopicId(t.id)}
                          className={`group relative flex items-start justify-between gap-2.5 pl-4 pr-2 py-2 text-[13px] transition-colors ${
                            isActive
                              ? "text-teal-600 dark:text-teal-400 font-semibold"
                              : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                          }`}
                        >
                          {isActive && (
                            <span className="absolute -left-[1.5px] top-1.5 bottom-1.5 w-[2.5px] bg-teal-600 dark:bg-teal-400 rounded-full" />
                          )}
                          <div className="flex items-start gap-2 min-w-0 leading-relaxed">
                            <span className="font-mono text-[11px] opacity-75 shrink-0 mt-0.5">
                              {t.num}
                            </span>
                            <span>{t.title}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 mt-0.5">
                            {isBm && (
                              <span title="Đã đánh dấu bài này" className="text-xs">🔖</span>
                            )}
                            {isDone && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            )}
                          </div>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
              >
                <ArrowUp className="w-3.5 h-3.5" />
                <span>Lên đầu chương</span>
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* Floating Exit Focus Mode Button */}
      {focusMode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
          <button
            onClick={() => {
              setFocusMode(false);
              document.body.classList.remove("bb-focus-mode");
              try {
                const p = JSON.parse(localStorage.getItem("bb_reader_prefs") || "{}");
                localStorage.setItem("bb_reader_prefs", JSON.stringify({ ...p, focusMode: false }));
              } catch {}
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/90 dark:bg-white/90 text-white dark:text-slate-900 text-xs font-semibold shadow-xl border border-white/20 hover:scale-105 transition-all cursor-pointer"
          >
            <Minimize2 className="w-3.5 h-3.5" />
            <span>Thoát chế độ tập trung (Hiện lại mục lục)</span>
          </button>
        </div>
      )}

      {/* Text Reading Suite Drawers & Modals */}
      <HighlightsAndNotesDrawer
        bookId={bookId}
        open={notesDrawerOpen}
        onClose={() => setNotesDrawerOpen(false)}
      />
      <ReaderPreferencesModal
        open={prefsModalOpen}
        onClose={() => setPrefsModalOpen(false)}
      />

      {/* Phase 4 & 5 Workspace Modals */}
      <CommandSearchModal
        bookId={bookId}
        open={cmdSearchOpen}
        onClose={() => setCmdSearchOpen(false)}
      />
      <FlashcardsModal
        bookId={bookId}
        open={flashcardsOpen}
        onClose={() => setFlashcardsOpen(false)}
      />
      <NotesAndExportModal
        bookId={bookId}
        open={notesExportOpen}
        onClose={() => setNotesExportOpen(false)}
      />
    </div>
  );
}

function MenuButton({ icon: Icon, label, children }) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 dark:border-white/10 text-sm text-slate-700 dark:text-slate-200 hover:border-teal-500/60 cursor-pointer"
      >
        <Icon className="w-4 h-4" />
        <span className="hidden sm:inline">{label}</span>
      </button>
      {open && (
        <div
          role="menu"
          onClick={() => setOpen(false)}
          className="absolute right-0 top-11 z-50 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0F1623] shadow-lg p-1.5"
        >
          {children}
        </div>
      )}
    </div>
  );
}

function MenuItem({ onClick, children }) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] cursor-pointer"
    >
      {children}
    </button>
  );
}
