"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
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
  Atom,
  Search,
} from "lucide-react";
import dynamic from "next/dynamic";

const Clay3DLibraryScene = dynamic(() => import("@/components/Clay3DLibraryScene"), {
  ssr: false,
  loading: () => (
    <div className="w-full aspect-[4/3] max-w-[620px] rounded-3xl bg-orange-100/40 dark:bg-slate-800/40 animate-pulse flex items-center justify-center text-xs text-orange-500 font-bold border border-orange-200/50">
      Đang tải không gian 3D…
    </div>
  ),
});
import Interactive3DHologram from "@/components/Interactive3DHologram";

export default function LandingPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [isDark, setIsDark] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");

  // Interactive Live Demo Mockup state
  const [demoReplicationMode, setDemoReplicationMode] = useState("async"); // "sync" | "async"
  const [demoPacketSent, setDemoPacketSent] = useState(false);
  const [demoAckReceived, setDemoAckReceived] = useState(false);

  function handleSearch(e) {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/library?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      router.push("/library");
    }
  }

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
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-orange-500/20 selection:text-orange-700 dark:selection:text-orange-300 transition-colors duration-200">
      {/* Background Ambience */}
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-orange-500/5 to-transparent pointer-events-none" />

      {/* Navigation Header */}
      <Navbar />

      {/* Hero Section with 3D Claymorphic Library Showcase */}
      <section className="relative px-3 sm:px-6 pt-4 pb-12 max-w-7xl mx-auto">
        <div className="rounded-[36px] sm:rounded-[48px] bg-gradient-to-br from-orange-200 via-orange-300 to-orange-400 dark:from-slate-900 dark:via-orange-950/30 dark:to-slate-900 p-2 sm:p-3 shadow-xl border border-orange-200/60 dark:border-white/10 relative overflow-hidden">
          {/* Decorative Soft Peach Geometric Rings */}
          <div className="absolute top-0 right-0 w-80 h-80 rounded-full border-[32px] border-orange-300/35 pointer-events-none -mr-20 -mt-20" />
          <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full border-[40px] border-amber-200/40 pointer-events-none -ml-24 -mb-24" />
          <div className="absolute top-8 left-8 w-12 h-12 rounded-full bg-orange-300/35 pointer-events-none" />
          <div className="absolute bottom-12 right-12 w-8 h-8 rounded-full bg-amber-400/25 pointer-events-none" />

          {/* Main Floating Clay Canvas Container - Màu Cam Nhạt */}
          <div className="rounded-[30px] sm:rounded-[42px] bg-orange-50/70 dark:bg-slate-900 border border-orange-200/80 dark:border-orange-500/20 p-6 sm:p-10 lg:p-14 shadow-xl shadow-orange-500/10 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
              {/* Left: Headline, Description, and Search Pill */}
              <div className="lg:col-span-6 space-y-6 text-left">
                <div>
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-orange-100/90 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 text-xs font-semibold border border-orange-200/80 dark:border-white/10">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Thư viện Tương tác Thế hệ Mới</span>
                  </span>
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-stone-900 dark:text-white tracking-tight leading-[1.1]">
                  Online Library
                </h1>

                <p className="text-sm sm:text-base text-stone-600 dark:text-stone-300 leading-relaxed max-w-lg">
                  Nền tảng đọc sách công nghệ tương tác với visual lab 3D và câu hỏi ôn tập.
                </p>

                {/* Clay Pill Search Bar */}
                <form
                  onSubmit={handleSearch}
                  className="rounded-2xl border border-stone-200 dark:border-white/10 bg-white dark:bg-slate-800 shadow-md p-1.5 flex items-center gap-2 max-w-lg transition-colors"
                >
                  <div className="flex items-center gap-2.5 pl-3 flex-1 min-w-0">
                    <Search className="w-4 h-4 text-stone-400 shrink-0" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Tìm sách của bạn ở đây..."
                      className="w-full bg-transparent text-sm text-stone-900 dark:text-white placeholder:text-stone-400 focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-95 text-white text-sm font-bold shadow-md shadow-orange-500/25 transition-colors cursor-pointer shrink-0"
                  >
                    Search Book
                  </button>
                </form>

                {/* Quick Filter Tags */}
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-stone-500 dark:text-stone-400">
                  <span className="font-medium">Chủ đề nổi bật:</span>
                  <button
                    type="button"
                    onClick={() => router.push("/books/ddia-2e")}
                    className="px-3 py-1 rounded-xl bg-stone-100 hover:bg-orange-50 dark:bg-white/5 dark:hover:bg-white/10 text-stone-700 dark:text-stone-300 hover:text-orange-600 font-medium transition-colors cursor-pointer"
                  >
                    DDIA 2e
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/books/building-microservices-2nd-edition-sam-newman")}
                    className="px-3 py-1 rounded-xl bg-stone-100 hover:bg-orange-50 dark:bg-white/5 dark:hover:bg-white/10 text-stone-700 dark:text-stone-300 hover:text-orange-600 font-medium transition-colors cursor-pointer"
                  >
                    Microservices
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/books/head-first-design-patterns-2nd-edition")}
                    className="px-3 py-1 rounded-xl bg-stone-100 hover:bg-orange-50 dark:bg-white/5 dark:hover:bg-white/10 text-stone-700 dark:text-stone-300 hover:text-orange-600 font-medium transition-colors cursor-pointer"
                  >
                    Design Patterns
                  </button>
                </div>
              </div>

              {/* Right: 3D Claymorphic Library Scene with Cursor Tilt */}
              <div className="lg:col-span-6 flex items-center justify-center">
                <Clay3DLibraryScene />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Live Demo Mockup Section */}
      <section id="simulation" className="max-w-5xl mx-auto px-4 sm:px-8 py-12">
        <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 sm:p-8 shadow-2xl text-white relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 motion-safe:animate-pulse" />
                <span className="text-xs font-semibold text-orange-400">
                  Trải nghiệm thử Live Lab trực tiếp
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
                disabled={demoPacketSent && !demoAckReceived}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-600/30 inline-flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer whitespace-nowrap focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
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
            <span>Hơn 100 phòng thí nghiệm tương tác được tích hợp sẵn trong các chương sách.</span>
            <Link
              href="/library"
              className="font-semibold text-orange-400 hover:text-orange-300 inline-flex items-center gap-1 transition-colors"
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
            Từ sách công nghệ, kinh tế, quản trị kinh doanh đến kỹ năng mềm, kết hợp tri thức sâu sắc với trải nghiệm tương tác trực quan.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Feature 1 */}
          <div className="p-7 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 space-y-3">
            <div className="w-11 h-11 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Bóc tách tự động bằng Trí tuệ Nhân tạo
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Bạn tải lên file PDF sách bất kỳ. Hệ thống tự động chia chương, cấu trúc thành các Topic cô đọng 5-10 phút, giữ nguyên thuật ngữ tiếng Anh gốc và giải nghĩa tiếng Việt chuẩn xác.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="p-7 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 space-y-3">
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
          <div className="p-7 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 space-y-3">
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
          <div className="p-7 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 space-y-3">
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
          <div className="rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 p-5 flex flex-col justify-between hover:shadow-xl transition-shadow duration-200">
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
              className="mt-4 py-2 px-3.5 rounded-xl text-xs font-semibold bg-orange-600/10 hover:bg-orange-600 text-orange-600 hover:text-white transition-colors duration-150 flex items-center justify-between"
            >
              <span>Khám phá 12 chương</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Book 2 */}
          <div className="rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 p-5 flex flex-col justify-between hover:shadow-xl transition-shadow duration-200">
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
              className="mt-4 py-2 px-3.5 rounded-xl text-xs font-semibold bg-orange-600/10 hover:bg-orange-600 text-orange-600 hover:text-white transition-colors duration-150 flex items-center justify-between"
            >
              <span>Khám phá 7 chương</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Book 3 */}
          <div className="rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 p-5 flex flex-col justify-between hover:shadow-xl transition-shadow duration-200">
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
              className="mt-4 py-2 px-3.5 rounded-xl text-xs font-semibold bg-orange-600/10 hover:bg-orange-600 text-orange-600 hover:text-white transition-colors duration-150 flex items-center justify-between"
            >
              <span>Khám phá 13 chương</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section id="pricing" className="max-w-5xl mx-auto px-4 sm:px-8 py-16">
        <div className="rounded-3xl bg-gradient-to-br from-orange-600 via-amber-600 to-orange-700 p-8 sm:p-12 text-center text-white space-y-6 shadow-xl relative overflow-hidden">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight max-w-xl mx-auto leading-tight">
            Sẵn sàng làm chủ tri thức và chinh phục cuốn sách tiếp theo?
          </h2>

          <p className="text-sm sm:text-base text-orange-100 max-w-lg mx-auto">
            Tạo tài khoản hoàn toàn miễn phí và bắt đầu bóc tách cuốn sách đầu tiên của bạn ngay hôm nay.
          </p>

          <div className="pt-2">
            <Link
              href={currentUser ? "/library" : "/register?redirect=/library"}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl text-sm font-bold bg-white text-orange-700 hover:bg-orange-50 shadow-xl transition-colors cursor-pointer"
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
