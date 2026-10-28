"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  BookOpen,
  Upload,
  Moon,
  Sun,
  CheckCircle2,
  Loader2,
  AlertCircle,
  FileText,
  Settings2,
  ArrowRight,
  RotateCw,
  X,
  Sparkles,
} from "lucide-react";

// Cover colours for generated book covers (picked by hashing the book id)
const COVERS = [
  "from-orange-600 to-amber-800",
  "from-indigo-700 to-indigo-900",
  "from-amber-600 to-orange-800",
  "from-rose-700 to-rose-900",
  "from-sky-700 to-sky-900",
  "from-emerald-700 to-emerald-900",
];
function coverFor(id) {
  let h = 7;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COVERS[h % COVERS.length];
}

function readLocal(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

function formatSize(bytes) {
  return bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.round(bytes / 1e3)} KB`;
}

const STEPS = ["Tải file lên", "Chia sách thành từng chương", "Bắt đầu viết bài học"];

// Module-level in-memory cache for 0ms instant transitions across Next.js SPA navigation
let _globalClientOverviewCache = null;

export default function LibraryPage() {
  const [overview, setOverview] = useState(() => {
    if (_globalClientOverviewCache) return _globalClientOverviewCache;
    if (typeof window !== "undefined") {
      try {
        const cached = sessionStorage.getItem("bb_overview_cache");
        if (cached) {
          const parsed = JSON.parse(cached);
          _globalClientOverviewCache = parsed;
          return parsed;
        }
      } catch {}
    }
    return null;
  });

  const [isDark, setIsDark] = useState(false);
  const [local, setLocal] = useState(() => {
    const initial = _globalClientOverviewCache;
    if (initial?.books) {
      const map = {};
      initial.books.forEach((b) => {
        map[b.id] = {
          read: readLocal(`${b.id}:read`, []).length,
          lastCh: readLocal(`${b.id}:lastCh`, null),
        };
      });
      return map;
    }
    return {};
  });

  // Upload flow: null | { step: 0..3, pct, fileName, error, warning, bookId }
  const [upload, setUpload] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const [busyBook, setBusyBook] = useState(""); // bookId or pdf name being started
  const [actionError, setActionError] = useState("");

  const fetchOverview = useCallback(async () => {
    try {
      const res = await fetch("/api/overview", { cache: "no-store" });
      const data = await res.json();
      if (data && data.ok) {
        setOverview(data);
        _globalClientOverviewCache = data;
        try {
          sessionStorage.setItem("bb_overview_cache", JSON.stringify(data));
        } catch {}
        const map = {};
        (data.books || []).forEach((b) => {
          map[b.id] = {
            read: readLocal(`${b.id}:read`, []).length,
            lastCh: readLocal(`${b.id}:lastCh`, null),
          };
        });
        setLocal(map);
      }
    } catch (e) {
      console.error("Failed to fetch overview", e);
    }
  }, []);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
    fetchOverview();
  }, [fetchOverview]);

  // Refresh while any book is being written, so progress moves on its own
  const anyActive = (overview?.books || []).some((b) => b.processing?.active);
  useEffect(() => {
    if (!anyActive && !(upload && upload.step < 3)) return;
    const t = setInterval(fetchOverview, 5000);
    return () => clearInterval(t);
  }, [anyActive, upload, fetchOverview]);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("bb_theme", next ? "dark" : "light");
    } catch {}
  }

  function startUpload(file) {
    if (!file) return;
    if (!/\.pdf$/i.test(file.name)) {
      setUpload({ step: 0, pct: 0, fileName: file.name, error: "Chỉ nhận file PDF. Hãy chọn file có đuôi .pdf." });
      return;
    }
    setUpload({ step: 0, pct: 0, fileName: file.name });
    const fd = new FormData();
    fd.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/library/import");
    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const pct = Math.round((e.loaded / e.total) * 100);
      // Once the bytes are sent, the server is splitting chapters
      setUpload((u) => u && { ...u, pct, step: pct >= 100 ? 1 : 0 });
    };
    xhr.onload = () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300 && data.ok) {
        setUpload((u) => ({ ...u, step: 3, pct: 100, bookId: data.bookId, title: data.title, chapters: data.chapters, warning: data.warning }));
      } else {
        const where = data.stage === "split" ? "Không chia được chương. " : "";
        setUpload((u) => ({ ...u, error: where + (data.error || "Có lỗi khi tải lên. Hãy thử lại.") }));
      }
      fetchOverview();
    };
    xhr.onerror = () => setUpload((u) => ({ ...u, error: "Mất kết nối tới máy chủ. Kiểm tra ứng dụng còn đang chạy rồi thử lại." }));
    xhr.send(fd);
  }

  async function processBook(body, key) {
    setBusyBook(key);
    setActionError("");
    try {
      const res = await fetch("/api/library/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không bắt đầu được.");
      await fetchOverview();
    } catch (e) {
      setActionError(e.message);
    } finally {
      setBusyBook("");
    }
  }

  const books = overview?.books || [];
  const pdfs = overview?.unprocessedPdfs || [];
  const uploading = upload && !upload.error && upload.step < 3;

  return (
    <div className="min-h-screen bg-white dark:bg-[#090D16] text-slate-900 dark:text-slate-100 selection:bg-orange-500/20">
      <header className="sticky top-0 z-30 border-b border-slate-100/90 dark:border-white/10 bg-white/90 dark:bg-[#090D16]/90 backdrop-blur-md shadow-[0_1px_10px_-2px_rgba(0,0,0,0.03)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-3 min-w-0 group">
            <span className="w-9 h-9 shrink-0 rounded-xl bg-orange-600 group-hover:bg-orange-500 text-white flex items-center justify-center shadow-sm transition-colors">
              <BookOpen className="w-5 h-5" />
            </span>
            <span className="text-lg font-bold tracking-tight whitespace-nowrap text-slate-900 dark:text-white">Breaking Books</span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="inline-flex items-center gap-2 h-10 px-3.5 rounded-xl border border-slate-200/80 dark:border-white/10 text-sm font-medium hover:border-orange-500/60 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-all cursor-pointer"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
              <span className="hidden sm:inline">{isDark ? "Nền sáng" : "Nền tối"}</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold shadow-[0_2px_8px_-1px_rgba(234,88,12,0.25)] hover:shadow-[0_4px_14px_-2px_rgba(234,88,12,0.35)] disabled:opacity-50 transition-all cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span className="whitespace-nowrap">Thêm sách PDF</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-8 py-10 space-y-12">
        <section className="pt-2 sm:pt-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-50 dark:bg-orange-950/40 border border-orange-200/70 dark:border-orange-500/30 text-xs font-semibold text-orange-800 dark:text-orange-300 shadow-sm mb-4">
            <Sparkles className="w-3.5 h-3.5 text-orange-600 animate-pulse" />
            <span>Nền tảng Sách Kỹ thuật Tương tác</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.18]">
            Đọc, Trải nghiệm & Thử nghiệm <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-orange-600 via-amber-500 to-orange-500 bg-clip-text text-transparent">
              Kiến trúc Hệ thống Thực tế
            </span>
          </h1>
          <p className="mt-3.5 text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
            Bóc tách từng chương sách kinh điển thành lý thuyết cô đọng và phòng thử nghiệm trực quan riêng biệt. Bạn có thể kéo slider, quan sát luồng gói tin, phân tích đồ thị và tương tác trực tiếp ngay trong trình duyệt.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-2.5 sm:gap-4 text-xs font-medium text-slate-600 dark:text-slate-300">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/70 dark:border-white/10 shadow-[0_2px_6px_-1px_rgba(0,0,0,0.02)]">
              📚 <strong className="text-slate-800 dark:text-slate-200">{books.length} Bộ sách kinh điển</strong>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/70 dark:border-white/10 shadow-[0_2px_6px_-1px_rgba(0,0,0,0.02)]">
              🧪 <strong className="text-slate-800 dark:text-slate-200">100% Visual Lab tương tác</strong>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/70 dark:border-white/10 shadow-[0_2px_6px_-1px_rgba(0,0,0,0.02)]">
              ⚡ <strong className="text-slate-800 dark:text-slate-200">Đọc từng chương độc lập</strong>
            </span>
          </div>
        </section>

        {/* Upload: one drop zone that turns into a step-by-step progress panel */}
        <section aria-label="Thêm sách mới">
          <input
            ref={fileInputRef}
            id="pdf-upload"
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              startUpload(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {!upload ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                startUpload(e.dataTransfer.files?.[0]);
              }}
              className={`w-full rounded-3xl border-2 border-dashed px-6 py-10 flex flex-col items-center gap-3 text-center transition-all duration-300 cursor-pointer shadow-[0_4px_24px_-4px_rgba(0,0,0,0.03)] hover:shadow-[0_16px_36px_-6px_rgba(234,88,12,0.09)] ${
                dragOver
                  ? "border-orange-600 bg-orange-50/60 dark:bg-orange-500/10 scale-[1.005]"
                  : "border-slate-200/90 dark:border-white/15 bg-white dark:bg-[#10161D] hover:border-orange-500"
              }`}
            >
              <span className="w-14 h-14 rounded-2xl bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-300 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                <Upload className="w-6 h-6" />
              </span>
              <span className="text-lg font-bold text-slate-900 dark:text-white">Kéo file PDF sách vào đây, hoặc bấm để chọn file</span>
              <span className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
                Hệ thống tự động tìm bìa gốc chuẩn xác, chia chương thông minh và khởi tạo phòng thí nghiệm trực quan cho từng bài học.
              </span>
            </button>
          ) : (
            <div className="rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#10161D] p-6 sm:p-8 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)]">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm text-slate-500 dark:text-slate-400">Đang thêm sách</p>
                  <p className="text-lg font-semibold truncate">{upload.title || upload.fileName}</p>
                </div>
                {!uploading && (
                  <button
                    onClick={() => setUpload(null)}
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 dark:border-white/10 text-sm cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                    Đóng
                  </button>
                )}
              </div>

              <ol className="mt-6 space-y-4">
                {STEPS.map((label, i) => {
                  const done = upload.step > i;
                  const current = upload.step === i && !upload.error;
                  const failed = upload.step === i && upload.error;
                  return (
                    <li key={label} className="flex items-center gap-3">
                      <span
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                          done
                            ? "bg-emerald-600 text-white"
                            : failed
                            ? "bg-rose-600 text-white"
                            : current
                            ? "bg-orange-600 text-white"
                            : "bg-slate-100 dark:bg-white/10 text-slate-400"
                        }`}
                      >
                        {done ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : failed ? (
                          <AlertCircle className="w-4 h-4" />
                        ) : current ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <span className="text-sm font-semibold">{i + 1}</span>
                        )}
                      </span>
                      <span className={`text-base ${done || current ? "font-medium" : "text-slate-400"}`}>
                        {label}
                        {i === 0 && current && upload.pct > 0 ? ` (${upload.pct}%)` : ""}
                        {i === 1 && current ? "… việc này có thể mất nửa phút" : ""}
                      </span>
                    </li>
                  );
                })}
              </ol>

              {upload.error && (
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <p className="text-base text-rose-700 dark:text-rose-400">{upload.error}</p>
                  <button
                    onClick={() => {
                      setUpload(null);
                      fileInputRef.current?.click();
                    }}
                    className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold cursor-pointer"
                  >
                    Chọn file khác
                  </button>
                </div>
              )}

              {upload.step >= 3 && (
                <div className="mt-6 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-500/20 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="font-semibold text-emerald-800 dark:text-emerald-300 text-lg">
                      Đã thêm sách vào thư viện, chia thành {upload.chapters} chương thành công!
                    </p>
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      Gemini 3.5 AI đang bóc tách ngầm các chương. Bạn có thể bấm vào đọc Chương 1 ngay bây giờ!
                    </p>
                  </div>
                  {upload.bookId && (
                    <Link
                      href={`/books/${upload.bookId}/ch/1`}
                      className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold text-sm shrink-0 shadow-sm transition-all"
                    >
                      <BookOpen className="w-4 h-4" />
                      <span>Vào đọc Chương 1 ngay</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Books */}
        <section aria-label="Sách đang có">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-bold">Sách trong thư viện</h2>
            {anyActive && (
              <span className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-full bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-300 border border-orange-500/20">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>AI đang bóc tách ngầm</span>
              </span>
            )}
          </div>

          {/* Ongoing processing banner for newly added books */}
          {books.filter((b) => b.processing?.active).map((pb) => (
            <div
              key={pb.id}
              className="mb-6 rounded-2xl bg-orange-50 dark:bg-orange-950/40 border border-orange-500/30 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-4 min-w-0">
                {(pb.coverUrl || pb.id) && (
                  <div className="w-12 h-16 rounded-md overflow-hidden shrink-0 shadow-md ring-1 ring-white/10 hidden sm:block">
                    <img
                      src={pb.coverUrl || `/covers/${pb.id}.jpg`}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 text-orange-800 dark:text-orange-300 font-semibold text-base">
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span className="truncate">Đang phân tích và viết bài học: {pb.title}</span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Đã bóc tách {pb.stats.completeChapters}/{pb.stats.totalChapters} chương. Bạn có thể mở đọc Chương 1 ngay lập tức trong khi hệ thống xử lý các chương tiếp theo!
                  </p>
                </div>
              </div>
              <Link
                href={`/books/${pb.id}/ch/1`}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold text-sm shrink-0 shadow-sm transition-all"
              >
                <BookOpen className="w-4 h-4" />
                <span>Vào đọc Chương 1 ngay</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ))}

          {!overview ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-3xl border border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] p-6 h-80 flex flex-col items-center justify-center gap-4">
                  <div className="w-32 h-44 bg-slate-200/70 dark:bg-white/10 rounded-lg shadow-sm" />
                  <div className="w-3/4 h-4 bg-slate-200/70 dark:bg-white/10 rounded-full" />
                  <div className="w-1/2 h-3 bg-slate-100 dark:bg-white/5 rounded-full" />
                </div>
              ))}
            </div>
          ) : books.length === 0 ? (
            <p className="text-base text-slate-500">Thư viện còn trống. Thêm file PDF đầu tiên ở khung bên trên.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {books.map((b) => (
                <BookCard
                  key={b.id}
                  book={b}
                  local={local[b.id] || {}}
                  busy={busyBook === b.id}
                  onProcess={() => processBook({ bookId: b.id }, b.id)}
                />
              ))}
            </div>
          )}
          {actionError && <p className="mt-4 text-base text-rose-700 dark:text-rose-400">{actionError}</p>}
        </section>

        {/* PDFs on disk that are not a book yet */}
        {pdfs.length > 0 && (
          <section aria-label="File PDF chưa chuẩn bị">
            <h2 className="text-xl font-bold">File PDF chưa chuẩn bị</h2>
            <p className="mt-1 mb-4 text-base text-slate-600 dark:text-slate-300">
              Những file này đã nằm trong thư mục sách nhưng chưa được chia chương.
            </p>
            <ul className="divide-y divide-slate-200 dark:divide-white/10 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#10161D]">
              {pdfs.map((p) => (
                <li key={p.name} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <FileText className="w-5 h-5 text-slate-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-medium truncate">{p.name.replace(/\.pdf$/i, "")}</p>
                    <p className="text-sm text-slate-500">{formatSize(p.size)}</p>
                  </div>
                  <button
                    onClick={() => processBook({ pdfFile: p.name }, p.name)}
                    disabled={busyBook === p.name}
                    className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold disabled:opacity-50 cursor-pointer"
                  >
                    {busyBook === p.name ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {busyBook === p.name ? "Đang chia chương…" : "Chuẩn bị sách này"}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="pt-6 border-t border-slate-200 dark:border-white/10 text-xs text-slate-400 text-center">
          <span>Breaking Books © 2026 · Nền tảng học và đọc sách kỹ thuật tương tác</span>
        </footer>
      </main>
    </div>
  );
}

function BookCardCover({ book, readHref }) {
  const [imgError, setImgError] = useState(false);
  const coverUrl = book.coverUrl || `/covers/${book.id}.jpg`;
  const showImage = !imgError;

  return (
    <Link
      href={readHref}
      className="relative w-full pt-8 pb-7 px-6 bg-gradient-to-b from-slate-50/70 via-white to-white dark:from-white/[0.03] dark:via-transparent dark:to-transparent flex flex-col items-center justify-center border-b border-slate-100/90 dark:border-white/10 group cursor-pointer select-none overflow-hidden"
    >
      {/* Subtle ambient spotlight glow */}
      <div className="absolute w-48 h-48 rounded-full bg-orange-500/5 dark:bg-orange-400/5 blur-2xl pointer-events-none group-hover:scale-130 group-hover:bg-orange-500/10 transition-all duration-500" />

      {showImage ? (
        /* 3D Realistic Floating Book Cover — Enlarged for maximum visual elegance */
        <div className="relative z-10 w-[142px] h-[196px] sm:w-[155px] sm:h-[215px] rounded-lg overflow-hidden shadow-[0_16px_36px_-6px_rgba(15,23,42,0.18),0_4px_12px_-2px_rgba(15,23,42,0.08)] ring-1 ring-black/5 dark:ring-white/15 transition-all duration-300 ease-out group-hover:scale-[1.04] group-hover:-translate-y-2 group-hover:rotate-[0.8deg] group-hover:shadow-[0_24px_48px_-8px_rgba(234,88,12,0.22),0_8px_16px_-4px_rgba(15,23,42,0.12)]">
          {/* Left Spine 3D Highlight & Shadow */}
          <div className="absolute inset-y-0 left-0 w-2 bg-gradient-to-r from-white/40 via-white/10 to-transparent z-10 pointer-events-none" />
          <div className="absolute inset-y-0 left-0 w-1 bg-black/20 z-10 pointer-events-none" />
          {/* Right Pages Thickness Edge */}
          <div className="absolute inset-y-0 right-0 w-1 bg-gradient-to-l from-white/30 to-transparent z-10 pointer-events-none" />

          <img
            src={coverUrl}
            alt={book.title}
            loading="lazy"
            decoding="async"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover object-top"
          />
        </div>
      ) : (
        <div className={`w-[142px] h-[196px] sm:w-[155px] sm:h-[215px] rounded-lg shadow-lg bg-gradient-to-br ${coverFor(book.id)} p-5 flex flex-col justify-end text-white transition-all duration-300 group-hover:scale-105 group-hover:-translate-y-1.5`}>
          <BookOpen className="w-8 h-8 opacity-75 mb-auto" />
          <span className="text-sm font-bold line-clamp-3 leading-snug">{book.title}</span>
        </div>
      )}
    </Link>
  );
}

function BookCard({ book, local, busy, onProcess }) {
  const total = book.stats.totalChapters;
  const done = book.stats.completeChapters;
  const p = book.processing || {};
  const ready = done === total && total > 0;
  const firstReady = book.chapters.find((c) => c.status === "complete")?.n;
  const lastCh = book.chapters.some((c) => c.n === local.lastCh && c.status === "complete") ? local.lastCh : null;
  const readHref = `/books/${book.id}/ch/${lastCh || firstReady || 1}`;
  const readPct = book.stats.totalTopics ? Math.min(100, Math.round(((local.read || 0) / book.stats.totalTopics) * 100)) : 0;

  return (
    <article className="rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#10161D] shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] hover:shadow-[0_20px_48px_-6px_rgba(0,0,0,0.08)] hover:-translate-y-1.5 transition-all duration-300 overflow-hidden flex flex-col group">
      <BookCardCover book={book} readHref={readHref} />

      <div className="p-6 flex-1 flex flex-col gap-4">
        {/* Book Title & Subtitle */}
        <div>
          <Link href={readHref} className="block group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-snug line-clamp-2">
              {book.title}
            </h3>
          </Link>
          {book.subtitle && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-1 leading-normal">
              {book.subtitle}
            </p>
          )}
          {book.author && !book.subtitle?.includes(book.author) && (
            <p className="mt-1 text-[11px] font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wider">
              {book.author}
            </p>
          )}
        </div>

        {/* Status & Progress */}
        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-white/5">
          <div className="flex items-center justify-between text-xs">
            {ready ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Sẵn sàng · {total} chương</span>
              </span>
            ) : p.active ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-orange-600 dark:text-orange-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Đang bóc tách · {done}/{total}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{done}/{total} chương sẵn sàng</span>
              </span>
            )}

            {ready && local.read > 0 && (
              <span className="font-mono text-slate-500 dark:text-slate-400">
                Đã đọc {readPct}%
              </span>
            )}
          </div>

          {/* Progress Bar */}
          <div className="h-2 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden" aria-hidden="true">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                ready ? "bg-gradient-to-r from-emerald-500 to-amber-500" : "bg-gradient-to-r from-orange-500 to-amber-500"
              }`}
              style={{
                width: ready && local.read > 0 ? `${readPct}%` : `${total ? (done / total) * 100 : 0}%`,
              }}
            />
          </div>
        </div>

        {p.active && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Chương hoàn thành sẽ đọc được ngay. Hệ thống tự cập nhật.
          </p>
        )}
        {!p.active && p.failed?.length > 0 && (
          <p className="text-xs text-rose-700 dark:text-rose-400">
            {p.failed.length} chương chưa xử lý xong. Bấm nút thử lại.
          </p>
        )}

        {/* Action Button */}
        <div className="mt-auto pt-2 flex items-center gap-2">
          <Link
            href={readHref}
            className="flex-1 inline-flex items-center justify-between h-11 px-5 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-semibold text-sm shadow-[0_2px_8px_-1px_rgba(234,88,12,0.25)] hover:shadow-[0_6px_18px_-2px_rgba(234,88,12,0.35)] transition-all group/btn cursor-pointer"
          >
            {lastCh ? (
              <>
                <span>Đọc tiếp · Chương {lastCh}</span>
                <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
              </>
            ) : p.active ? (
              <>
                <span className="truncate">Vào xem Chương 1</span>
                <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
              </>
            ) : firstReady ? (
              <>
                <span>Bắt đầu đọc</span>
                <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
              </>
            ) : (
              <>
                <span>Mở xem Chương 1</span>
                <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
              </>
            )}
          </Link>

          {!ready && !p.active && (
            <button
              onClick={onProcess}
              disabled={busy}
              className="inline-flex items-center justify-center w-11 h-11 rounded-2xl border border-slate-200 dark:border-white/15 text-slate-700 dark:text-slate-300 hover:border-orange-500 hover:text-orange-600 disabled:opacity-50 transition-all cursor-pointer"
              title="Tiếp tục bóc tách các chương còn lại"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
