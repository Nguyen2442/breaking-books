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
} from "lucide-react";

// Cover colours for generated book covers (picked by hashing the book id)
const COVERS = [
  "from-teal-700 to-teal-900",
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

export default function LibraryPage() {
  const [overview, setOverview] = useState(null);
  const [isDark, setIsDark] = useState(false);
  const [local, setLocal] = useState({}); // bookId -> { read: number, lastCh: number }

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
      setOverview(data);
      const map = {};
      (data.books || []).forEach((b) => {
        map[b.id] = {
          read: readLocal(`${b.id}:read`, []).length,
          lastCh: readLocal(`${b.id}:lastCh`, null),
        };
      });
      setLocal(map);
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
    <div className="min-h-screen bg-[#F7F8F7] dark:bg-[#0B0F14] text-slate-900 dark:text-slate-100">
      <header className="border-b border-slate-200 dark:border-white/10 bg-white dark:bg-[#10161D]">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 shrink-0 rounded-xl bg-teal-700 text-white flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </span>
            <span className="text-lg font-bold tracking-tight whitespace-nowrap">Breaking Books</span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="inline-flex items-center gap-2 h-10 px-3 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-medium hover:border-teal-600 cursor-pointer"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              <span className="hidden sm:inline">{isDark ? "Nền sáng" : "Nền tối"}</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-teal-700 hover:bg-teal-600 text-white text-sm font-semibold disabled:opacity-50 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span className="whitespace-nowrap">Thêm sách</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-8 py-10 space-y-12">
        <section>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Thư viện của bạn</h1>
          <p className="mt-2 text-base text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
            Bấm vào một cuốn sách để đọc. Muốn thêm sách mới, chỉ cần chọn file PDF. Máy sẽ tự chia chương, rồi viết phần tóm tắt, giải thích và ví dụ cho từng chương.
          </p>
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
              className={`w-full rounded-2xl border-2 border-dashed px-6 py-10 flex flex-col items-center gap-3 text-center transition-colors cursor-pointer ${
                dragOver
                  ? "border-teal-600 bg-teal-50 dark:bg-teal-500/10"
                  : "border-slate-300 dark:border-white/15 bg-white dark:bg-[#10161D] hover:border-teal-600"
              }`}
            >
              <span className="w-14 h-14 rounded-full bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300 flex items-center justify-center">
                <Upload className="w-6 h-6" />
              </span>
              <span className="text-lg font-semibold">Kéo file PDF vào đây, hoặc bấm để chọn file</span>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Tải lên xong, máy tự chia chương và bắt đầu viết bài học. Mỗi chương mất vài phút.
              </span>
            </button>
          ) : (
            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#10161D] p-6 sm:p-8">
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
                            ? "bg-teal-700 text-white"
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
                    className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-teal-700 text-white text-sm font-semibold cursor-pointer"
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
                      className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-teal-700 hover:bg-teal-600 text-white font-semibold text-sm shrink-0 shadow-sm transition-all"
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
              <span className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-full bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>AI đang bóc tách ngầm</span>
              </span>
            )}
          </div>

          {/* Ongoing processing banner for newly added books */}
          {books.filter((b) => b.processing?.active).map((pb) => (
            <div
              key={pb.id}
              className="mb-6 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-500/30 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
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
                  <div className="flex items-center gap-2 text-teal-800 dark:text-teal-300 font-semibold text-base">
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
                className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-teal-700 hover:bg-teal-600 text-white font-semibold text-sm shrink-0 shadow-sm transition-all"
              >
                <BookOpen className="w-4 h-4" />
                <span>Vào đọc Chương 1 ngay</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ))}

          {!overview ? (
            <p className="text-base text-slate-500">Đang tải thư viện…</p>
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
                    className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-teal-700 hover:bg-teal-600 text-white text-sm font-semibold disabled:opacity-50 cursor-pointer"
                  >
                    {busyBook === p.name ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {busyBook === p.name ? "Đang chia chương…" : "Chuẩn bị sách này"}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="pt-6 border-t border-slate-200 dark:border-white/10 text-sm text-slate-500">
          <Link href="/studio" className="inline-flex items-center gap-1.5 hover:text-teal-700 dark:hover:text-teal-300">
            <Settings2 className="w-4 h-4" />
            Công cụ nâng cao (dành cho người soạn sách)
          </Link>
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
      className="relative overflow-hidden min-h-[230px] sm:min-h-[245px] flex flex-col justify-end p-6 group cursor-pointer select-none"
    >
      {showImage ? (
        <>
          {/* 1. Atmospheric ambient background image with blur & scale */}
          <div
            className="absolute inset-0 bg-cover bg-center filter blur-md scale-110 opacity-30 transition-transform duration-700 group-hover:scale-120"
            style={{ backgroundImage: `url("${coverUrl}")` }}
            aria-hidden="true"
          />
          {/* 2. Deep vignette gradient scrim for contrast */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/75 to-slate-950/25" />

          {/* 3. Prominent 3D Floating Book Cover on top-right */}
          <div className="absolute top-4 right-4 w-[106px] h-[150px] sm:w-[116px] sm:h-[164px] rounded-md overflow-hidden shadow-[0_16px_30px_-6px_rgba(0,0,0,0.85)] ring-1 ring-white/25 transition-all duration-300 group-hover:-translate-y-2 group-hover:rotate-1 group-hover:shadow-[0_24px_38px_-8px_rgba(0,0,0,0.95)]">
            {/* Book spine highlight */}
            <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-r from-white/35 to-transparent z-10 pointer-events-none" />
            <img
              src={coverUrl}
              alt={book.title}
              loading="lazy"
              decoding="async"
              onError={() => setImgError(true)}
              className="w-full h-full object-cover object-top"
            />
          </div>
        </>
      ) : (
        <div className={`absolute inset-0 bg-gradient-to-br ${coverFor(book.id)} opacity-95`} />
      )}

      {/* Book Metadata on Card */}
      <div className={`relative z-10 ${showImage ? "pr-30 sm:pr-34" : ""} text-white`}>
        <span className="text-xl font-bold leading-snug line-clamp-2 group-hover:underline drop-shadow-md">
          {book.title}
        </span>
        {book.subtitle && (
          <span className="mt-1 text-sm text-slate-200 line-clamp-2 drop-shadow">
            {book.subtitle}
          </span>
        )}
        {book.author && !book.subtitle?.includes(book.author) && (
          <span className="mt-2.5 inline-block text-xs font-semibold text-teal-300 tracking-wider uppercase drop-shadow">
            {book.author}
          </span>
        )}
      </div>
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

  let status;
  if (ready) {
    status = (
      <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="w-4 h-4" /> Sẵn sàng · {total} chương
      </span>
    );
  } else if (p.active) {
    status = (
      <span className="inline-flex items-center gap-1.5 text-teal-700 dark:text-teal-300">
        <Loader2 className="w-4 h-4 animate-spin" /> Đang viết bài học · {done}/{total} chương xong
      </span>
    );
  } else {
    status = (
      <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
        <AlertCircle className="w-4 h-4" /> {done}/{total} chương đã sẵn sàng
      </span>
    );
  }

  return (
    <article className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#10161D] overflow-hidden flex flex-col hover:border-slate-300 dark:hover:border-white/20 transition-colors">
      <BookCardCover book={book} readHref={readHref} />

      <div className="p-5 flex-1 flex flex-col gap-4">
        <div className="text-sm font-medium">{status}</div>

        {!ready && (
          <div className="h-2 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden" aria-hidden="true">
            <div className="h-full bg-teal-600 transition-all" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
          </div>
        )}

        {ready && local.read > 0 && (
          <div>
            <div className="flex justify-between text-sm text-slate-500 dark:text-slate-400 mb-1">
              <span>Bạn đã đọc</span>
              <span>{readPct}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden" aria-hidden="true">
              <div className="h-full bg-emerald-600" style={{ width: `${readPct}%` }} />
            </div>
          </div>
        )}

        {p.active && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Chương xong sẽ đọc được ngay. Trang tự cập nhật.
          </p>
        )}
        {!p.active && p.failed?.length > 0 && (
          <p className="text-sm text-rose-700 dark:text-rose-400">
            {p.failed.length} chương chưa viết được. Bấm “Viết tiếp” để thử lại.
          </p>
        )}

        <div className="mt-auto flex flex-wrap gap-2">
          <Link
            href={readHref}
            className={`inline-flex items-center gap-2 h-11 px-5 rounded-xl text-base font-semibold transition-all ${
              p.active
                ? "bg-teal-700 hover:bg-teal-600 text-white shadow-sm"
                : "bg-teal-700 hover:bg-teal-600 text-white"
            }`}
          >
            {lastCh ? (
              <>
                <span>Đọc tiếp · Chương {lastCh}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            ) : p.active ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang xử lý · Vào xem Chương 1</span>
                <ArrowRight className="w-4 h-4" />
              </>
            ) : firstReady ? (
              <>
                <span>Bắt đầu đọc</span>
                <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                <BookOpen className="w-4 h-4" />
                <span>Mở xem Chương 1</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Link>
          {!ready && !p.active && (
            <button
              onClick={onProcess}
              disabled={busy}
              className="inline-flex items-center gap-2 h-11 px-4 rounded-xl border border-slate-300 dark:border-white/15 text-base font-medium hover:border-teal-600 disabled:opacity-50 cursor-pointer"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}
              Viết tiếp
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
