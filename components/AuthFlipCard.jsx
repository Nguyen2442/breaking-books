"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { Eye, EyeOff, BookOpen, Loader2, AlertCircle, ArrowRight, ArrowLeft, UserPlus, LogIn, X } from "lucide-react";

const Clay3DAuthScene = dynamic(() => import("@/components/Clay3DAuthScene"), {
  ssr: false,
  loading: () => (
    <div className="w-full aspect-square max-w-[480px] rounded-3xl bg-orange-100/40 dark:bg-slate-800/40 animate-pulse flex items-center justify-center text-xs text-orange-500 font-bold border border-orange-200/50">
      Đang tải không gian 3D…
    </div>
  ),
});

/**
 * Double-Sided Tactile 3D Auth Card
 * - Solves the mirror / backwards bug: outer container stays naturally oriented
 * - Form panel turns like a 3D book page when switching between Sign In & Sign Up
 * - Right column features ONE unified Clay3DAuthScene with 2 distinct 3D styles:
 *     * Mode "login": Developer Workstation (Desk, Laptop, Lamp, Engineer)
 *     * Mode "register": Knowledge Studio Launchpad (Golden Master Key, Blueprint, Book stack)
 * - Zero button bleeding: Lamp button strictly exists on Sign In, Key button on Sign Up
 * - Seamless URL synchronization without page reloads
 * - Hallmark anti-slop compliant: sentence case, no bounce overshoot, crisp typography
 */
export default function AuthFlipCard({ initialMode = "login" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "/library";

  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState(initialMode);
  const isRegister = mode === "register";

  useEffect(() => {
    setMounted(true);
  }, []);

  // Login form states
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Register form states
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regError, setRegError] = useState("");
  const [regLoading, setRegLoading] = useState(false);

  // Switch mode with 3D page flip and URL sync
  function switchMode(targetMode) {
    if (mode === targetMode) return;
    setMode(targetMode);
    const targetUrl =
      targetMode === "register"
        ? `/register?redirect=${encodeURIComponent(redirectUrl)}`
        : `/login?redirect=${encodeURIComponent(redirectUrl)}`;
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", targetUrl);
    }
  }

  // Handle Login submission
  async function handleLoginSubmit(e) {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", email: loginEmail, password: loginPassword }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.");
      }

      if (data.user) {
        try {
          localStorage.setItem("bb_user", JSON.stringify(data.user));
        } catch {}
      }

      router.push(redirectUrl);
      router.refresh();
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoginLoading(false);
    }
  }

  // Handle Register submission
  async function handleRegisterSubmit(e) {
    e.preventDefault();
    setRegError("");
    setRegLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register",
          name: regName,
          email: regEmail,
          password: regPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Đăng ký thất bại. Vui lòng thử lại.");
      }

      if (data.user) {
        try {
          localStorage.setItem("bb_user", JSON.stringify(data.user));
        } catch {}
      }

      router.push(redirectUrl);
      router.refresh();
    } catch (err) {
      setRegError(err.message);
    } finally {
      setRegLoading(false);
    }
  }

  return (
    <div className="w-full max-w-5xl mx-auto py-4">
      {/* Top Header Bar with Home Return & Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 px-1">
        <Link
          href="/?home=1"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white dark:bg-slate-900 border border-orange-100 dark:border-white/10 text-slate-700 dark:text-slate-300 text-xs font-bold hover:text-orange-600 hover:bg-orange-50/50 shadow-sm transition-colors cursor-pointer"
          title="Quay lại Trang chủ giới thiệu"
        >
          <ArrowLeft className="w-4 h-4 text-orange-500" />
          <span>Về trang chủ</span>
        </Link>

        <div className="inline-flex p-1.5 rounded-full bg-white dark:bg-slate-900 shadow-md border border-orange-100 dark:border-white/10 gap-1.5">
          <button
            type="button"
            onClick={() => switchMode("login")}
            className={`px-5 py-2 rounded-full text-xs font-bold transition-colors flex items-center gap-1.5 ${
              !isRegister
                ? "bg-orange-500 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-orange-600"
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign in</span>
          </button>

          <button
            type="button"
            onClick={() => switchMode("register")}
            className={`px-5 py-2 rounded-full text-xs font-bold transition-colors flex items-center gap-1.5 ${
              isRegister
                ? "bg-orange-500 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-orange-600"
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Sign up</span>
          </button>
        </div>
      </div>

      {/* Main Clay Auth Modal Card */}
      <div className="w-full rounded-[36px] sm:rounded-[44px] bg-white dark:bg-slate-900 shadow-2xl border border-orange-100 dark:border-white/10 p-6 sm:p-10 lg:p-12 overflow-hidden relative">
        {/* Top-Right Quick Close Button to Home */}
        <Link
          href="/?home=1"
          className="absolute top-5 right-5 sm:top-7 sm:right-7 w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-orange-100 hover:text-orange-600 dark:hover:bg-slate-700 text-slate-400 flex items-center justify-center transition-colors z-20"
          title="Đóng và quay về trang chủ"
          aria-label="Đóng và quay về trang chủ"
        >
          <X className="w-4 h-4" />
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: 3D Book Page Flip Form Panel */}
          <div className="lg:col-span-6 relative min-h-[460px] flex flex-col justify-center" style={{ perspective: "1200px" }}>
            <AnimatePresence mode="wait">
              {!isRegister ? (
                /* ========================================================== */
                /* PAGE 1: SIGN IN FORM                                       */
                /* ========================================================== */
                <motion.div
                  key="login-page"
                  initial={{ rotateY: -70, opacity: 0 }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  exit={{ rotateY: 70, opacity: 0 }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  style={{ transformOrigin: "left center" }}
                  className="space-y-6"
                >
                  <Link
                    href="/?home=1"
                    className="inline-flex items-center gap-2 group focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none rounded-xl"
                  >
                    <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center text-white shadow-md shadow-orange-500/25 motion-safe:group-hover:scale-105 motion-safe:transition-transform motion-reduce:transition-none">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <span className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                      Breaking Books
                    </span>
                  </Link>

                  <div>
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-orange-500 dark:text-orange-400 tracking-tight">
                      Hello Again!
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-sm leading-relaxed">
                      Đăng nhập để tiếp tục đọc sách công nghệ và mô phỏng hệ thống phân tán.
                    </p>
                  </div>

                  {loginError && (
                    <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2.5">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{loginError}</span>
                    </div>
                  )}

                  <form onSubmit={handleLoginSubmit} className="space-y-4 max-w-md">
                    <div>
                      <input
                        type="text"
                        required
                        placeholder="Enter username or email"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        className="w-full rounded-2xl bg-orange-50/30 dark:bg-slate-800/80 border border-orange-100 dark:border-white/10 px-5 py-3.5 sm:py-4 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 transition-colors"
                      />
                    </div>

                    <div className="relative">
                      <input
                        type={showLoginPassword ? "text" : "password"}
                        required
                        placeholder="Your password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="w-full rounded-2xl bg-orange-50/30 dark:bg-slate-800/80 border border-orange-100 dark:border-white/10 px-5 py-3.5 sm:py-4 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 transition-colors pr-12"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        className="p-1.5 rounded-lg absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                        aria-label={showLoginPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                      >
                        {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    <div className="flex justify-end pt-0.5">
                      <Link
                        href="/feedback"
                        className="text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded"
                      >
                        Forgot your password?
                      </Link>
                    </div>

                    <button
                      type="submit"
                      disabled={loginLoading}
                      className="w-full py-3.5 sm:py-4 rounded-2xl bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white font-bold text-sm shadow-md shadow-orange-500/25 transition-transform duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                      {loginLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Signing in…</span>
                        </>
                      ) : (
                        <span>Sign in</span>
                      )}
                    </button>
                  </form>

                  <div className="pt-2">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      No account yet?{" "}
                      <button
                        type="button"
                        onClick={() => switchMode("register")}
                        className="font-bold text-orange-600 dark:text-orange-400 hover:underline inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded cursor-pointer"
                      >
                        <span>Lật trang Sign up</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </p>
                  </div>
                </motion.div>
              ) : (
                /* ========================================================== */
                /* PAGE 2: SIGN UP FORM                                       */
                /* ========================================================== */
                <motion.div
                  key="register-page"
                  initial={{ rotateY: 70, opacity: 0 }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  exit={{ rotateY: -70, opacity: 0 }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  style={{ transformOrigin: "left center" }}
                  className="space-y-6"
                >
                  <Link
                    href="/"
                    className="inline-flex items-center gap-2 group focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none rounded-xl"
                  >
                    <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center text-white shadow-md shadow-orange-500/25 motion-safe:group-hover:scale-105 motion-safe:transition-transform motion-reduce:transition-none">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <span className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                      Breaking Books
                    </span>
                  </Link>

                  <div>
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-orange-500 dark:text-orange-400 tracking-tight">
                      Join the Studio
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-sm leading-relaxed">
                      Tạo tài khoản để nhận Master Key và mở khóa toàn bộ kho sách tương tác 3D.
                    </p>
                  </div>

                  {regError && (
                    <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2.5">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{regError}</span>
                    </div>
                  )}

                  <form onSubmit={handleRegisterSubmit} className="space-y-4 max-w-md">
                    <div>
                      <input
                        type="text"
                        placeholder="Full name (e.g. Alex Rivera)"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        className="w-full rounded-2xl bg-orange-50/30 dark:bg-slate-800/80 border border-orange-100 dark:border-white/10 px-5 py-3.5 sm:py-4 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 transition-colors"
                      />
                    </div>

                    <div>
                      <input
                        type="email"
                        required
                        placeholder="Work or personal email"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        className="w-full rounded-2xl bg-orange-50/30 dark:bg-slate-800/80 border border-orange-100 dark:border-white/10 px-5 py-3.5 sm:py-4 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 transition-colors"
                      />
                    </div>

                    <div className="relative">
                      <input
                        type={showRegPassword ? "text" : "password"}
                        required
                        placeholder="Create a secure password"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        className="w-full rounded-2xl bg-orange-50/30 dark:bg-slate-800/80 border border-orange-100 dark:border-white/10 px-5 py-3.5 sm:py-4 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 transition-colors pr-12"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="p-1.5 rounded-lg absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                        aria-label={showRegPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                      >
                        {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={regLoading}
                      className="w-full py-3.5 sm:py-4 rounded-2xl bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white font-bold text-sm shadow-md shadow-orange-500/25 transition-transform duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                      {regLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Creating account…</span>
                        </>
                      ) : (
                        <span>Create account</span>
                      )}
                    </button>
                  </form>

                  <div className="pt-2">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Already have an account?{" "}
                      <button
                        type="button"
                        onClick={() => switchMode("login")}
                        className="font-bold text-orange-600 dark:text-orange-400 hover:underline inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded cursor-pointer"
                      >
                        <span>Lật về Sign in</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Column: Unified 3D Clay Scene with 2 Distinct Styles */}
          <div className="lg:col-span-6 flex flex-col items-center justify-center">
            {mounted ? (
              <Clay3DAuthScene mode={mode} className="w-full" />
            ) : (
              <div className="w-full aspect-square max-w-[480px] rounded-3xl bg-orange-100/40 dark:bg-slate-800/40 animate-pulse flex items-center justify-center text-xs text-orange-500 font-bold border border-orange-200/50">
                Đang tải không gian 3D…
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
