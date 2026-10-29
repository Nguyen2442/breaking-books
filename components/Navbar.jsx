"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  ArrowRight,
  Sun,
  Moon,
  Menu,
  X,
  Zap,
  Cpu,
  Layers,
  Sparkles,
  GitCommit,
  MessageSquarePlus,
  HelpCircle,
  Tag,
  Library,
  User,
  ChevronDown,
  Globe,
  LogOut,
} from "lucide-react";

export const EXPLORE_LINKS = [
  { href: "/features", label: "Tính năng bóc tách", desc: "Mô phỏng lab 3D & flashcard", icon: Zap },
  { href: "/pricing", label: "Bảng giá hội viên", desc: "Miễn phí & Gói Studio Pro", icon: Tag },
  { href: "/about", label: "Về Breaking Books", desc: "Triết lý đọc sách tương tác", icon: HelpCircle },
  { href: "/changelog", label: "Nhật ký cập nhật", desc: "Phiên bản mới & tính năng", icon: GitCommit },
  { href: "/feedback", label: "Góp ý & Yêu cầu sách", desc: "Đóng góp ý kiến cho studio", icon: MessageSquarePlus },
  { href: "/?preview=1", label: "Trang giới thiệu công khai", desc: "Xem landing page mẫu", icon: Globe },
];

export default function Navbar() {
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState(null);
  const [isDark, setIsDark] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);
  const exploreRef = useRef(null);

  // Close explore dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (exploreRef.current && !exploreRef.current.contains(e.target)) {
        setExploreOpen(false);
      }
    }
    document.addEventListener("pointerdown", handleClickOutside);
    return () => document.removeEventListener("pointerdown", handleClickOutside);
  }, []);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));

    // 1. Immediately hydrate from cache
    try {
      const cached = localStorage.getItem("bb_user");
      if (cached) setCurrentUser(JSON.parse(cached));
    } catch {}

    // 2. Sync with server session
    function syncUser() {
      fetch("/api/auth", { cache: "no-store" })
        .then((r) => r.json())
        .then((data) => {
          if (data.ok && data.user) {
            setCurrentUser(data.user);
            try { localStorage.setItem("bb_user", JSON.stringify(data.user)); } catch {}
          } else if (data.ok && !data.user) {
            setCurrentUser(null);
            try { localStorage.removeItem("bb_user"); } catch {}
          }
        })
        .catch(() => {});
    }

    syncUser();

    function handleStorage(e) {
      if (e.key === "bb_user") {
        if (e.newValue) {
          try { setCurrentUser(JSON.parse(e.newValue)); } catch {}
        } else {
          setCurrentUser(null);
        }
      }
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [pathname]);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("bb_theme", next ? "dark" : "light");
    } catch {}
  }

  // Brand logo links directly to /library for signed-in members, or / for guests
  const homeHref = currentUser ? "/library" : "/";

  return (
    <header className="sticky top-0 z-50 bg-white/95 dark:bg-slate-950/95 border-b border-slate-200/80 dark:border-white/10 px-4 sm:px-8 py-3 transition-colors duration-200 shadow-sm">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <Link
          href={homeHref}
          className="flex items-center gap-2.5 group shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded-xl"
          title={currentUser ? "Về Studio Library" : "Trang chủ Breaking Books"}
        >
          <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center text-white shadow-md shadow-orange-500/25 motion-safe:group-hover:scale-105 motion-safe:transition-transform motion-reduce:transition-none">
            <BookOpen className="w-5 h-5" />
          </div>
          <span className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
            Breaking Books
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-1 xl:gap-2 text-xs font-semibold">
          {/* Primary Studio Link: Tủ sách */}
          <Link
            href="/library"
            className={`px-3.5 py-2 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 flex items-center gap-1.5 ${
              pathname === "/library" || pathname.startsWith("/books")
                ? "bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold"
                : "text-slate-700 dark:text-slate-300 hover:text-orange-600 hover:bg-orange-50/50 dark:hover:bg-white/5"
            }`}
          >
            <Library className="w-4 h-4" />
            <span>Tủ sách</span>
          </Link>

          {/* Primary Studio Link: Phòng Lab 3D */}
          <Link
            href="/simulation"
            className={`px-3.5 py-2 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 flex items-center gap-1.5 ${
              pathname === "/simulation"
                ? "bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold"
                : "text-slate-700 dark:text-slate-300 hover:text-orange-600 hover:bg-orange-50/50 dark:hover:bg-white/5"
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>Phòng Lab 3D</span>
          </Link>

          {/* Explore Dropdown: Gom tất cả các trang giới thiệu vào đây */}
          <div className="relative" ref={exploreRef}>
            <button
              type="button"
              onClick={() => setExploreOpen(!exploreOpen)}
              className={`px-3.5 py-2 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 flex items-center gap-1.5 cursor-pointer ${
                exploreOpen || ["/features", "/pricing", "/about", "/changelog", "/feedback"].includes(pathname)
                  ? "bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold"
                  : "text-slate-700 dark:text-slate-300 hover:text-orange-600 hover:bg-orange-50/50 dark:hover:bg-white/5"
              }`}
              aria-expanded={exploreOpen}
              aria-haspopup="true"
            >
              <Sparkles className="w-3.5 h-3.5 text-orange-500" />
              <span>Khám phá Studio</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${exploreOpen ? "rotate-180" : ""}`} />
            </button>

            {/* Dropdown Menu Panel */}
            {exploreOpen && (
              <div className="absolute top-full left-0 mt-2 w-72 rounded-2xl bg-white dark:bg-slate-900 shadow-xl border border-orange-100 dark:border-white/10 p-2 z-50 space-y-0.5">
                <div className="px-3 py-1.5 text-xs font-semibold text-slate-400">
                  Thông tin & giới thiệu
                </div>
                {EXPLORE_LINKS.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setExploreOpen(false)}
                      className={`flex items-start gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                        isActive
                          ? "bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400"
                          : "text-slate-700 dark:text-slate-300 hover:bg-orange-50/50 dark:hover:bg-slate-800"
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-orange-100 dark:bg-slate-800 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0 mt-0.5">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold leading-tight">{item.label}</div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 leading-tight mt-0.5">{item.desc}</div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        {/* Right CTA Actions */}
        <div className="flex items-center gap-2.5">
          {/* Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 active:scale-95 disabled:opacity-50"
            title="Đổi giao diện Sáng / Tối"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* User CTA: Logged In vs Guest */}
          {currentUser ? (
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/profile"
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-orange-50 dark:bg-slate-800 text-orange-600 dark:text-orange-400 border border-orange-200/60 dark:border-white/10 hover:bg-orange-100 dark:hover:bg-slate-700 flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 shrink-0"
                title="Hồ sơ thành viên & Đăng xuất"
              >
                <div className="w-5 h-5 rounded-full bg-orange-500 text-white flex items-center justify-center text-[10px] font-black">
                  {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : "U"}
                </div>
                <span className="hidden sm:inline max-w-[100px] truncate">{currentUser.name || "Hồ sơ"}</span>
              </Link>
              <Link
                href="/library"
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white shadow-md shadow-orange-500/20 flex items-center gap-1.5 transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 shrink-0"
              >
                <span className="hidden md:inline">Vào Studio</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 shrink-0">
              <Link
                href="/login?redirect=/library"
                className="hidden sm:inline-flex px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-orange-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 active:scale-[0.98]"
              >
                Đăng nhập
              </Link>
              <Link
                href="/register?redirect=/library"
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white shadow-md shadow-orange-500/20 flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 active:scale-[0.98]"
              >
                <span>Dùng thử</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}

          {/* Mobile Menu Hamburger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 active:scale-95 disabled:opacity-50"
            aria-label="Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 dark:border-white/10 mt-3 pt-3 pb-2 space-y-3 bg-white/95 dark:bg-slate-950/95">
          {/* Main Studio Links */}
          <div className="space-y-1">
            <div className="px-3 text-xs font-semibold text-slate-400">
              Khu vực học tập
            </div>
            <Link
              href="/library"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-3.5 py-2 rounded-xl text-sm font-bold text-orange-600 dark:text-orange-400 hover:bg-orange-50/50"
            >
              <Library className="w-4 h-4" />
              <span>Tủ sách của bạn</span>
            </Link>
            <Link
              href="/simulation"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-3.5 py-2 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
            >
              <Cpu className="w-4 h-4 text-slate-400" />
              <span>Phòng Lab mô phỏng 3D</span>
            </Link>
            <Link
              href="/profile"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-3.5 py-2 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
            >
              <User className="w-4 h-4 text-slate-400" />
              <span>Hồ sơ thành viên & Đăng xuất</span>
            </Link>
          </div>

          {/* Grouped Intro / Explore Links */}
          <div className="pt-2 border-t border-slate-100 dark:border-white/10 space-y-1">
            <div className="px-3 text-xs font-semibold text-slate-400">
              Khám phá & giới thiệu
            </div>
            {EXPLORE_LINKS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5"
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-3.5 h-3.5 text-orange-500" />
                    <span>{item.label}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 truncate max-w-[120px]">{item.desc}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}
