"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Lock,
  User,
  Key,
  BookOpen,
  Eye,
  EyeOff,
  Trash2,
  RefreshCw,
  Zap,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Send,
  Loader2,
  LogOut,
  Terminal,
  Cpu,
  Layers,
  Sparkles,
  Play,
  RotateCcw,
} from "lucide-react";

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // Login form state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  // Dashboard state
  const [activeTab, setActiveTab] = useState("books"); // "books" | "api" | "system"
  const [books, setBooks] = useState([]);
  const [systemStats, setSystemStats] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  // API Console State
  const [pingResults, setPingResults] = useState({});
  const [pingingIndex, setPingingIndex] = useState(null);
  const [testPrompt, setTestPrompt] = useState("Chào bạn, hãy giới thiệu 3 ưu điểm cốt lõi của kiến trúc Microservices trong 2 câu.");
  const [promptResult, setPromptResult] = useState(null);
  const [testingPrompt, setTestingPrompt] = useState(false);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Check auth on mount
  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/auth");
      const data = await res.json();
      setAuthenticated(Boolean(data.authenticated));
    } catch {
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Load dashboard data
  const loadDashboardData = useCallback(async () => {
    if (!authenticated) return;
    setRefreshing(true);
    try {
      const [bRes, cRes] = await Promise.all([
        fetch("/api/admin/books"),
        fetch("/api/admin/console"),
      ]);
      const bData = await bRes.json();
      const cData = await cRes.json();

      if (bData.ok) setBooks(bData.books || []);
      if (cData.ok) setSystemStats(cData);
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  }, [authenticated]);

  useEffect(() => {
    if (authenticated) {
      loadDashboardData();
      const timer = setInterval(loadDashboardData, 8000);
      return () => clearInterval(timer);
    }
  }, [authenticated, loadDashboardData]);

  // Handle Login
  async function handleLogin(e) {
    e.preventDefault();
    setLoginError("");
    setLoginSubmitting(true);
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Đăng nhập thất bại");
      setAuthenticated(true);
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoginSubmitting(false);
    }
  }

  // Handle Logout
  async function handleLogout() {
    await fetch("/api/admin/auth", { method: "DELETE" });
    setAuthenticated(false);
    setUsername("");
    setPassword("");
  }

  // Toggle book visibility
  async function toggleBookVisibility(bookId, currentHidden) {
    try {
      const res = await fetch("/api/admin/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle-visibility",
          bookId,
          isHidden: !currentHidden,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setBooks((prev) =>
          prev.map((b) => (b.id === bookId ? { ...b, isHidden: !currentHidden } : b))
        );
        setActionMessage(`Đã ${!currentHidden ? "ẩn" : "hiển thị"} sách [${bookId}]`);
        setTimeout(() => setActionMessage(""), 3500);
      }
    } catch (err) {
      alert("Lỗi: " + err.message);
    }
  }

  // Delete book confirmed
  async function confirmDeleteBook() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/admin/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", bookId: deleteTarget.id }),
      });
      const data = await res.json();
      if (data.ok) {
        setBooks((prev) => prev.filter((b) => b.id !== deleteTarget.id));
        setDeleteTarget(null);
        setActionMessage(`Đã xóa vĩnh viễn sách [${deleteTarget.title}]`);
        setTimeout(() => setActionMessage(""), 3500);
      } else {
        alert(data.error || "Không xóa được sách");
      }
    } catch (err) {
      alert("Lỗi: " + err.message);
    } finally {
      setDeleting(false);
    }
  }

  // Reprocess book
  async function triggerReprocess(bookId) {
    try {
      const res = await fetch("/api/admin/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reprocess", bookId }),
      });
      const data = await res.json();
      if (data.ok) {
        setActionMessage(`Đã đưa các chương của [${bookId}] vào hàng đợi bóc tách AI!`);
        setTimeout(() => setActionMessage(""), 4000);
        loadDashboardData();
      }
    } catch (err) {
      alert("Lỗi: " + err.message);
    }
  }

  // Ping Gemini key
  async function pingGeminiKey(keyIndex) {
    setPingingIndex(keyIndex);
    try {
      const res = await fetch("/api/admin/console", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ping-key", keyIndex }),
      });
      const data = await res.json();
      setPingResults((prev) => ({
        ...prev,
        [keyIndex]: {
          ok: data.ok,
          latencyMs: data.latencyMs,
          status: data.status,
          error: data.error,
          reply: data.reply,
          testedAt: new Date().toLocaleTimeString("vi-VN"),
        },
      }));
    } catch (err) {
      setPingResults((prev) => ({
        ...prev,
        [keyIndex]: { ok: false, error: err.message },
      }));
    } finally {
      setPingingIndex(null);
    }
  }

  // Run test prompt
  async function runTestPrompt() {
    if (!testPrompt.trim()) return;
    setTestingPrompt(true);
    setPromptResult(null);
    try {
      const res = await fetch("/api/admin/console", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test-prompt",
          prompt: testPrompt,
          model: "gemini-3.5-flash",
        }),
      });
      const data = await res.json();
      setPromptResult(data);
    } catch (err) {
      setPromptResult({ ok: false, error: err.message });
    } finally {
      setTestingPrompt(false);
    }
  }

  // Toggle Auto Sweeper
  async function toggleSweeper(enabled) {
    try {
      const res = await fetch("/api/admin/console", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle-sweeper", enabled }),
      });
      const data = await res.json();
      if (data.ok) {
        setSystemStats((prev) => ({ ...prev, sweeper: data.sweeper }));
      }
    } catch (err) {
      alert("Lỗi: " + err.message);
    }
  }

  // Clear system error logs
  async function clearErrors() {
    await fetch("/api/admin/console", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clear-errors" }),
    });
    setSystemStats((prev) => ({ ...prev, errors: [] }));
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  /* ==========================================================================
     LOGIN SCREEN
     ========================================================================== */
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[#090D16] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="w-full max-w-md rounded-3xl bg-[#0F1623] border border-white/10 p-8 shadow-2xl space-y-6"
        >
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-orange-500/15 border border-orange-500/30 text-orange-500 mx-auto flex items-center justify-center font-bold shadow-lg">
              <Shield className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-extrabold text-white">Quản trị viên Hệ thống</h2>
            <p className="text-xs text-slate-400">
              Khu vực bảo mật · Breaking Books Admin Console
            </p>
          </div>

          {loginError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs text-center font-medium">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Tài khoản</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  required
                  autoFocus
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Mật khẩu</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loginSubmitting}
              className="w-full py-2.5 rounded-xl text-sm font-semibold bg-orange-600 hover:bg-orange-500 text-white transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loginSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
              <span>Đăng nhập Console</span>
            </button>
          </form>

          <p className="text-[11px] text-center text-slate-500 font-mono">
            Mặc định: tài khoản <b>admin</b> · mật khẩu <b>admin123</b>
          </p>
        </motion.div>
      </div>
    );
  }

  /* ==========================================================================
     AUTHENTICATED ADMIN COMMAND CENTER
     ========================================================================== */
  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 pb-20">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-[#0F1623]/90 backdrop-blur-md border-b border-white/10 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-500 flex items-center justify-center font-bold">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-white tracking-wide">
                BREAKING BOOKS · ADMIN CONSOLE
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 text-[10px] font-mono font-semibold border border-orange-500/30">
                Root Admin
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Kiểm soát token, đo tốc độ API, quản lý sách, ẩn/hiện & nhật ký lỗi
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadDashboardData}
            disabled={refreshing}
            className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white cursor-pointer transition-colors"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-rose-500/20 border border-white/10 text-xs font-semibold text-slate-300 hover:text-rose-400 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </header>

      {/* Action Notification Toast */}
      {actionMessage && (
        <div className="fixed top-18 right-6 z-50 px-4 py-2.5 rounded-xl bg-orange-600 text-white text-xs font-semibold shadow-2xl animate-bounce">
          ✓ {actionMessage}
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-[#0F1623] border border-white/10 max-w-fit">
          <button
            onClick={() => setActiveTab("books")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === "books" ? "bg-orange-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Quản lý Thư viện Sách ({books.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("api")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === "api" ? "bg-orange-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>API & Multi-Key Console ({systemStats?.keys?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab("system")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === "system" ? "bg-orange-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Tốc độ, Hiệu năng & Nhật ký Lỗi</span>
            {systemStats?.errors?.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            )}
          </button>
        </div>

        {/* ==================================================================
            TAB 1: BOOK MANAGEMENT (ẨN / HIỆN / XOÁ / SOẠN LẠI)
            ================================================================== */}
        {activeTab === "books" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Danh sách Sách trong Hệ thống</h3>
                <p className="text-xs text-slate-400">
                  Ẩn sách để giấu khỏi trang chủ công cộng, hoặc xóa vĩnh viễn sách lỗi
                </p>
              </div>
              <span className="text-xs font-mono text-slate-400">
                Hiển thị: <b>{books.filter((b) => !b.isHidden).length}</b> · Đang ẩn:{" "}
                <b className="text-amber-400">{books.filter((b) => b.isHidden).length}</b>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {books.map((b) => {
                const complete = b.stats?.completeChapters || 0;
                const total = b.stats?.totalChapters || b.chapters?.length || 1;
                const pct = Math.round((complete / total) * 100);

                return (
                  <div
                    key={b.id}
                    className={`rounded-2xl p-5 border transition-all space-y-4 ${
                      b.isHidden
                        ? "bg-[#0F1623]/60 border-amber-500/30 opacity-80"
                        : "bg-[#0F1623] border-white/10 hover:border-orange-500/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white truncate block">
                            {b.title}
                          </span>
                        </div>
                        <p className="text-[11px] font-mono text-slate-400 truncate">
                          ID: {b.id}
                        </p>
                      </div>

                      {/* Visibility Badge */}
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold shrink-0 border ${
                          b.isHidden
                            ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                            : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        }`}
                      >
                        {b.isHidden ? "Đang ẩn" : "Công khai"}
                      </span>
                    </div>

                    {/* Progress Stats */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                        <span>Tiến độ soạn bài:</span>
                        <span className="text-white font-bold">{complete}/{total} chương ({pct}%)</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                      {/* Hide/Show Toggle */}
                      <button
                        onClick={() => toggleBookVisibility(b.id, b.isHidden)}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer border ${
                          b.isHidden
                            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25"
                            : "bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25"
                        }`}
                      >
                        {b.isHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        <span>{b.isHidden ? "Hiện lại" : "Ẩn sách"}</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        {/* Reprocess */}
                        <button
                          onClick={() => triggerReprocess(b.id)}
                          className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white cursor-pointer"
                          title="Bóc tách lại các chương chưa xong"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>

                        {/* View reader */}
                        <a
                          href={`/books/${b.id}/ch/1`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white"
                          title="Mở xem sách"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                        </a>

                        {/* Delete */}
                        <button
                          onClick={() => setDeleteTarget(b)}
                          className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 cursor-pointer"
                          title="Xóa vĩnh viễn sách"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ==================================================================
            TAB 2: API & MULTI-KEY CONSOLE
            ================================================================== */}
        {activeTab === "api" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-bold text-white">Kiểm tra Khóa API Gemini & Đo tốc độ</h3>
              <p className="text-xs text-slate-400">
                Kiểm tra trạng thái hạn mức, đo độ trễ mạng thực tế của từng Key trong Pool
              </p>
            </div>

            {/* Keys Table */}
            <div className="rounded-2xl bg-[#0F1623] border border-white/10 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <span className="text-xs font-mono font-bold text-slate-400 uppercase">
                  Danh sách Key trong Pool ({systemStats?.keys?.length || 0})
                </span>
                <span className="text-xs text-orange-400 font-mono">
                  Thuật toán điều phối: Round-Robin + Circuit Breaker
                </span>
              </div>

              <div className="space-y-2.5">
                {(systemStats?.keys || []).map((k) => {
                  const ping = pingResults[k.index];
                  const isPinging = pingingIndex === k.index;

                  return (
                    <div
                      key={k.index}
                      className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex flex-wrap items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-lg bg-orange-500/20 text-orange-400 text-xs font-mono font-bold flex items-center justify-center">
                          #{k.index}
                        </span>
                        <div>
                          <span className="text-xs font-mono font-bold text-white block">
                            {k.masked}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            Google Generative AI API Key
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {ping && (
                          <div className="text-right">
                            {ping.ok ? (
                              <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-mono font-semibold">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>{ping.latencyMs}ms (HTTP 200 OK)</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-rose-400 font-mono font-semibold">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span>Lỗi: {ping.error}</span>
                              </span>
                            )}
                            <span className="text-[10px] text-slate-500 block font-mono">
                              Lần kiểm tra: {ping.testedAt}
                            </span>
                          </div>
                        )}

                        <button
                          onClick={() => pingGeminiKey(k.index)}
                          disabled={isPinging}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-orange-600 hover:bg-orange-500 text-white cursor-pointer transition-colors shadow-sm disabled:opacity-50"
                        >
                          {isPinging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                          <span>Đo tốc độ (Ping)</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* AI Console Playground */}
            <div className="rounded-2xl bg-[#0F1623] border border-white/10 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <span className="text-xs font-mono font-bold text-slate-400 uppercase">
                  Thử nghiệm Prompt Trực tiếp (Live Playground)
                </span>
                <span className="text-xs text-slate-400 font-mono">Model: gemini-3.5-flash</span>
              </div>

              <div className="space-y-3">
                <textarea
                  value={testPrompt}
                  onChange={(e) => setTestPrompt(e.target.value)}
                  rows={3}
                  className="w-full text-xs text-white bg-white/5 rounded-xl p-3 border border-white/10 focus:outline-none focus:border-orange-500"
                  placeholder="Nhập prompt thử nghiệm..."
                />

                <div className="flex justify-end">
                  <button
                    onClick={runTestPrompt}
                    disabled={testingPrompt}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-orange-600 hover:bg-orange-500 text-white cursor-pointer transition-colors shadow-sm disabled:opacity-50"
                  >
                    {testingPrompt ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    <span>Gửi Prompt Thử Nghiệm</span>
                  </button>
                </div>

                {promptResult && (
                  <div className="p-4 rounded-xl bg-slate-950 border border-white/10 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 border-b border-white/5 pb-1.5">
                      <span>Phản hồi từ AI:</span>
                      <span className="text-emerald-400 font-bold">Thời gian: {promptResult.latencyMs}ms</span>
                    </div>
                    <p className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed font-sans">
                      {promptResult.reply || promptResult.error}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================
            TAB 3: SYSTEM HEALTH, METRICS & ERROR LOGS
            ================================================================== */}
        {activeTab === "system" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-bold text-white">Sức khỏe Hệ thống & Tự động Hóa</h3>
              <p className="text-xs text-slate-400">
                Thông số tài nguyên máy chủ, hàng đợi nền và nhật ký lỗi gần nhất
              </p>
            </div>

            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-[#0F1623] border border-white/10 space-y-1">
                <span className="text-[11px] font-mono text-slate-400 uppercase">Bộ nhớ Heap (RAM)</span>
                <p className="text-xl font-extrabold text-white">
                  {systemStats?.system?.memory?.heapUsedMb || 0} MB
                </p>
                <span className="text-[10px] text-slate-500 font-mono">
                  RSS: {systemStats?.system?.memory?.rssMb || 0} MB
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-[#0F1623] border border-white/10 space-y-1">
                <span className="text-[11px] font-mono text-slate-400 uppercase">Thời gian hoạt động (Uptime)</span>
                <p className="text-xl font-extrabold text-emerald-400">
                  {Math.floor((systemStats?.system?.uptimeSeconds || 0) / 60)} phút
                </p>
                <span className="text-[10px] text-slate-500 font-mono">
                  PID: {systemStats?.system?.pid} · Node {systemStats?.system?.nodeVersion}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-[#0F1623] border border-white/10 space-y-1">
                <span className="text-[11px] font-mono text-slate-400 uppercase">Hàng đợi AI hiện tại</span>
                <p className="text-xl font-extrabold text-orange-400">
                  {systemStats?.sweeper?.runningCount || 0} đang chạy
                </p>
                <span className="text-[10px] text-slate-500 font-mono">
                  {systemStats?.sweeper?.queuedCount || 0} chương đang xếp hàng
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-[#0F1623] border border-white/10 space-y-1">
                <span className="text-[11px] font-mono text-slate-400 uppercase">Worker Rà soát Nền</span>
                <p className="text-xl font-extrabold text-white">
                  {systemStats?.sweeper?.enabled ? (
                    <span className="text-emerald-400">Đang BẬT</span>
                  ) : (
                    <span className="text-amber-400">Đang TẮT</span>
                  )}
                </p>
                <span className="text-[10px] text-slate-500 font-mono">Tự động soạn bài từ từ</span>
              </div>
            </div>

            {/* Auto Sweeper Controller */}
            <div className="rounded-2xl bg-[#0F1623] border border-white/10 p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <h4 className="text-xs font-bold text-white uppercase font-mono">
                    Hệ thống Rà soát Tự động (Auto-Sweeper Worker)
                  </h4>
                  <p className="text-xs text-slate-400">
                    Tự động tìm kiếm các sách chưa hoàn thành và nạp từng chương vào hàng đợi để soạn dần
                  </p>
                </div>
                <button
                  onClick={() => toggleSweeper(!systemStats?.sweeper?.enabled)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer border transition-colors ${
                    systemStats?.sweeper?.enabled
                      ? "bg-rose-500/15 text-rose-400 border-rose-500/30 hover:bg-rose-500/25"
                      : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25"
                  }`}
                >
                  {systemStats?.sweeper?.enabled ? "Tạm dừng Worker" : "Bật lại Worker"}
                </button>
              </div>

              <p className="text-xs text-slate-300 font-mono bg-white/5 p-3 rounded-xl border border-white/5">
                Trạng thái gần nhất: <b>{systemStats?.sweeper?.lastAction || "Sẵn sàng"}</b>
                <span className="block text-[10px] text-slate-500 pt-1">
                  Thời gian: {systemStats?.sweeper?.lastTime ? new Date(systemStats.sweeper.lastTime).toLocaleString("vi-VN") : "Chưa có"}
                </span>
              </p>
            </div>

            {/* Error Logs Console */}
            <div className="rounded-2xl bg-[#0F1623] border border-white/10 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-orange-500" />
                  <span className="text-xs font-mono font-bold text-slate-300 uppercase">
                    Nhật ký Lỗi Hệ thống (Error Logs Buffer)
                  </span>
                </div>
                <button
                  onClick={clearErrors}
                  className="text-xs text-slate-400 hover:text-rose-400 cursor-pointer font-mono"
                >
                  Xoá nhật ký
                </button>
              </div>

              {(systemStats?.errors || []).length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500 font-mono">
                  ✓ Hệ thống đang chạy hoàn hảo, chưa ghi nhận lỗi nào.
                </div>
              ) : (
                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {systemStats.errors.map((err) => (
                    <div
                      key={err.id}
                      className="p-3 rounded-xl bg-rose-500/[0.06] border border-rose-500/20 text-xs font-mono space-y-1"
                    >
                      <div className="flex items-center justify-between text-[11px] text-rose-400">
                        <span className="font-bold">[{err.type}]</span>
                        <span className="text-slate-500">
                          {new Date(err.timestamp).toLocaleTimeString("vi-VN")}
                        </span>
                      </div>
                      <p className="text-slate-200">{err.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-2xl bg-[#0F1623] border border-rose-500/30 p-6 space-y-4 shadow-2xl"
            >
              <div className="flex items-center gap-3 text-rose-400">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Xác nhận xóa vĩnh viễn</h3>
                  <p className="text-xs text-slate-400">Hành động này không thể hoàn tác</p>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed bg-white/5 p-3 rounded-xl border border-white/5">
                Bạn có chắc chắn muốn xóa toàn bộ sách <b>"{deleteTarget.title}"</b> (ID: {deleteTarget.id})? Toàn bộ các chương, bài học và sơ đồ liên quan trong cơ sở dữ liệu sẽ bị xóa hoàn toàn.
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-slate-300 cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={confirmDeleteBook}
                  disabled={deleting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  <span>Xác nhận xóa</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
