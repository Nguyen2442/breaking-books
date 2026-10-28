"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
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
  User,
  LogOut,
  Layers,
  FolderOpen,
} from "lucide-react";

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

let _globalClientOverviewCache = null;

export default function UserLibraryPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [overview, setOverview] = useState(() => {
    if (_globalClientOverviewCache) return _globalClientOverviewCache;
    return null;
  });

  const [isDark, setIsDark] = useState(false);
  const [local, setLocal] = useState({});

  // Upload flow: null | { step: 0..3, pct, fileName, error, warning, bookId }
  const [upload, setUpload] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const [busyBook, setBusyBook] = useState("");
  const [actionError, setActionError] = useState("");

  const checkUserAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/auth");
      const data = await res.json();
      if (data.ok && data.user) {
        setCurrentUser(data.user);
      } else {
        setCurrentUser(null);
      }
    } catch {
      setCurrentUser(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const fetchOverview = useCallback(async () => {
    try {
      const res = await fetch("/api/overview", { cache: "no-store" });
      const data = await res.json();
      if (data && data.ok) {
        setOverview(data);
        if (data.user) setCurrentUser(data.user);
        _globalClientOverviewCache = data;
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
    checkUserAuth();
    fetchOverview();
  }, [checkUserAuth, fetchOverview]);

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

  async function handleLogout() {
    try {
      await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
      setCurrentUser(null);
      router.push("/");
      router.refresh();
    } catch (e) {
      console.error(e);
    }
  }

  function startUpload(file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      alert("Chỉ hỗ trợ file định dạng PDF.");
      return;
    }
    const fileSizeMb = (file.size / (1024 * 1024)).toFixed(1);
    setUpload({
      step: 1,
      phase: "uploading",
      pct: 5,
      fileName: file.name,
      fileSizeMb,
      statusText: "Đang tải file PDF lên máy chủ...",
      bookId: null,
      title: null,
      chaptersCount: 0,
      error: null,
    });

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/books/upload-pdf");
    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable) {
        // Map 0 -> 100% of upload to 5% -> 45% overall
        const uploadPct = Math.round((evt.loaded / evt.total) * 45);
        setUpload((prev) => (prev ? {
          ...prev,
          pct: Math.max(5, uploadPct),
          statusText: `Đang truyền file lên máy chủ (${(evt.loaded / (1024 * 1024)).toFixed(1)} / ${fileSizeMb} MB)...`,
        } : prev));
      }
    };

    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          if (!res.ok) throw new Error(res.error || "Tải file thất bại");
          const pdfPath = res.file;

          setUpload((prev) => (prev ? {
            ...prev,
            step: 2,
            phase: "parsing",
            pct: 55,
            statusText: "Đã tải xong file! Đang trích xuất văn bản & phân tích mục lục...",
          } : prev));

          // Animate progress slightly while server parses
          const parseTimer = setInterval(() => {
            setUpload((prev) => {
              if (!prev || prev.step !== 2) return prev;
              const nextPct = Math.min(88, prev.pct + 4);
              return { ...prev, pct: nextPct };
            });
          }, 600);

          const cRes = await fetch("/api/books/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pdfPath }),
          });
          clearInterval(parseTimer);

          const cData = await cRes.json();
          if (!cData.ok) throw new Error(cData.error || "Khởi tạo sách thất bại");

          setUpload((prev) => (prev ? {
            ...prev,
            step: 3,
            phase: "completed",
            pct: 100,
            bookId: cData.bookId,
            title: cData.book?.title || prev.fileName,
            author: cData.book?.author || "",
            chaptersCount: cData.book?.chapters?.length || 1,
            statusText: "Hoàn tất! Sách đã được thêm vào thư viện.",
          } : prev));

          // Fire background AI processing without blocking the client UI!
          fetch(`/api/library/process?bookId=${encodeURIComponent(cData.bookId)}`, {
            method: "POST",
          }).catch(() => {});

          fetchOverview();
        } catch (err) {
          setUpload((prev) => (prev ? {
            ...prev,
            phase: "error",
            error: err.message || "Xảy ra lỗi trong quá trình xử lý sách.",
          } : prev));
        }
      } else {
        setUpload((prev) => (prev ? {
          ...prev,
          phase: "error",
          error: `Lỗi máy chủ (${xhr.status}): ${xhr.statusText || "Không thể xử lý file"}`,
        } : prev));
      }
    };

    xhr.onerror = () => {
      setUpload((prev) => (prev ? {
        ...prev,
        phase: "error",
        error: "Lỗi kết nối mạng khi truyền file. Vui lòng thử lại.",
      } : prev));
    };

    const fd = new FormData();
    fd.append("file", file);
    xhr.send(fd);
  }

  const books = overview?.books || [];
  const uploading = upload && upload.step < 3 && !upload.error;

  // Separate user's books from system sample books
  const myBooks = currentUser
    ? books.filter((b) => b.ownerId === currentUser.id)
    : [];
  const sampleBooks = books.filter((b) => b.isSample || !b.ownerId);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F15] text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300">
      {/* Top Header */}
      <Navbar />

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-10">
        {/* Upload Book Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-orange-600" />
                <span>Thêm sách mới vào không gian của bạn</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Tải file PDF sách để AI tự động chia chương, tạo sơ đồ tương tác và câu hỏi ôn tập.
              </p>
            </div>
          </div>

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
              className={`w-full rounded-2xl border-2 border-dashed px-6 py-8 flex flex-col items-center gap-2.5 text-center transition-all cursor-pointer ${
                dragOver
                  ? "border-orange-600 bg-orange-50/60 dark:bg-orange-500/10 scale-[1.005]"
                  : "border-slate-200 dark:border-white/10 bg-white dark:bg-[#10161D] hover:border-orange-500"
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                <Upload className="w-5 h-5" />
              </div>
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                Kéo file PDF sách vào đây, hoặc bấm để chọn file
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                Sách sẽ được lưu vào tài khoản riêng của bạn và chỉ bạn mới có quyền xem.
              </span>
            </button>
          ) : (
            <div className="rounded-2xl border border-slate-200/90 dark:border-white/10 bg-white dark:bg-[#10161D] p-6 shadow-md transition-all">
              {/* Header of Upload Card */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                    upload.phase === "completed"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                      : upload.phase === "error"
                      ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                      : "bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20"
                  }`}>
                    {upload.phase === "completed" ? (
                      <CheckCircle2 className="w-6 h-6" />
                    ) : upload.phase === "error" ? (
                      <AlertCircle className="w-6 h-6" />
                    ) : (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400">
                        {upload.fileSizeMb ? `${upload.fileSizeMb} MB` : "PDF"}
                      </span>
                      <span className="text-xs text-slate-500">
                        {upload.phase === "completed"
                          ? "Đã sẵn sàng"
                          : upload.phase === "error"
                          ? "Gặp sự cố"
                          : "Đang xử lý"}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5 line-clamp-1">
                      {upload.title || upload.fileName}
                    </h3>
                  </div>
                </div>

                {!uploading && (
                  <button
                    onClick={() => setUpload(null)}
                    className="p-1.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                    title="Đóng / Huỷ"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* 3-Step Progress Indicator */}
              <div className="grid grid-cols-3 gap-2 mt-5">
                {[
                  { step: 1, label: "1. Tải lên" },
                  { step: 2, label: "2. Xử lý PDF" },
                  { step: 3, label: "3. Sẵn sàng" },
                ].map((s) => {
                  const isDone = upload.step > s.step || upload.phase === "completed";
                  const isCurrent = upload.step === s.step && upload.phase !== "completed" && upload.phase !== "error";
                  return (
                    <div
                      key={s.step}
                      className={`px-3 py-2 rounded-xl text-center text-xs font-semibold border transition-all ${
                        isDone
                          ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                          : isCurrent
                          ? "bg-orange-50 dark:bg-orange-500/10 border-orange-500 text-orange-700 dark:text-orange-400 shadow-sm"
                          : "bg-slate-50 dark:bg-white/[0.02] border-slate-200 dark:border-white/5 text-slate-400"
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        {isDone && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                        {isCurrent && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-orange-600" />}
                        <span>{s.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Progress Bar & Status Text */}
              {upload.phase !== "error" && (
                <div className="mt-4 space-y-2">
                  <div className="h-2.5 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden p-0.5">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        upload.phase === "completed"
                          ? "bg-emerald-500"
                          : "bg-gradient-to-r from-orange-500 to-amber-500"
                      }`}
                      style={{ width: `${Math.min(100, upload.pct || 10)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {upload.statusText || "Đang xử lý..."}
                    </span>
                    <span className="font-mono font-bold text-orange-600 dark:text-orange-400">
                      {upload.pct || 10}%
                    </span>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {upload.error && (
                <div className="mt-4 p-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
                    <span>{upload.error}</span>
                  </div>
                  <button
                    onClick={() => setUpload(null)}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold transition-colors shrink-0"
                  >
                    Thử lại
                  </button>
                </div>
              )}

              {/* Completed Success Actions */}
              {upload.step === 3 && upload.phase === "completed" && (
                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-white/5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                      {upload.chaptersCount || 1} chương được tạo
                    </span>
                    <span className="hidden sm:inline">AI đang tiếp tục hoàn thiện các bản tóm tắt nâng cao ở nền.</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => setUpload(null)}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300 transition-colors"
                    >
                      Tải thêm sách
                    </button>
                    {upload.bookId && (
                      <Link
                        href={`/books/${upload.bookId}`}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-500 text-white shadow-md shadow-orange-600/25 inline-flex items-center gap-2 transition-all hover:scale-[1.02]"
                      >
                        <span>Mở sách đọc ngay</span>
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Section 1: SÁCH CỦA TÔI (User's Private Books) */}
        {currentUser && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-orange-600" />
                  <span>Sách của tôi ({myBooks.length})</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Không gian riêng tư chỉ bạn mới có quyền truy cập và đọc.
                </p>
              </div>
            </div>

            {myBooks.length === 0 ? (
              <div className="p-8 rounded-2xl bg-white dark:bg-[#10161D] border border-slate-200/80 dark:border-white/10 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-orange-50 dark:bg-orange-500/10 text-orange-600 flex items-center justify-center mx-auto">
                  <BookOpen className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Bạn chưa có cuốn sách cá nhân nào
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Hãy kéo thả hoặc chọn 1 file PDF bất kỳ ở vùng phía trên để AI bóc tách sách riêng cho bạn!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {myBooks.map((book) => renderBookCard(book, local[book.id]))}
              </div>
            )}
          </section>
        )}

        {/* Section 2: SÁCH MẪU TRẢI NGHIỆM (Shared Sample Books) */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Sách mẫu trải nghiệm hệ thống ({sampleBooks.length})</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Các bộ sách kinh điển được biên soạn sẵn phòng thí nghiệm và câu hỏi trực quan.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {sampleBooks.map((book) => renderBookCard(book, local[book.id]))}
          </div>
        </section>
      </main>
    </div>
  );

  function renderBookCard(book, progress) {
    const isSample = book.isSample || !book.ownerId;
    const complete = book.completeCount || book.stats?.completeChapters || 0;
    const total = book.totalChapters || book.stats?.totalChapters || book.chapters?.length || 1;
    const pct = Math.round((complete / total) * 100);

    return (
      <div
        key={book.id}
        className="group rounded-3xl bg-white dark:bg-[#10161D] border border-slate-200/80 dark:border-white/10 hover:border-orange-500/50 dark:hover:border-orange-500/50 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden"
      >
        <div className="p-5 space-y-4">
          <div className="flex gap-4">
            {/* Book Cover */}
            <div className="w-20 h-28 rounded-xl shrink-0 overflow-hidden bg-gradient-to-tr from-slate-800 to-slate-900 relative shadow-md">
              {book.coverUrl ? (
                <img
                  src={book.coverUrl}
                  alt={book.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div
                  className={`w-full h-full bg-gradient-to-br ${coverFor(
                    book.id
                  )} p-2 flex flex-col justify-between text-white`}
                >
                  <span className="text-[9px] font-bold uppercase tracking-wider opacity-75">
                    Breaking Books
                  </span>
                  <p className="text-[10px] font-black line-clamp-3 leading-tight">{book.title}</p>
                </div>
              )}
            </div>

            {/* Book Info */}
            <div className="min-w-0 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  {isSample ? (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/20">
                      SÁCH MẪU
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold border border-orange-500/20">
                      CỦA BẠN
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                  {book.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {book.author || "Tác giả"}
                </p>
              </div>

              <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <span>{complete}/{total} chương</span>
                <span>•</span>
                <span className="font-semibold text-orange-600 dark:text-orange-400">{pct}% hoàn thiện</span>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Action Button */}
        <div className="px-5 py-3.5 bg-slate-50/80 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            {book.stats?.totalSvgs || 0} sơ đồ lab
          </span>
          <Link
            href={`/books/${book.id}`}
            className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 transition-colors"
          >
            <span>Đọc sách ngay</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }
}
