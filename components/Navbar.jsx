"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  ArrowRight,
  Sun,
  Moon,
  Menu,
  X,
  Home,
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
  ExternalLink,
} from "lucide-react";

export const NAV_LINKS = [
  { href: "/", label: "Trang chủ", icon: Home },
  { href: "/features", label: "Tính năng", icon: Zap },
  { href: "/simulation", label: "Phòng Lab", icon: Cpu },
  { href: "/books", label: "Tủ sách", icon: BookOpen },
  { href: "/pricing", label: "Bảng giá", icon: Tag },
  { href: "/about", label: "Giới thiệu", icon: HelpCircle },
  { href: "/changelog", label: "Nhật ký", icon: GitCommit },
  { href: "/feedback", label: "Góp ý", icon: MessageSquarePlus },
];

export default function Navbar() {
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState(null);
  const [isDark, setIsDark] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));

    // 1. Immediately hydrate from cache to prevent login state flicker across tabs
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

    // 3. Listen to storage changes from other tabs
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

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-white/90 dark:bg-slate-950/90 border-b border-slate-200/80 dark:border-white/10 px-4 sm:px-8 py-3 transition-colors duration-200">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <Link
          href="/"
          className="flex items-center gap-2.5 group shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded-xl"
        >
          <div className="w-9 h-9 rounded-xl bg-orange-600 flex items-center justify-center text-white shadow-md shadow-orange-500/20 motion-safe:group-hover:scale-105 motion-safe:transition-transform motion-reduce:transition-none">
            <BookOpen className="w-5 h-5" />
          </div>
          <span className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
            Breaking Books
          </span>
        </Link>

        {/* Desktop Nav links */}
        <nav className="hidden lg:flex items-center gap-1 xl:gap-1.5 text-xs font-semibold">
          {NAV_LINKS.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(item.href + "/");

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 active:scale-[0.98] ${
                  isActive
                    ? "bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold"
                    : "text-slate-600 dark:text-slate-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-slate-100 dark:hover:bg-white/5"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right Action buttons */}
        <div className="flex items-center gap-2.5">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 active:scale-95 disabled:opacity-50"
            title="Đổi giao diện Sáng / Tối"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* User CTA */}
          {currentUser ? (
            <Link
              href="/library"
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-500 text-white shadow-md shadow-orange-600/20 flex items-center gap-2 transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 shrink-0"
            >
              <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">
                {currentUser.name ? currentUser.name.charAt(0) : "U"}
              </div>
              <span className="hidden sm:inline">Thư viện của tôi</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
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
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-500 text-white shadow-md shadow-orange-600/20 flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 active:scale-[0.98]"
              >
                <span>Dùng thử</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}

          {/* Mobile Menu Hamburger */}
          <button
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
        <div className="lg:hidden border-t border-slate-200 dark:border-white/10 mt-3 pt-3 pb-2 space-y-1 bg-white/95 dark:bg-slate-950/95">
          {NAV_LINKS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(item.href + "/");

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  isActive
                    ? "bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-orange-600 dark:text-orange-400" : "text-slate-400"}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <div className="pt-2 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between px-2 text-xs">
            <Link
              href="/library"
              onClick={() => setMobileMenuOpen(false)}
              className="font-bold text-orange-600 dark:text-orange-400 flex items-center gap-1.5 py-1"
            >
              <Library className="w-4 h-4" />
              <span>Vào Thư viện sách</span>
            </Link>
            <Link
              href="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className="text-slate-400 hover:text-slate-200 py-1"
            >
              Quản trị viên
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
