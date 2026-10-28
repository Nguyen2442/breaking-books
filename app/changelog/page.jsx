"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import {
  BookOpen,
  ArrowRight,
  Sparkles,
  Calendar,
  CheckCircle2,
  Tag,
  Moon,
  Sun,
  Loader2,
  GitCommit,
} from "lucide-react";

export default function ChangelogPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isDark, setIsDark] = useState(false);
  const [changelogs, setChangelogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
    fetch("/api/auth")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.user) setCurrentUser(data.user);
      })
      .catch(() => {});

    fetch("/api/changelog")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setChangelogs(data.changelogs || []);
      })
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("bb_theme", next ? "dark" : "light");
    } catch {}
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#090D13] text-slate-900 dark:text-slate-100 font-sans selection:bg-orange-500/20 selection:text-orange-700 dark:selection:text-orange-300 transition-colors duration-300">
      {/* Background Ambience */}
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-orange-500/10 via-amber-500/5 to-transparent pointer-events-none" />

      {/* Header */}
      <Navbar />

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-16 sm:py-24 space-y-16">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs font-semibold border border-orange-500/20">
            <GitCommit className="w-3.5 h-3.5" />
            <span>Tiến trình phát triển sản phẩm</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
            Nhật ký thay đổi & Cập nhật tính năng
          </h1>
          <p className="text-base text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
            Chúng tôi liên tục cải tiến và bổ sung các tính năng học tập mới mỗi tuần để mang lại trải nghiệm đọc sách tốt nhất cho bạn.
          </p>
        </div>

        {loading ? (
          <div className="py-20 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto" />
            <p className="text-xs text-slate-500 mt-2">Đang tải nhật ký cập nhật...</p>
          </div>
        ) : (
          <div className="relative border-l-2 border-orange-500/20 dark:border-white/10 ml-4 sm:ml-8 pl-6 sm:pl-10 space-y-12">
            {changelogs.map((item, idx) => (
              <div key={item.id || idx} className="relative group">
                {/* Timeline Dot */}
                <div className="absolute -left-[31px] sm:-left-[47px] top-1.5 w-4 h-4 rounded-full bg-orange-600 border-4 border-white dark:border-[#090D13] shadow-md" />

                <div className="p-6 sm:p-8 rounded-3xl bg-slate-50 dark:bg-[#10161D] border border-slate-200/80 dark:border-white/10 hover:border-orange-500/30 transition-all space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="px-3 py-1 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 font-mono font-bold text-xs border border-orange-500/20">
                        {item.version}
                      </span>
                      {item.badge && (
                        <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{new Date(item.releaseDate).toLocaleDateString("vi-VN")}</span>
                    </div>
                  </div>

                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    {item.title}
                  </h2>

                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {item.description}
                  </p>

                  {item.changes && item.changes.length > 0 && (
                    <div className="pt-2 border-t border-slate-200/60 dark:border-white/5 space-y-2">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Những cải tiến nổi bật:
                      </p>
                      <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                        {item.changes.map((c, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                            <span>{c}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="p-8 rounded-3xl bg-slate-50 dark:bg-[#10161D] border border-slate-200/80 dark:border-white/10 text-center space-y-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Bạn có ý tưởng hoặc muốn một tính năng mới?
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Hãy gửi yêu cầu của bạn qua trang Góp ý tính năng. Cộng đồng sẽ bình chọn để đội ngũ đưa vào lộ trình phát triển!
          </p>
          <Link
            href="/feedback"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-500 text-white shadow-sm transition-all mt-2"
          >
            <span>Góp ý tính năng ngay</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-white/10 py-8 px-4 text-center text-xs text-slate-500 space-y-2">
        <p>Breaking Books © 2026 · Nền tảng Đọc sách & Trực quan hoá Thông minh cho Tất cả Mọi người</p>
      </footer>
    </div>
  );
}
