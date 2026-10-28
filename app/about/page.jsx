"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  BookOpen,
  ArrowRight,
  Sparkles,
  Heart,
  Users,
  Compass,
  Zap,
  GraduationCap,
  Briefcase,
  Lightbulb,
  CheckCircle2,
  Moon,
  Sun,
  Flame,
} from "lucide-react";

export default function AboutPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
    fetch("/api/auth")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.user) setCurrentUser(data.user);
      })
      .catch(() => {});
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
      <header className="sticky top-0 z-40 backdrop-blur-md bg-white/80 dark:bg-[#090D13]/80 border-b border-slate-200/80 dark:border-white/10 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center text-white shadow-md shadow-orange-500/20 group-hover:scale-105 transition-transform">
            <BookOpen className="w-5 h-5" />
          </div>
          <span className="text-lg font-black tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-slate-600 dark:from-white dark:via-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
            Breaking Books
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-600 dark:text-slate-400">
          <Link href="/features" className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors">
            Tính năng cốt lõi
          </Link>
          <Link href="/about" className="text-orange-600 dark:text-orange-400 font-bold transition-colors">
            Giới thiệu
          </Link>
          <Link href="/changelog" className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors">
            Nhật ký cập nhật
          </Link>
          <Link href="/feedback" className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors">
            Góp ý tính năng
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 transition-colors cursor-pointer"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          {currentUser ? (
            <Link
              href="/library"
              className="px-4 py-2 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-500 text-white shadow-md transition-all flex items-center gap-1.5"
            >
              <span>Vào Thư viện</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          ) : (
            <Link
              href="/login?redirect=/library"
              className="px-4 py-2 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-500 text-white shadow-md transition-all"
            >
              Dùng thử ngay
            </Link>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-16 sm:py-24 space-y-16">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs font-semibold border border-orange-500/20">
            <Heart className="w-3.5 h-3.5 fill-current" />
            <span>Sứ mệnh của Breaking Books</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
            Biến tri thức từ trang sách thành <br />
            <span className="bg-gradient-to-r from-orange-600 via-amber-500 to-orange-500 bg-clip-text text-transparent">
              trải nghiệm sống động cho tất cả mọi người
            </span>
          </h1>
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Chúng tôi tin rằng việc đọc sách không nên là một cuộc chiến đơn độc với những trang giấy chi chít chữ. Bất kỳ ai cũng xứng đáng được tiếp cận tri thức tinh hoa theo cách dễ hiểu, trực quan và hào hứng nhất.
          </p>
        </div>

        {/* Story Section */}
        <div className="p-8 sm:p-10 rounded-3xl bg-slate-50 dark:bg-[#10161D] border border-slate-200/80 dark:border-white/10 space-y-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Tại sao Breaking Books ra đời?</h2>
              <p className="text-xs text-slate-500">Câu chuyện và trăn trở đằng sau dự án</p>
            </div>
          </div>

          <div className="text-sm text-slate-600 dark:text-slate-300 space-y-4 leading-relaxed">
            <p>
              Có bao giờ bạn mua một cuốn sách kinh điển về kinh tế, khoa học, tâm lý hay kỹ thuật với đầy quyết tâm, nhưng chỉ sau 2 chương đầu đã phải gập lại vì quá nhiều thuật ngữ trừu tượng và không có hình dung thực tế?
            </p>
            <p>
              Bộ não con người ghi nhớ hình ảnh nhanh hơn chữ viết gấp <b>60.000 lần</b>, và chúng ta học tốt nhất khi được <b>thao tác, thử nghiệm và quan sát kết quả ngay lập tức</b>.
            </p>
            <p>
              Breaking Books kết hợp sức mạnh của trí tuệ nhân tạo (AI) với triết lý thiết kế tương tác hiện đại. Mỗi cuốn sách được "bóc tách" thành những chủ đề nguyên tử (atomic topics) 5 phút, minh họa bằng các phòng thí nghiệm mô phỏng và câu hỏi ôn tập thông minh, giúp bạn hiểu sâu và áp dụng được ngay.
            </p>
          </div>
        </div>

        {/* Who is it for? */}
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Breaking Books dành cho ai?</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Không chỉ dành cho kỹ sư công nghệ — nền tảng mở cho mọi người học tập suốt đời
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-[#10161D] border border-slate-200/80 dark:border-white/10 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                <GraduationCap className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Học sinh & Sinh viên</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Nắm vững nền tảng các môn học khó, ôn thi hiệu quả qua flashcards và ghi nhớ thuật ngữ tiếng Anh gốc chuẩn xác.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-[#10161D] border border-slate-200/80 dark:border-white/10 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                <Briefcase className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Người đi làm & Chuyên viên</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Tối ưu hóa thời gian với bài đọc 5-10 phút trong giờ nghỉ, học kỹ năng quản trị, tư duy hệ thống và kinh doanh thực chiến.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-[#10161D] border border-slate-200/80 dark:border-white/10 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                <Lightbulb className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Người yêu sách & Tự học</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Tự tải sách PDF yêu thích của riêng bạn lên để AI biến thành sổ tay học tương tác cá nhân hóa chỉ bạn sở hữu.
              </p>
            </div>
          </div>
        </div>

        {/* 3 Core Values */}
        <div className="p-8 rounded-3xl bg-gradient-to-br from-orange-600/10 via-amber-500/5 to-transparent border border-orange-500/20 space-y-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-orange-500" />
            <span>3 Cam kết của chúng tôi</span>
          </h3>

          <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span><b>100% Trực quan hóa:</b> Mọi khái niệm trừu tượng đều phải có sơ đồ, ví dụ đời thực hoặc công cụ mô phỏng để người đọc tự tay kiểm chứng.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span><b>Tôn trọng bản quyền & Bảo mật riêng tư:</b> Sách cá nhân do bạn tải lên thuộc sở hữu của bạn, được bảo mật và phân quyền riêng tư độc lập.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span><b>Học để hành động:</b> Không dừng lại ở đọc hiểu lý thuyết suông; chúng tôi tích hợp Action Engine để bạn áp dụng bài học vào công việc và cuộc sống hàng ngày.</span>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center pt-4">
          <Link
            href="/register?redirect=/library"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl text-sm font-bold bg-orange-600 hover:bg-orange-500 text-white shadow-xl shadow-orange-600/25 transition-all transform hover:scale-105"
          >
            <span>Bắt đầu trải nghiệm ngay hôm nay</span>
            <ArrowRight className="w-4 h-4" />
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
