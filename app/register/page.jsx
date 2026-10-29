"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, Lock, Mail, User, ArrowRight, Loader2, AlertCircle, CheckCircle2, Sparkles, ShieldCheck } from "lucide-react";
import Interactive3DBook from "@/components/Interactive3DBook";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "/library";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp!");
      return;
    }
    if (password.length < 6) {
      setError("Mật khẩu phải có tối thiểu 6 ký tự!");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "register", name, email, password }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Đăng ký không thành công. Vui lòng thử lại.");
      }

      if (data.user) {
        try {
          localStorage.setItem("bb_user", JSON.stringify(data.user));
        } catch {}
      }

      router.push(redirectUrl);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden selection:bg-orange-500/30 selection:text-orange-300">
      {/* Background Subtle Accent */}
      <div className="absolute top-0 inset-x-0 h-64 bg-gradient-to-b from-orange-500/10 to-transparent pointer-events-none" />

      {/* Main Container (Two Columns on Desktop) */}
      <div className="w-full max-w-5xl z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Left Column: 3D Interactive Book Showcase */}
        <div className="hidden lg:flex lg:col-span-6 flex-col items-center justify-center text-center space-y-6">
          <div className="space-y-3">
            <div>
              <span className="text-xs font-semibold text-emerald-400">
                Khởi đầu trải nghiệm mới
              </span>
            </div>
            <h2 className="text-3xl font-black tracking-tight leading-tight">
              Tạo không gian đọc <br />
              <span className="text-emerald-400">
                cá nhân hóa hoàn toàn miễn phí.
              </span>
            </h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              Tải lên các cuốn sách PDF yêu thích của bạn, để hệ thống AI tự động phân tích mục lục và tạo sơ đồ tương tác tức thì.
            </p>
          </div>

          <div className="w-full max-w-sm">
            <Interactive3DBook
              title="Building Microservices (2nd Edition)"
              subtitle="Fine-Grained Systems & Architecture"
              author="Sam Newman"
              size="md"
              badge="Phiên bản mới nhất"
              coverGradient="from-indigo-700 via-slate-800 to-slate-950"
              spineColor="#1e1b4b"
            />
          </div>

          <div className="flex items-center gap-6 text-xs text-slate-400 pt-2">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Dữ liệu lưu trữ riêng tư</span>
            </span>
            <span>:</span>
            <span>Không giới hạn số lần đọc</span>
          </div>
        </div>

        {/* Right Column: 3D Glassmorphism Register Card */}
        <div className="lg:col-span-6 w-full max-w-md mx-auto">
          {/* Brand Logo Header */}
          <div className="text-center mb-6">
            <Link href="/" className="inline-flex items-center gap-2.5 group focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none rounded-xl">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/25 motion-safe:group-hover:scale-105 transition-transform">
                <BookOpen className="w-6 h-6" />
              </div>
              <span className="text-2xl font-black tracking-tight text-white">
                Breaking Books
              </span>
            </Link>
            <h1 className="text-xl font-bold text-white mt-3">Đăng ký tài khoản</h1>
            <p className="text-xs text-slate-400 mt-1">
              Bắt đầu hành trình đọc sách tương tác đỉnh cao chỉ trong 30 giây.
            </p>
          </div>

          {/* Form Card */}
          <div
            className="rounded-3xl bg-slate-900 border border-white/10 p-7 sm:p-8 shadow-2xl transition-colors duration-200"
            style={{
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7), inset 0 1px 1px rgba(255, 255, 255, 0.15)",
            }}
          >
            {error && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Họ và tên
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    required
                    placeholder="Nguyễn Văn A"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Địa chỉ Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Mật khẩu
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Nhập lại mật khẩu
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-orange-600 hover:bg-orange-500 active:bg-orange-700 shadow-lg shadow-orange-600/25 flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang tạo tài khoản…</span>
                    </>
                  ) : (
                    <>
                      <span>Đăng ký tài khoản ngay</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>

            <div className="mt-5 pt-4 border-t border-white/10 text-center">
              <p className="text-xs text-slate-400">
                Đã có tài khoản?{" "}
                <Link
                  href={`/login?redirect=${encodeURIComponent(redirectUrl)}`}
                  className="font-bold text-orange-400 hover:text-orange-300 transition-colors focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none rounded"
                >
                  Đăng nhập tại đây
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#070A0F] flex items-center justify-center text-white">
          <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
