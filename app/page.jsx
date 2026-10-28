"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  ArrowRight,
  Sparkles,
  Zap,
  Cpu,
  Layers,
  ShieldCheck,
  CheckCircle2,
  Sliders,
  Moon,
  Sun,
  Lock,
  User,
  ExternalLink,
  ChevronRight,
  Code2,
  GraduationCap,
  FolderLock,
  Play,
  RotateCcw,
} from "lucide-react";

export default function LandingPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [isDark, setIsDark] = useState(false);

  // Interactive Live Demo Mockup state
  const [demoReplicationMode, setDemoReplicationMode] = useState("async"); // "sync" | "async"
  const [demoPacketSent, setDemoPacketSent] = useState(false);
  const [demoAckReceived, setDemoAckReceived] = useState(false);

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

  function triggerDemoPacket() {
    setDemoPacketSent(true);
    setDemoAckReceived(false);
    setTimeout(() => {
      setDemoAckReceived(true);
    }, demoReplicationMode === "sync" ? 800 : 250);
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#090D13] text-slate-900 dark:text-slate-100 font-sans selection:bg-orange-500/20 selection:text-orange-700 dark:selection:text-orange-300 transition-colors duration-300">
      {/* Background Ambience */}
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-orange-500/10 via-amber-500/5 to-transparent pointer-events-none" />
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-orange-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Navigation Header */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-white/80 dark:bg-[#090D13]/80 border-b border-slate-200/80 dark:border-white/10 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center text-white shadow-md shadow-orange-500/20 group-hover:scale-105 transition-transform">
            <BookOpen className="w-5 h-5" />
          </div>
          <span className="text-lg font-black tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-slate-600 dark:from-white dark:via-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
            Breaking Books
          </span>
        </Link>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-600 dark:text-slate-400">
          <Link href="/features" className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors">
            Tính năng cốt lõi
          </Link>
          <Link href="/about" className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors">
            Giới thiệu
          </Link>
          <Link href="/changelog" className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors">
            Nhật ký cập nhật
          </Link>
          <Link href="/feedback" className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors">
            Góp ý tính năng
          </Link>
          <a href="#books" className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors">
            Sách tiêu biểu
          </a>
        </nav>

        {/* Auth CTA */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 transition-colors cursor-pointer"
            title="Đổi giao diện Sáng / Tối"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          {currentUser ? (
            <Link
              href="/library"
              className="px-4 py-2 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-500 text-white shadow-md shadow-orange-600/20 flex items-center gap-2 transition-all"
            >
              <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">
                {currentUser.name ? currentUser.name.charAt(0) : "U"}
              </div>
              <span>Vào Thư viện của tôi</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login?redirect=/library"
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-orange-600 transition-colors"
              >
                Đăng nhập
              </Link>
              <Link
                href="/register?redirect=/library"
                className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white shadow-md shadow-orange-600/20 flex items-center gap-1.5 transition-all"
              >
                <span>Dùng thử ngay</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 sm:pt-24 pb-20 px-4 sm:px-8 max-w-5xl mx-auto text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Nền tảng Đọc Sách Tương Tác AI & Trực Quan Hóa Tri Thức Cho Mọi Người</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-slate-900 dark:text-white leading-[1.12]">
          Đừng đọc sách thụ động. <br />
          <span className="bg-gradient-to-r from-orange-600 via-amber-500 to-orange-500 bg-clip-text text-transparent">
            Hãy chạm, tương tác và làm chủ tri thức.
          </span>
        </h1>

        <p className="text-base sm:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
          Dù bạn là học sinh, sinh viên, người đi làm hay người tự học: Breaking Books bóc tách mọi cuốn sách dày cộp thành các Topic 5-10 phút cô đọng, kèm <b>sơ đồ tương tác trực quan</b> và thẻ ôn tập flashcards thông minh.
        </p>

        {/* CTA Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5">
          <Link
            href={currentUser ? "/library" : "/register?redirect=/library"}
            className="w-full sm:w-auto px-7 py-3.5 rounded-2xl text-sm font-bold bg-gradient-to-r from-orange-600 via-amber-600 to-orange-600 hover:from-orange-500 hover:to-amber-500 text-white shadow-xl shadow-orange-600/25 flex items-center justify-center gap-2.5 transition-all transform hover:-translate-y-0.5 cursor-pointer"
          >
            <span>{currentUser ? "Truy cập Thư viện cá nhân" : "Bắt đầu dùng thử miễn phí"}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <Link
            href="/library"
            className="w-full sm:w-auto px-6 py-3.5 rounded-2xl text-sm font-semibold bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-white/10 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-orange-500" />
            <span>Khám phá 3 sách mẫu có sẵn</span>
          </Link>
        </div>

        {/* Highlights Badges */}
        <div className="pt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>100% Visual Lab tương tác</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Bóc tách bằng AI thông minh</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Phân quyền riêng tư từng thành viên</span>
          </div>
        </div>
      </section>

      {/* Interactive Live Demo Mockup Section */}
      <section id="simulation" className="max-w-5xl mx-auto px-4 sm:px-8 py-12">
        <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 sm:p-8 shadow-2xl text-white relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-mono font-bold text-orange-400 uppercase tracking-wider">
                  Trải nghiệm thử Live Lab ngay trên trang chủ
                </span>
              </div>
              <h3 className="text-lg font-bold text-white mt-1">
                Mô phỏng Quá trình Replication: Synchronous vs Asynchronous
              </h3>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
              <button
                onClick={() => setDemoReplicationMode("sync")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  demoReplicationMode === "sync"
                    ? "bg-orange-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Đồng bộ (Sync)
              </button>
              <button
                onClick={() => setDemoReplicationMode("async")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  demoReplicationMode === "async"
                    ? "bg-orange-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Bất đồng bộ (Async)
              </button>
            </div>
          </div>

          {/* Canvas Simulation */}
          <div className="py-8 grid grid-cols-1 sm:grid-cols-3 gap-6 items-center text-center">
            {/* Leader Node */}
            <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/80 space-y-2 relative">
              <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center mx-auto font-bold text-sm">
                L
              </div>
              <h4 className="text-xs font-bold text-white">Leader Node</h4>
              <p className="text-[11px] text-slate-400">Nhận Write Request từ Client</p>
              <div className="h-1 rounded-full bg-emerald-500/50 w-16 mx-auto mt-2" />
            </div>

            {/* Network Pipe */}
            <div className="space-y-3">
              <div className="text-xs font-mono text-slate-400">
                {demoReplicationMode === "sync" ? "Chờ Replica ACK trước khi trả lời" : "Trả lời ngay khi ghi xong Leader"}
              </div>

              <button
                onClick={triggerDemoPacket}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-600/30 inline-flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Gửi 1 Ghi dữ liệu (Write Request)</span>
              </button>

              {demoPacketSent && (
                <div className="text-[11px] font-mono text-orange-300 animate-pulse">
                  {demoAckReceived
                    ? `✓ Hoàn thành ACK (${demoReplicationMode === "sync" ? "800ms độ trễ cao, bền vững 100%" : "250ms cực nhanh, chấp nhận rủi ro mất dữ liệu"})`
                    : "Đang truyền gói tin qua mạng..."}
                </div>
              )}
            </div>

            {/* Follower Node */}
            <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/80 space-y-2">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center mx-auto font-bold text-sm">
                F
              </div>
              <h4 className="text-xs font-bold text-white">Follower Node</h4>
              <p className="text-[11px] text-slate-400">Sao chép WAL & áp dụng thay đổi</p>
              <div className="h-1 rounded-full bg-blue-500/50 w-16 mx-auto mt-2" />
            </div>
          </div>

          <div className="border-t border-slate-800 pt-4 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2">
            <span>💡 Đây là 1 trong hơn 100 phòng thí nghiệm tương tác được tích hợp sẵn trong sách.</span>
            <Link
              href="/library"
              className="font-bold text-orange-400 hover:text-orange-300 inline-flex items-center gap-1"
            >
              <span>Xem đầy đủ các chương sách</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Core Features Grid */}
      <section id="features" className="max-w-5xl mx-auto px-4 sm:px-8 py-16 space-y-12">
        <div className="text-center space-y-3">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            Được thiết kế cho tất cả mọi người: Học tập, Nghiên cứu & Sự nghiệp
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
            Từ sách công nghệ, kinh tế, quản trị kinh doanh đến kỹ năng mềm — kết hợp tri thức sâu sắc với trải nghiệm tương tác trực quan.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Feature 1 */}
          <div className="p-7 rounded-3xl bg-slate-50 dark:bg-[#10161D] border border-slate-200/80 dark:border-white/10 space-y-3">
            <div className="w-11 h-11 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Bóc tách tự động bằng Trí tuệ Nhân tạo (AI)
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Bạn tải lên file PDF sách bất kỳ. AI tự động chia chương, cấu trúc thành các Topic cô đọng 5-10 phút, giữ nguyên thuật ngữ tiếng Anh gốc và giải nghĩa tiếng Việt chuẩn xác.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="p-7 rounded-3xl bg-slate-50 dark:bg-[#10161D] border border-slate-200/80 dark:border-white/10 space-y-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <Sliders className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Visual Lab: Thử nghiệm kiến trúc thời gian thực
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Không còn sơ đồ chết trên trang giấy. Mỗi chủ đề đều có Interactive Widget: bạn có thể thay đổi số lượng replicas, mô phỏng network split-brain, kiểm tra ACID và đo lường độ trễ P99.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="p-7 rounded-3xl bg-slate-50 dark:bg-[#10161D] border border-slate-200/80 dark:border-white/10 space-y-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <GraduationCap className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Active Recall & Xuất Anki Flashcards 1-Click
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Mỗi chương kết thúc bằng bộ câu hỏi tư duy trắc nghiệm và hệ thống từ điển thuật ngữ. Bạn có thể xuất ngay file Anki TSV để ôn tập lặp lại ngắt quãng (Spaced Repetition).
            </p>
          </div>

          {/* Feature 4 */}
          <div className="p-7 rounded-3xl bg-slate-50 dark:bg-[#10161D] border border-slate-200/80 dark:border-white/10 space-y-3">
            <div className="w-11 h-11 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
              <FolderLock className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Không gian cá nhân riêng biệt & Bảo mật
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Mỗi người dùng có tài khoản và không gian thư viện riêng. Sách do bạn tải lên được lưu trữ độc lập và phân quyền nghiêm ngặt, chỉ bạn mới có thể truy cập và quản lý.
            </p>
          </div>
        </div>
      </section>

      {/* Featured Books Preview Section */}
      <section id="books" className="max-w-5xl mx-auto px-4 sm:px-8 py-16 space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            Bộ Sách Mẫu Sẵn Sàng Trải Nghiệm Ngay
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Đã được biên soạn đầy đủ sơ đồ Visual Lab và câu hỏi kiểm tra tư duy
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Book 1 */}
          <div className="rounded-3xl bg-slate-50 dark:bg-[#10161D] border border-slate-200/80 dark:border-white/10 p-5 flex flex-col justify-between hover:shadow-xl transition-all">
            <div className="space-y-3">
              <div className="h-44 rounded-2xl overflow-hidden bg-slate-900 shadow-md">
                <img
                  src="/covers/ddia-2e.jpg"
                  alt="Designing Data-Intensive Applications"
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="text-sm font-bold line-clamp-2">
                Designing Data-Intensive Applications (2nd Edition)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Martin Kleppmann</p>
            </div>
            <Link
              href="/books/ddia-2e"
              className="mt-4 py-2 px-3.5 rounded-xl text-xs font-bold bg-orange-600/10 hover:bg-orange-600 text-orange-600 hover:text-white transition-all flex items-center justify-between"
            >
              <span>Khám phá 12 chương</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Book 2 */}
          <div className="rounded-3xl bg-slate-50 dark:bg-[#10161D] border border-slate-200/80 dark:border-white/10 p-5 flex flex-col justify-between hover:shadow-xl transition-all">
            <div className="space-y-3">
              <div className="h-44 rounded-2xl overflow-hidden bg-slate-900 shadow-md">
                <img
                  src="/covers/building-microservices-2nd-edition-sam-newman.jpg"
                  alt="Building Microservices 2nd Edition"
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="text-sm font-bold line-clamp-2">
                Building Microservices (2nd Edition)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Sam Newman</p>
            </div>
            <Link
              href="/books/building-microservices-2nd-edition-sam-newman"
              className="mt-4 py-2 px-3.5 rounded-xl text-xs font-bold bg-orange-600/10 hover:bg-orange-600 text-orange-600 hover:text-white transition-all flex items-center justify-between"
            >
              <span>Khám phá 7 chương</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Book 3 */}
          <div className="rounded-3xl bg-slate-50 dark:bg-[#10161D] border border-slate-200/80 dark:border-white/10 p-5 flex flex-col justify-between hover:shadow-xl transition-all">
            <div className="space-y-3">
              <div className="h-44 rounded-2xl overflow-hidden bg-slate-900 shadow-md">
                <img
                  src="/covers/head-first-javascript-programming-a-brain-friendly-guide.jpg"
                  alt="Head First JavaScript Programming"
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="text-sm font-bold line-clamp-2">
                Head First JavaScript Programming
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Eric Freeman & Elisabeth Robson</p>
            </div>
            <Link
              href="/books/head-first-javascript-programming-a-brain-friendly-guide"
              className="mt-4 py-2 px-3.5 rounded-xl text-xs font-bold bg-orange-600/10 hover:bg-orange-600 text-orange-600 hover:text-white transition-all flex items-center justify-between"
            >
              <span>Khám phá 13 chương</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section id="pricing" className="max-w-5xl mx-auto px-4 sm:px-8 py-16">
        <div className="rounded-3xl bg-gradient-to-br from-orange-600 via-amber-600 to-orange-700 p-8 sm:p-12 text-center text-white space-y-6 shadow-2xl relative overflow-hidden">
          <div className="w-80 h-80 rounded-full bg-white/10 blur-3xl absolute -top-20 -right-20 pointer-events-none" />

          <h2 className="text-3xl sm:text-4xl font-black tracking-tight max-w-xl mx-auto leading-tight">
            Sẵn sàng làm chủ tri thức và chinh phục cuốn sách tiếp theo?
          </h2>

          <p className="text-sm sm:text-base text-orange-100 max-w-lg mx-auto">
            Tạo tài khoản hoàn toàn miễn phí và bắt đầu bóc tách cuốn sách đầu tiên của bạn ngay hôm nay.
          </p>

          <div className="pt-2">
            <Link
              href={currentUser ? "/library" : "/register?redirect=/library"}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl text-sm font-black bg-white text-orange-700 hover:bg-orange-50 shadow-xl transition-all transform hover:scale-105"
            >
              <span>{currentUser ? "Vào Thư viện của tôi ngay" : "Tạo tài khoản miễn phí"}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-white/10 py-10 px-4 text-center text-xs text-slate-500 space-y-4">
        <div className="flex flex-wrap items-center justify-center gap-6 font-medium text-slate-600 dark:text-slate-400">
          <Link href="/features" className="hover:text-orange-600 transition-colors">Tính năng</Link>
          <Link href="/about" className="hover:text-orange-600 transition-colors">Giới thiệu</Link>
          <Link href="/changelog" className="hover:text-orange-600 transition-colors">Nhật ký cập nhật</Link>
          <Link href="/feedback" className="hover:text-orange-600 transition-colors">Góp ý tính năng</Link>
          <Link href="/library" className="hover:text-orange-600 transition-colors">Thư viện</Link>
          <Link href="/admin" className="hover:text-orange-600 transition-colors">Quản trị viên</Link>
        </div>
        <p>Breaking Books © 2026 · Nền tảng Đọc sách & Trực quan hoá Tri thức Tương tác</p>
        <p className="text-[11px] text-slate-400">
          Phát triển với sứ mệnh giúp mọi người tiếp thu kiến thức nhanh hơn, sâu hơn và hứng thú hơn.
        </p>
      </footer>
    </div>
  );
}
