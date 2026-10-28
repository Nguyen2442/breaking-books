"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Sparkles,
  Terminal,
  Copy,
  Check,
  Plus,
  Moon,
  Sun,
  ArrowUpRight,
  Layers,
  Cpu,
  FileText,
  X,
  Play,
  Square,
  RefreshCw,
  CheckCircle2,
  Clock,
  Search,
  Download,
  HelpCircle,
  ChevronRight,
} from "lucide-react";
import {
  CommandSearchModal,
  FlashcardsModal,
  NotesAndExportModal,
} from "@/components/LearningWorkspaceModals";

function buildPromptForChapter(book, ch) {
  const bookDir = `/Users/elysion/Developments/breaking-books/${book.id}`;
  return `Bạn đang làm việc trong project Breaking Books tại thư mục \`${bookDir}\`.
Hãy đọc kỹ hướng dẫn thiết kế tại \`${bookDir}/CONTRACT.md\` và văn bản gốc của Chương ${ch.num} tại \`${bookDir}/text/ch${ch.num}.txt\`.

Nhiệm vụ:
1. Kiểm tra hiện trạng của \`${bookDir}/src/ch${ch.num}.html\` (${ch.topicCount} topics hiện có) và \`${bookDir}/src/ch${ch.num}.js\` (${ch.svgCount} SVG widgets hiện có).
2. Break trọn vẹn Chương ${ch.num}: "${ch.title}" (${ch.subtitle || ""}) thành các mục kiến thức dễ đọc (TL;DR + Kiến thức cốt lõi + Ví dụ trực quan + Callout thực tế + Quiz cuối chương).
3. Trong \`src/ch${ch.num}.js\`, dùng các helper \`window.DDIA\` để vẽ sơ đồ SVG tương tác cho toàn bộ các thẻ \`<figure class="lab" data-widget="...">\`.`;
}

export default function StudioPage() {
  const router = useRouter();
  const [overview, setOverview] = useState(null);
  const [selectedBookId, setSelectedBookId] = useState("ddia-2e");
  const [selectedPart, setSelectedPart] = useState("all");
  const [isDark, setIsDark] = useState(false);

  // Modals & Drawers
  const [promptModalCh, setPromptModalCh] = useState(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [newBookModalOpen, setNewBookModalOpen] = useState(false);
  const [cliDrawerOpen, setCliDrawerOpen] = useState(false);
  const [cmdSearchOpen, setCmdSearchOpen] = useState(false);
  const [flashcardsOpen, setFlashcardsOpen] = useState(false);
  const [notesExportOpen, setNotesExportOpen] = useState(false);

  // Jobs & CLI state
  const [jobs, setJobs] = useState({});
  const [activeJobId, setActiveJobId] = useState(null);
  const logEndRef = useRef(null);

  // New Book Form state
  const [newBookTitle, setNewBookTitle] = useState("");
  const [newBookId, setNewBookId] = useState("");
  const [newBookAuthor, setNewBookAuthor] = useState("");
  const [newBookSubtitle, setNewBookSubtitle] = useState("");
  const [newBookPdfPath, setNewBookPdfPath] = useState("");
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [creatingBook, setCreatingBook] = useState(false);
  const [createBookError, setCreateBookError] = useState("");

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
    try {
      const savedBook = localStorage.getItem("bb_selected_book");
      if (savedBook) setSelectedBookId(savedBook);
    } catch {}
    fetchOverview();
  }, []);

  function selectBook(bookId) {
    setSelectedBookId(bookId);
    setSelectedPart("all");
    try {
      localStorage.setItem("bb_selected_book", bookId);
    } catch {}
  }

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

  useEffect(() => {
    if (!cliDrawerOpen) return;
    const es = new EventSource("/api/jobs/stream");
    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "snapshot") {
          const map = {};
          (msg.jobs || []).forEach((j) => {
            map[j.id] = j;
          });
          setJobs(map);
        } else if (msg.type === "job-start" || msg.type === "job-end") {
          setJobs((prev) => ({
            ...prev,
            [msg.job.id]: { ...(prev[msg.job.id] || {}), ...msg.job },
          }));
          setActiveJobId((cur) => cur || msg.job.id);
          fetchOverview();
        } else if (msg.type === "job-log") {
          setJobs((prev) => {
            const existing = prev[msg.jobId] || { id: msg.jobId, logs: [] };
            return {
              ...prev,
              [msg.jobId]: {
                ...existing,
                logs: [...(existing.logs || []), msg.line].slice(-300),
              },
            };
          });
        }
      } catch {}
    };
    return () => es.close();
  }, [cliDrawerOpen]);

  async function fetchOverview() {
    try {
      const res = await fetch("/api/overview", { cache: "no-store" });
      const data = await res.json();
      setOverview(data);
      if (data.books?.length && !data.books.some((b) => b.id === selectedBookId)) {
        setSelectedBookId(data.books[0].id);
      }
    } catch (e) {
      console.error("Failed to fetch overview", e);
    }
  }

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("bb_theme", next ? "dark" : "light");
    } catch {}
  }

  const currentBook =
    overview?.books?.find((b) => b.id === selectedBookId) ||
    overview?.books?.[0] ||
    null;

  const bookParts = useMemo(() => {
    if (!currentBook?.chapters) return [];
    const set = new Set();
    currentBook.chapters.forEach((c) => {
      if (c.part) set.add(c.part);
    });
    return [...set];
  }, [currentBook]);

  const filteredChapters = (currentBook?.chapters || []).filter((ch) => {
    if (selectedPart === "all") return true;
    return ch.part === selectedPart;
  });

  async function startAiJob(chNum, mode = "complete") {
    if (!currentBook) return;
    setCliDrawerOpen(true);
    try {
      const res = await fetch("/api/jobs/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: currentBook.id,
          chapter: chNum,
          mode,
        }),
      });
      const data = await res.json();
      if (data.job) {
        setJobs((prev) => ({ ...prev, [data.job.id]: data.job }));
        setActiveJobId(data.job.id);
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function breakAllPendingChapters() {
    if (!currentBook) return;
    const pending = (currentBook.chapters || []).filter(
      (c) => c.status !== "complete"
    );
    const targets = pending.length > 0 ? pending : currentBook.chapters || [];
    for (const ch of targets) {
      await startAiJob(ch.num, "complete");
    }
  }

  async function stopAiJob(jobId) {
    try {
      await fetch(`/api/jobs/${jobId}/stop`, { method: "POST" });
    } catch {}
  }

  async function handlePdfFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPdf(true);
    setCreateBookError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/books/upload-pdf", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setNewBookPdfPath(data.pdfPath);
      if (!newBookTitle) {
        const clean = file.name.replace(/\.pdf$/i, "").replace(/[-_]+/g, " ");
        setNewBookTitle(clean);
      }
    } catch (err) {
      setCreateBookError(err.message);
    } finally {
      setUploadingPdf(false);
    }
  }

  async function handleCreateBookSubmit(e) {
    e.preventDefault();
    if (!newBookTitle) return;
    setCreatingBook(true);
    setCreateBookError("");
    try {
      const res = await fetch("/api/books/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newBookTitle,
          id: newBookId || undefined,
          author: newBookAuthor,
          subtitle: newBookSubtitle,
          pdfPath: newBookPdfPath || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể tạo sách");
      await fetchOverview();
      selectBook(data.bookId);
      setNewBookModalOpen(false);
      setNewBookTitle("");
      setNewBookId("");
      setNewBookPdfPath("");
    } catch (err) {
      setCreateBookError(err.message);
    } finally {
      setCreatingBook(false);
    }
  }

  const runningJobsCount = Object.values(jobs).filter(
    (j) => j.status === "running"
  ).length;
  const activeJob = activeJobId ? jobs[activeJobId] : Object.values(jobs)[0];

  return (
    <div className="min-h-screen bg-white dark:bg-[#090D16] text-slate-900 dark:text-slate-100 transition-colors">
      {/* =====================================================================
          MINTLIFY / STRIPE DOCS TOP STICKY HEADER
         ===================================================================== */}
      <header className="sticky top-0 z-30 h-16 border-b border-slate-200/80 dark:border-white/[0.08] bg-white/95 dark:bg-[#090D16]/95">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-full flex items-center justify-between gap-4">
          {/* Left Brand (back to the library) */}
          <Link href="/" title="Về thư viện" className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
              BB
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-base text-slate-900 dark:text-white">
                  Breaking Books
                </span>
                <span className="text-[10px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                  Mintlify Docs UI
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
                Interactive Technical Book Studio & Visual Playground
              </p>
            </div>
          </Link>

          {/* Center Command Search Bar */}
          <button
            onClick={() => setCmdSearchOpen(true)}
            className="hidden md:flex items-center justify-between gap-3 w-full max-w-md px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#111827] border border-slate-200/90 dark:border-white/[0.08] hover:border-teal-500/50 text-xs text-slate-400 transition-all cursor-pointer"
          >
            <span className="flex items-center gap-2 truncate">
              <Search className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
              <span className="truncate">
                Tìm kiếm bài học, mô phỏng SVG, thuật ngữ...
              </span>
            </span>
            <kbd className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-500 shrink-0">
              ⌘K
            </kbd>
          </button>

          {/* Right Controls */}
          <div className="flex items-center gap-2">
            {overview?.books?.length > 1 && (
              <select
                value={selectedBookId}
                onChange={(e) => selectBook(e.target.value)}
                aria-label="Chọn sách"
                className="text-xs font-medium rounded-xl px-3 py-2 bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-white/10 focus:outline-none focus:border-teal-500 cursor-pointer"
              >
                {overview.books.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title} ({b.stats.completeChapters}/{b.stats.totalChapters})
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={() => setFlashcardsOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#111827] border border-slate-200/80 dark:border-white/[0.08] hover:border-teal-500/50 transition-colors cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span className="hidden sm:inline">Flashcards</span>
            </button>

            <button
              onClick={() => setNotesExportOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#111827] border border-slate-200/80 dark:border-white/[0.08] hover:border-teal-500/50 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span className="hidden lg:inline">Ghi chú & Xuất bản</span>
            </button>

            <button
              onClick={() => setNewBookModalOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#111827] border border-slate-200/80 dark:border-white/[0.08] hover:border-teal-500/50 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span className="hidden xl:inline">Thêm PDF</span>
            </button>

            <button
              onClick={() => setCliDrawerOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#111827] border border-slate-200/80 dark:border-white/[0.08] hover:border-teal-500/50 transition-colors cursor-pointer"
            >
              <Terminal className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="hidden xl:inline">
                {overview?.ai?.provider === "gemini" ? "Gemini 3.5 AI" : "AI Runner"}
              </span>
              {runningJobsCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </button>

            <button
              onClick={toggleTheme}
              aria-label="Đổi giao diện Sáng / Tối"
              className="p-2 rounded-xl bg-slate-50 dark:bg-[#111827] border border-slate-200/80 dark:border-white/[0.08] hover:border-teal-500/50 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* =====================================================================
          MINTLIFY / STRIPE DOCS HERO & BENTO METRICS
         ===================================================================== */}
      <div className="relative overflow-hidden border-b border-slate-200/70 dark:border-white/[0.06] mint-grid-bg">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-64 opacity-70 dark:opacity-40"
          style={{
            background:
              "radial-gradient(ellipse 70% 55% at 50% -15%, rgba(13, 148, 136, 0.14), rgba(79, 70, 229, 0.08), transparent)",
          }}
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-8 py-10 sm:py-14">
          {overview?.books?.length > 1 && (
            <div className="mb-8 flex flex-wrap items-center gap-2.5 pb-6 border-b border-slate-200/70 dark:border-white/[0.07]">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 mr-1">
                Tủ sách tương tác ({overview.books.length}):
              </span>
              {overview.books.map((b) => {
                const active = b.id === currentBook?.id;
                const done = b.stats.completeChapters === b.stats.totalChapters;
                return (
                  <button
                    key={b.id}
                    onClick={() => selectBook(b.id)}
                    className={`inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      active
                        ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                        : "bg-white/90 dark:bg-[#111827] text-slate-700 dark:text-slate-300 border-slate-200/90 dark:border-white/10 hover:border-teal-500/50"
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5 shrink-0" />
                    <span>{b.title}</span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                        active
                          ? "bg-white/20 text-white"
                          : done
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      {b.stats.completeChapters}/{b.stats.totalChapters} ch
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {!currentBook ? (
            <div className="py-16 text-center text-sm text-slate-400">
              Đang tải thư viện sách...
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Left 7 Cols: Editorial & CTAs */}
              <div className="lg:col-span-7 space-y-5">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-700 dark:text-teal-300 text-xs font-mono font-semibold">
                  <span className="w-2 h-2 rounded-full bg-teal-500" />
                  <span>
                    {currentBook.stats.completeChapters}/
                    {currentBook.stats.totalChapters} CHƯƠNG HOÀN TẤT •{" "}
                    {currentBook.stats.totalSvgs} INTERACTIVE LABS
                  </span>
                </div>

                <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.12]">
                  {currentBook.subtitle || currentBook.title}
                </h1>

                <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                  Bản bóc tách tương tác toàn diện cho{" "}
                  <b className="text-slate-900 dark:text-white">
                    {currentBook.title}
                  </b>{" "}
                  {currentBook.author ? (
                    <>
                      của tác giả <b>{currentBook.author}</b>.{" "}
                    </>
                  ) : null}
                  Thiết kế theo chuẩn tài liệu kỹ thuật 3 cột hiện đại, đi kèm{" "}
                  <b>{currentBook.stats.totalSvgs} sơ đồ SVG thao tác trực tiếp</b>,{" "}
                  <b>{currentBook.stats.totalQuizzes} câu hỏi kiểm tra</b> và từ
                  điển thuật ngữ song ngữ.
                </p>

                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <Link
                    href={`/books/${currentBook.id}/ch/1`}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold shadow-sm transition-colors"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Bắt đầu đọc Chương 01</span>
                    <ChevronRight className="w-4 h-4" />
                  </Link>

                  {currentBook.stats.completeChapters <
                    currentBook.stats.totalChapters && (
                    <button
                      onClick={breakAllPendingChapters}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-sm transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>
                        Break toàn bộ chương chưa xong (
                        {currentBook.stats.totalChapters -
                          currentBook.stats.completeChapters}{" "}
                        chương)
                      </span>
                    </button>
                  )}

                  <button
                    onClick={() => setCmdSearchOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 hover:border-teal-500/50 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                  >
                    <Search className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                    <span>Tìm nhanh toàn sách (⌘K)</span>
                  </button>

                  <button
                    onClick={() => setNotesExportOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 hover:border-indigo-500/50 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Tải bản Offline / Anki</span>
                  </button>
                </div>
              </div>

              {/* Right 5 Cols: Crisp 2x2 Bento Stats Grid */}
              <div className="lg:col-span-5 grid grid-cols-2 gap-3.5">
                <div className="p-5 rounded-2xl bg-white/90 dark:bg-[#0F1623]/90 border border-slate-200/90 dark:border-white/[0.08] shadow-xs">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                    <span>CHƯƠNG HOÀN TẤT</span>
                    <CheckCircle2 className="w-4 h-4 text-teal-500" />
                  </div>
                  <div className="text-3xl font-extrabold mt-2 text-slate-900 dark:text-white">
                    {currentBook.stats.completeChapters}
                    <span className="text-lg font-normal text-slate-400">
                      /{currentBook.stats.totalChapters}
                    </span>
                  </div>
                  <div className="text-xs text-teal-600 dark:text-teal-400 font-medium mt-1">
                    100% chương sẵn sàng
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-white/90 dark:bg-[#0F1623]/90 border border-slate-200/90 dark:border-white/[0.08] shadow-xs">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                    <span>CHỦ ĐỀ BÀI HỌC</span>
                    <BookOpen className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div className="text-3xl font-extrabold mt-2 text-slate-900 dark:text-white">
                    {currentBook.stats.totalTopics}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Chia nhỏ dễ đọc + TL;DR
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-white/90 dark:bg-[#0F1623]/90 border border-slate-200/90 dark:border-white/[0.08] shadow-xs">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                    <span>PLAYGROUND LABS</span>
                    <Cpu className="w-4 h-4 text-teal-500" />
                  </div>
                  <div className="text-3xl font-extrabold mt-2 text-teal-600 dark:text-teal-400">
                    {currentBook.stats.totalSvgs}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Sơ đồ SVG thao tác trực tiếp
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-white/90 dark:bg-[#0F1623]/90 border border-slate-200/90 dark:border-white/[0.08] shadow-xs">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                    <span>ACTIVE RECALL</span>
                    <HelpCircle className="w-4 h-4 text-violet-500" />
                  </div>
                  <div className="text-3xl font-extrabold mt-2 text-slate-900 dark:text-white">
                    {currentBook.stats.totalQuizzes}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Câu hỏi Quiz + 399 Flashcards
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* =====================================================================
          CHAPTER BENTO DIRECTORY (Grouped / Filterable by Book Part)
         ===================================================================== */}
      {currentBook && (
        <main className="max-w-7xl mx-auto px-4 sm:px-8 py-12">
          {/* Part Filter Pills */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Mục lục Chương & Interactive Labs ({filteredChapters.length})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Chọn bất kỳ chương nào để mở giao diện đọc 3 cột chuẩn Mintlify
                kèm mục lục neo bên phải.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-[#111827] border border-slate-200/80 dark:border-white/[0.07]">
              <button
                onClick={() => setSelectedPart("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  selectedPart === "all"
                    ? "bg-white dark:bg-[#1E293B] text-teal-600 dark:text-teal-400 shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Tất cả ({currentBook.chapters.length})
              </button>
              {bookParts.map((part) => (
                <button
                  key={part}
                  onClick={() => setSelectedPart(part)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    selectedPart === part
                      ? "bg-white dark:bg-[#1E293B] text-teal-600 dark:text-teal-400 shadow-2xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {part.split("·")[0].trim()}
                </button>
              ))}
            </div>
          </div>

          {/* Bento Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredChapters.map((ch, idx) => {
              const isComplete = ch.status === "complete";
              return (
                <motion.div
                  key={ch.num}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.22,
                    delay: Math.min(idx * 0.025, 0.2),
                  }}
                  className="group relative rounded-2xl bg-white dark:bg-[#0F1623] border border-slate-200/90 dark:border-white/[0.08] hover:border-teal-500/60 dark:hover:border-teal-400/50 p-6 flex flex-col justify-between transition-all duration-200 hover:shadow-lg hover:shadow-teal-500/[0.04]"
                >
                  {/* Top subtle gradient accent bar on hover */}
                  <div className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-teal-500 via-indigo-500 to-violet-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                  <div>
                    {/* Card Header: Number Badge + Part + Status */}
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-teal-500/10 dark:bg-teal-400/10 border border-teal-500/20 text-teal-700 dark:text-teal-300 font-mono text-xs font-bold flex items-center justify-center">
                          {String(ch.num).padStart(2, "0")}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 truncate max-w-[160px]">
                          {ch.part ? ch.part.split("·")[0].trim() : `Chương ${ch.num}`}
                        </span>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full border ${
                          isComplete
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                        }`}
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{ch.svgCount} Labs</span>
                      </span>
                    </div>

                    {/* Clickable Title & English Subtitle */}
                    <Link
                      href={`/books/${currentBook.id}/ch/${ch.num}`}
                      className="block group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors"
                    >
                      <h3 className="text-base font-bold tracking-tight text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 leading-snug">
                        {ch.title}
                      </h3>
                      <p className="text-xs font-mono text-slate-400 dark:text-slate-500 mt-1 truncate">
                        {ch.en}
                      </p>
                    </Link>

                    {/* Topic Chips Preview */}
                    {ch.topics?.length > 0 && (
                      <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-white/[0.05] space-y-1">
                        {ch.topics.slice(0, 3).map((t) => (
                          <Link
                            key={t.id}
                            href={`/books/${currentBook.id}/ch/${ch.num}#${t.id}`}
                            className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 truncate py-0.5 transition-colors"
                          >
                            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400 shrink-0">
                              {t.num}
                            </span>
                            <span className="truncate">{t.title}</span>
                          </Link>
                        ))}
                        {ch.topics.length > 3 && (
                          <div className="text-[11px] font-mono text-slate-400 pl-1 pt-0.5">
                            + {ch.topics.length - 3} bài học khác trong chương
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Card Footer */}
                  <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 text-[11px] font-mono text-slate-400">
                      <span>{ch.topicCount} mục</span>
                      <span>•</span>
                      <span>{ch.quizCount} quiz</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => startAiJob(ch.num, "complete")}
                        title={
                          isComplete
                            ? "Chạy Break lại / Nâng cấp chương này bằng Gemini 3.5 AI"
                            : "Chạy Break chương này ngay bằng Gemini 3.5 AI"
                        }
                        className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                          isComplete
                            ? "text-slate-400 hover:text-teal-600 hover:bg-teal-500/10"
                            : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500 hover:text-slate-950"
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        {!isComplete && <span>Chạy Break</span>}
                      </button>

                      <button
                        onClick={() => setPromptModalCh(ch)}
                        title="Copy Prompt bóc tách chương"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-500/10 transition-colors cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      <Link
                        href={`/books/${currentBook.id}/ch/${ch.num}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#151E2E] text-slate-700 dark:text-slate-200 group-hover:bg-teal-600 group-hover:text-white transition-colors"
                      >
                        <span>Đọc chương</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </main>
      )}

      {/* Modal 1: Copy Prompt for VS Code Claude Extension */}
      <AnimatePresence>
        {promptModalCh && currentBook && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4"
            onClick={() => setPromptModalCh(null)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl rounded-2xl bg-white dark:bg-[#0F1623] border border-slate-200 dark:border-white/10 p-6 sm:p-8"
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <span className="text-xs font-mono uppercase text-teal-600 dark:text-teal-400">
                    Google Gemini 3.5 AI Pipeline
                  </span>
                  <h3 className="text-lg font-bold mt-0.5">
                    Prompt Chương {promptModalCh.num}: {promptModalCh.title}
                  </h3>
                </div>
                <button
                  onClick={() => setPromptModalCh(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <pre className="text-xs font-mono whitespace-pre-wrap bg-slate-50 dark:bg-[#090D16] border border-slate-200 dark:border-white/10 rounded-xl p-4 max-h-72 overflow-y-auto text-slate-700 dark:text-slate-300 leading-relaxed">
                {buildPromptForChapter(currentBook, promptModalCh)}
              </pre>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <button
                  onClick={() => {
                    const chNum = promptModalCh.num;
                    setPromptModalCh(null);
                    startAiJob(chNum, "complete");
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Chạy thẳng bằng Gemini 3.5 AI</span>
                </button>

                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      buildPromptForChapter(currentBook, promptModalCh)
                    );
                    setCopiedPrompt(true);
                    setTimeout(() => setCopiedPrompt(false), 2000);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  {copiedPrompt ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Đã copy vào Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Prompt dán vào VS Code</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal 2: Add New Book from PDF */}
      <AnimatePresence>
        {newBookModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4"
            onClick={() => setNewBookModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#0F1623] border border-slate-200 dark:border-white/10 p-6 sm:p-8"
            >
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <span className="text-xs font-mono uppercase text-teal-600 dark:text-teal-400">
                    PyMuPDF Extractor
                  </span>
                  <h3 className="text-lg font-bold mt-0.5">
                    Thêm sách mới từ file PDF
                  </h3>
                </div>
                <button
                  onClick={() => setNewBookModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateBookSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5">
                    1. Chọn file PDF sách (tự động tách chương bằng PyMuPDF)
                  </label>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handlePdfFileSelect}
                    className="w-full text-xs file:mr-3 file:py-2 file:px-3.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-teal-500/10 file:text-teal-600 hover:file:bg-teal-500/20"
                  />
                  {uploadingPdf && (
                    <p className="text-xs text-teal-600 mt-1">
                      Đang tải file PDF lên...
                    </p>
                  )}
                  {newBookPdfPath && (
                    <p className="text-[11px] font-mono text-emerald-600 mt-1 truncate">
                      ✓ Đã tải: {newBookPdfPath}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    2. Tên sách *
                  </label>
                  <input
                    type="text"
                    required
                    value={newBookTitle}
                    onChange={(e) => setNewBookTitle(e.target.value)}
                    placeholder="VD: System Design Interview – Volume 2"
                    className="w-full px-3.5 py-2 rounded-xl text-sm bg-slate-50 dark:bg-[#090D16] border border-slate-200 dark:border-white/10"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Tác giả
                    </label>
                    <input
                      type="text"
                      value={newBookAuthor}
                      onChange={(e) => setNewBookAuthor(e.target.value)}
                      placeholder="Alex Xu"
                      className="w-full px-3.5 py-2 rounded-xl text-sm bg-slate-50 dark:bg-[#090D16] border border-slate-200 dark:border-white/10"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Mã thư mục (slug)
                    </label>
                    <input
                      type="text"
                      value={newBookId}
                      onChange={(e) => setNewBookId(e.target.value)}
                      placeholder="system-design-v2"
                      className="w-full px-3.5 py-2 rounded-xl text-sm font-mono bg-slate-50 dark:bg-[#090D16] border border-slate-200 dark:border-white/10"
                    />
                  </div>
                </div>

                {createBookError && (
                  <p className="text-xs text-rose-600">{createBookError}</p>
                )}

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setNewBookModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-white/10 cursor-pointer"
                  >
                    Huỷ
                  </button>
                  <button
                    type="submit"
                    disabled={creatingBook || uploadingPdf}
                    className="px-5 py-2 rounded-xl text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white disabled:opacity-50 cursor-pointer"
                  >
                    {creatingBook ? "Đang tách chương..." : "Tạo & Tách chương"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drawer: Gemini 3.5 AI Runner */}
      <AnimatePresence>
        {cliDrawerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/50 flex justify-end"
            onClick={() => setCliDrawerOpen(false)}
          >
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.25 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-xl h-full bg-white dark:bg-[#0F1623] border-l border-slate-200 dark:border-white/10 p-6 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4">
                <div className="flex items-center gap-2.5">
                  <Terminal className="w-4 h-4 text-emerald-500" />
                  <div>
                    <h3 className="text-sm font-bold">
                      {overview?.ai?.name || "Gemini 3.5 AI Background Runner"}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-mono">
                      {overview?.ai?.version || "Gemini 3.5 Flash Ready"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setCliDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="my-4 flex-1 overflow-y-auto space-y-4">
                {Object.keys(jobs).length === 0 ? (
                  <div className="p-8 rounded-2xl bg-slate-50 dark:bg-[#090D16] border border-slate-200/80 dark:border-white/[0.06] text-center space-y-2">
                    <p className="text-xs text-slate-500">
                      Chưa có tiến trình bóc tách AI nào đang chạy.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {Object.values(jobs).map((j) => (
                        <button
                          key={j.id}
                          onClick={() => setActiveJobId(j.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-mono border cursor-pointer ${
                            activeJob?.id === j.id
                              ? "border-teal-500 bg-teal-500/10 text-teal-600 dark:text-teal-400"
                              : "border-slate-200 dark:border-white/10"
                          }`}
                        >
                          Ch.{j.chapter} ({j.status})
                        </button>
                      ))}
                    </div>

                    {activeJob && (
                      <div className="rounded-xl bg-[#090D16] text-slate-200 p-4 font-mono text-xs space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-white/10 pb-2">
                          <span>
                            Job {activeJob.id} • Chương {activeJob.chapter} (
                            {activeJob.status})
                          </span>
                          {activeJob.status === "running" && (
                            <button
                              onClick={() => stopAiJob(activeJob.id)}
                              className="inline-flex items-center gap-1 text-rose-400 hover:text-rose-300 cursor-pointer"
                            >
                              <Square className="w-3 h-3" />
                              <span>Dừng</span>
                            </button>
                          )}
                        </div>
                        <div className="max-h-96 overflow-y-auto whitespace-pre-wrap leading-relaxed text-[11px] text-slate-300">
                          {(activeJob.logs || []).join("") ||
                            "Đang khởi tạo tiến trình Gemini 3.5 AI..."}
                          <div ref={logEndRef} />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-white/10 flex items-center justify-between text-xs text-slate-500">
                <span>Tự động lưu trực tiếp vào src/chN.html & src/chN.js</span>
                <button
                  onClick={fetchOverview}
                  className="inline-flex items-center gap-1 text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Làm mới số liệu</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase 4 & 5 Workspace Modals */}
      <CommandSearchModal
        bookId={selectedBookId}
        open={cmdSearchOpen}
        onClose={() => setCmdSearchOpen(false)}
      />
      <FlashcardsModal
        bookId={selectedBookId}
        open={flashcardsOpen}
        onClose={() => setFlashcardsOpen(false)}
      />
      <NotesAndExportModal
        bookId={selectedBookId}
        open={notesExportOpen}
        onClose={() => setNotesExportOpen(false)}
      />
    </div>
  );
}
