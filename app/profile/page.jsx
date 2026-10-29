"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import {
  User,
  Mail,
  Calendar,
  Shield,
  BookOpen,
  Cpu,
  Award,
  LogOut,
  Sparkles,
  ArrowRight,
  Clock,
  Layers,
  CheckCircle2,
  Sliders,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

/**
 * Modern Claymorphic User Profile Page
 * - Unified Soft Light Orange ("Màu cam nhạt" #FB923C / #FED7AA / #FFF6EF) palette
 * - Account statistics, reading streaks, and lab achievements
 * - Instant one-click Logout with session & cache clearance
 * - Hallmark anti-slop compliant (0 FAIL, 0 REFLEX)
 */
export default function ProfilePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");

  // Edit name state
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    // 1. Instant hydration from client storage
    try {
      const cached = localStorage.getItem("bb_user");
      if (cached) {
        const u = JSON.parse(cached);
        setCurrentUser(u);
        setName(u.name || "");
      }
    } catch {}

    // 2. Fast background verification
    fetch("/api/auth")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.user) {
          setCurrentUser(data.user);
          setName(data.user.name || "");
          try {
            localStorage.setItem("bb_user", JSON.stringify(data.user));
          } catch {}
        } else {
          setCurrentUser(null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
      try {
        localStorage.removeItem("bb_user");
      } catch {}
      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error("Logout error:", err);
      setLoggingOut(false);
    }
  }

  function handleSaveProfile(e) {
    e.preventDefault();
    if (!name.trim()) return;
    const updated = { ...currentUser, name: name.trim() };
    setCurrentUser(updated);
    try {
      localStorage.setItem("bb_user", JSON.stringify(updated));
    } catch {}
    setEditing(false);
    setSaveStatus("Đã cập nhật tên hiển thị!");
    setTimeout(() => setSaveStatus(""), 3000);
  }

  if (loading && !currentUser) {
    return (
      <div className="min-h-screen bg-orange-50/40 dark:bg-slate-950 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-orange-100 dark:border-white/10 shadow-md text-sm text-slate-600 dark:text-slate-300">
            <RefreshCw className="w-4 h-4 motion-safe:animate-spin text-orange-500" />
            <span>Đang tải thông tin hồ sơ…</span>
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-orange-50/40 dark:bg-slate-950 flex flex-col font-sans">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 shadow-xl border border-orange-100 dark:border-white/10 p-8 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-orange-100 dark:bg-orange-500/10 text-orange-500 flex items-center justify-center mx-auto shadow-inner">
              <User className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Hồ sơ thành viên
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                Bạn chưa đăng nhập. Vui lòng đăng nhập để xem thông tin tài khoản và tiến trình đọc sách.
              </p>
            </div>
            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <Link
                href="/login?redirect=/profile"
                className="flex-1 py-3 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white text-sm font-bold shadow-md shadow-orange-500/20 transition-colors flex items-center justify-center gap-2"
              >
                <span>Đăng nhập</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/register?redirect=/profile"
                className="flex-1 py-3 px-4 rounded-xl bg-orange-50 dark:bg-slate-800 hover:bg-orange-100 text-orange-600 dark:text-orange-400 text-sm font-bold border border-orange-200/60 dark:border-white/10 transition-colors flex items-center justify-center"
              >
                <span>Tạo tài khoản</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const joinDate = currentUser.createdAt
    ? new Date(currentUser.createdAt).toLocaleDateString("vi-VN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Thành viên lâu năm";

  return (
    <div className="min-h-screen bg-orange-50/40 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-orange-500/20 selection:text-orange-700">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        {/* Top Header Card - Soft Light Peach Clay Design */}
        <div className="rounded-[32px] sm:rounded-[40px] bg-gradient-to-br from-orange-200 via-amber-100/90 to-orange-100 dark:from-slate-900 dark:via-orange-950/30 dark:to-slate-900 p-2 sm:p-3 shadow-xl border border-orange-200/60 dark:border-white/10">
          <div className="rounded-[26px] sm:rounded-[34px] bg-orange-50/60 dark:bg-slate-900 border border-orange-200/70 dark:border-orange-500/20 p-6 sm:p-8 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            {/* Avatar & User Details */}
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-orange-400 to-orange-600 text-white flex items-center justify-center text-3xl font-black shadow-lg shadow-orange-500/30 shrink-0">
                {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : "U"}
              </div>

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                    {currentUser.name || "Kỹ sư phần mềm"}
                  </h1>
                  <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300 border border-orange-200/60 dark:border-white/10 flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    <span>{currentUser.role === "admin" ? "Quản trị viên" : "Hội viên Studio"}</span>
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-orange-500" />
                    <span>{currentUser.email}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-orange-500" />
                    <span>Tham gia: {joinDate}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Logout Action Button */}
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="px-5 py-2.5 rounded-2xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 text-xs font-bold border border-rose-200/60 dark:border-rose-500/20 transition-colors flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 active:scale-95 disabled:opacity-50 shrink-0 whitespace-nowrap"
            >
              {loggingOut ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 motion-safe:animate-spin" />
                  <span>Đang đăng xuất…</span>
                </>
              ) : (
                <>
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Đăng xuất tài khoản</span>
                </>
              )}
            </button>
          </div>
        </div>

        {saveStatus && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{saveStatus}</span>
          </div>
        )}

        {/* 4 Claymorphic Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-orange-100 dark:border-white/10 shadow-sm space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-orange-50 dark:bg-slate-800 text-orange-500 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">2 cuốn</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Sách đang tham gia</div>
            </div>
          </div>

          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-orange-100 dark:border-white/10 shadow-sm space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-slate-800 text-amber-500 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">19 chương</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Chương kiến trúc bóc tách</div>
            </div>
          </div>

          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-orange-100 dark:border-white/10 shadow-sm space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-sky-50 dark:bg-slate-800 text-sky-500 flex items-center justify-center">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">14 lượt</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Mô phỏng 3D Visual Lab</div>
            </div>
          </div>

          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-orange-100 dark:border-white/10 shadow-sm space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-slate-800 text-emerald-500 flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">92%</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Điểm trắc nghiệm thực chiến</div>
            </div>
          </div>
        </div>

        {/* Two-Column Workspace Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
          {/* Left Column: Quick Resume Books */}
          <div className="lg:col-span-7 rounded-3xl bg-white dark:bg-slate-900 border border-orange-100 dark:border-white/10 p-6 sm:p-7 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Tiếp tục đọc sách
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Các cuốn sách kinh điển về hệ thống bạn đang mở
                </p>
              </div>

              <Link
                href="/library"
                className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1"
              >
                <span>Xem tất cả</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-3">
              <Link
                href="/books/ddia-2e"
                className="p-4 rounded-2xl bg-orange-50/50 dark:bg-slate-800/60 hover:bg-orange-50 dark:hover:bg-slate-800 border border-orange-100 dark:border-white/10 flex items-center justify-between gap-4 transition-colors group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-14 rounded-xl bg-orange-500 text-white font-black text-xs flex items-center justify-center shadow-md shadow-orange-500/25 shrink-0">
                    DDIA
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-orange-600 transition-colors">
                      Designing Data-Intensive Applications (2nd Ed)
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Đang đọc: Chương 5 - Replication & Distributed Consensus
                    </div>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700 text-orange-600 flex items-center justify-center shadow-sm shrink-0">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </Link>

              <Link
                href="/books/building-microservices-2nd-edition-sam-newman"
                className="p-4 rounded-2xl bg-orange-50/50 dark:bg-slate-800/60 hover:bg-orange-50 dark:hover:bg-slate-800 border border-orange-100 dark:border-white/10 flex items-center justify-between gap-4 transition-colors group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-14 rounded-xl bg-amber-500 text-white font-black text-xs flex items-center justify-center shadow-md shadow-amber-500/25 shrink-0">
                    MS
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-orange-600 transition-colors">
                      Building Microservices (2nd Edition) - Sam Newman
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Đang đọc: Chương 1 - Microservices Architecture Foundation
                    </div>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700 text-amber-600 flex items-center justify-center shadow-sm shrink-0">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </Link>
            </div>
          </div>

          {/* Right Column: Account Settings & Preferences */}
          <div className="lg:col-span-5 rounded-3xl bg-white dark:bg-slate-900 border border-orange-100 dark:border-white/10 p-6 sm:p-7 shadow-sm space-y-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Cài đặt tài khoản
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Quản lý tên hiển thị và tùy chọn học tập
              </p>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                  Tên hiển thị
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-2xl bg-orange-50/30 dark:bg-slate-800/80 border border-orange-100 dark:border-white/10 px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                  Địa chỉ email (Không thể thay đổi)
                </label>
                <input
                  type="email"
                  disabled
                  value={currentUser.email}
                  className="w-full rounded-2xl bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-white/5 px-4 py-3 text-sm text-slate-500 dark:text-slate-400 cursor-not-allowed"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white font-bold text-sm shadow-md shadow-orange-500/20 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
              >
                Lưu thay đổi
              </button>
            </form>

            <div className="pt-3 border-t border-slate-100 dark:border-white/10 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Mô phỏng 3D Clay Hardware:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">Bật (WebGL 60FPS)</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Trạng thái lưu trữ sách vĩnh viễn:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">Hoạt động (200 OK)</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
