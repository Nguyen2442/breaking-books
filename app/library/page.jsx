"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
      alert("Chỉ hỗ trợ file PDF.");
      return;
    }
    const state = {
      step: 0,
      pct: 0,
      fileName: file.name,
      pdfPath: null,
      bookId: null,
      title: null,
      author: null,
      error: null,
      warning: null,
    };
    setUpload({ ...state });

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/books/upload-pdf");
    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable) {
        const pct = Math.round((evt.loaded / evt.total) * 100);
        setUpload((prev) => (prev ? { ...prev, pct } : prev));
      }
    };
    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          if (!res.ok) throw new Error(res.error || "Tải file thất bại");
          const pdfPath = res.file;
          setUpload((prev) => (prev ? { ...prev, step: 1, pct: 100, pdfPath } : prev));

          const cRes = await fetch("/api/books/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pdfPath }),
          });
          const cData = await cRes.json();
          if (!cData.ok) throw new Error(cData.error || "Khởi tạo sách thất bại");

          setUpload((prev) =>
            prev
              ? {
                  ...prev,
                  step: 2,
                  bookId: cData.bookId,
                  title: cData.book?.title,
                  author: cData.book?.author,
                }
              : prev
          );

          await fetch(`/api/library/process?bookId=${encodeURIComponent(cData.bookId)}`, {
            method: "POST",
          });

          setUpload((prev) => (prev ? { ...prev, step: 3 } : prev));
          fetchOverview();
        } catch (err) {
          setUpload((prev) => (prev ? { ...prev, error: err.message } : prev));
        }
      } else {
        setUpload((prev) =>
          prev ? { ...prev, error: `Lỗi máy chủ (${xhr.status}): ${xhr.statusText}` } : prev
        );
      }
    };
    xhr.onerror = () => {
      setUpload((prev) => (prev ? { ...prev, error: "Lỗi kết nối mạng khi tải file." } : prev));
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
      <header className="sticky top-0 z-30 backdrop-blur-md bg-white/80 dark:bg-[#0F1623]/80 border-b border-slate-200/80 dark:border-white/10 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center text-white shadow-md shadow-orange-500/20 group-hover:scale-105 transition-transform">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <span className="text-base font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-slate-600 dark:from-white dark:via-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
                Breaking Books
              </span>
              <span className="hidden sm:inline-block ml-2 text-[10px] font-mono px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-700 dark:text-orange-400 font-semibold border border-orange-500/20">
                Thư viện cá nhân
              </span>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {authLoading ? (
            <div className="w-6 h-6 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
          ) : currentUser ? (
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10">
                <div className="w-6 h-6 rounded-lg bg-orange-600 flex items-center justify-center text-white text-xs font-bold uppercase">
                  {currentUser.name ? currentUser.name.charAt(0) : "U"}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-bold leading-none">{currentUser.name}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                    {currentUser.email}
                  </p>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-rose-500/10 border border-slate-200/80 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                title="Đăng xuất"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login?redirect=/library"
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-orange-600 transition-colors"
              >
                Đăng nhập
              </Link>
              <Link
                href="/register?redirect=/library"
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-500 text-white shadow-sm shadow-orange-600/20 transition-all"
              >
                Đăng ký
              </Link>
            </div>
          )}

          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 transition-colors cursor-pointer"
            title="Đổi giao diện Sáng / Tối"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

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
            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#10161D] p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-slate-500">Đang xử lý tải sách lên</p>
                  <p className="text-base font-bold">{upload.title || upload.fileName}</p>
                </div>
                {!uploading && (
                  <button
                    onClick={() => setUpload(null)}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs text-slate-500 hover:text-slate-900"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {upload.error && (
                <div className="mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{upload.error}</span>
                </div>
              )}

              {uploading && (
                <div className="mt-4 space-y-2">
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-orange-600 transition-all duration-300"
                      style={{ width: `${upload.pct || 30}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 font-mono">Đang xử lý: {upload.pct}%...</p>
                </div>
              )}

              {upload.step === 3 && (
                <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-100 dark:border-white/5">
                  <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Đã tạo sách thành công! Đang tiến hành soạn các chương...
                  </span>
                  {upload.bookId && (
                    <Link
                      href={`/books/${upload.bookId}`}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-orange-600 text-white hover:bg-orange-500 inline-flex items-center gap-1.5"
                    >
                      <span>Mở sách ngay</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
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
