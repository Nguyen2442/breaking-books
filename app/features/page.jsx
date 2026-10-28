"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import {
  BookOpen,
  ArrowRight,
  Sparkles,
  Zap,
  Sliders,
  GraduationCap,
  FolderLock,
  Layers,
  Brain,
  Flame,
  CheckCircle2,
  XCircle,
  Moon,
  Sun,
  Code2,
  Cpu,
} from "lucide-react";

export default function FeaturesPage() {
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
      <Navbar />

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-16 sm:py-24 space-y-20">
        {/* Section Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs font-semibold border border-orange-500/20">
            <Zap className="w-3.5 h-3.5" />
            <span>Bộ Công Cụ Học Tập & Đọc Sách Đột Phá</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
            Những tính năng giúp bạn <br />
            <span className="bg-gradient-to-r from-orange-600 via-amber-500 to-orange-500 bg-clip-text text-transparent">
              nắm trọn cuốn sách chỉ trong vài giờ
            </span>
          </h1>
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Kết hợp mô phỏng tương tác thời gian thực, trí tuệ nhân tạo và phương pháp khoa học não bộ (Cognitive Science).
          </p>
        </div>

        {/* Feature Cards Showcase */}
        <div className="space-y-12">
          {/* Feature 1 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center p-8 rounded-3xl bg-slate-50 dark:bg-[#10161D] border border-slate-200/80 dark:border-white/10">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold">
                <Zap className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                1. Bóc tách sách thông minh bằng Trí tuệ Nhân tạo (AI)
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Khi bạn tải file PDF lên, hệ thống tự động bóc tách từng chương thành các <b>chủ đề nguyên tử (Atomic Topics)</b> dài 5–10 phút đọc. Mỗi bài đều có:
              </p>
              <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span><b>Tóm tắt cốt lõi (TL;DR):</b> 1-2 câu chắt lọc bản chất nhất.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span><b>Tình huống thực tế:</b> Ví dụ đời thực và bài học áp dụng.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span><b>Thuật ngữ Anh - Việt:</b> Giữ nguyên term gốc để không bị sai lệch nghĩa.</span>
                </li>
              </ul>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between text-slate-400 text-[11px] pb-2 border-b border-slate-100 dark:border-slate-800">
                <span>Atomic Topic #3.2</span>
                <span className="text-emerald-500 font-bold">5 phút đọc</span>
              </div>
              <p className="font-sans font-bold text-slate-900 dark:text-white text-sm">
                Đánh đổi giữa Tốc độ ghi & Độ tin cậy dữ liệu
              </p>
              <p className="font-sans text-slate-500 text-xs">
                Khi kích hoạt cơ chế ghi đồng bộ (Synchronous Replication), hệ thống đảm bảo 0% mất dữ liệu nhưng tăng độ trễ mạng...
              </p>
              <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[11px]">
                💡 Tình huống thực tế: Cách các sàn TMĐT cân bằng tải trong đợt sale bão đêm.
              </div>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center p-8 rounded-3xl bg-slate-50 dark:bg-[#10161D] border border-slate-200/80 dark:border-white/10">
            <div className="order-2 md:order-1 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Interactive Simulation Widget</span>
                <span className="px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 font-bold">Thao tác được</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800">
                  <span className="text-[10px] text-slate-400">Node A (Leader)</span>
                  <p className="font-bold text-emerald-500 text-xs mt-1">ONLINE</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800">
                  <span className="text-[10px] text-slate-400">Node B (Follower)</span>
                  <p className="font-bold text-blue-500 text-xs mt-1">REPLICATING</p>
                </div>
              </div>
              <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-center text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                Kéo slider mô phỏng mạng bị trễ 500ms ➔ Quan sát dữ liệu rẽ nhánh
              </div>
            </div>

            <div className="order-1 md:order-2 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                <Sliders className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                2. Visual Lab: Phòng Thí Nghiệm Tương Tác Sống Động
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Thay vì chỉ đọc về công thức và định nghĩa trừu tượng, mỗi bài học đều có widget tương tác để bạn tự tay thay đổi tham số, bấm nút mô phỏng và quan sát kết quả sinh động thời gian thực.
              </p>
              <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Kéo slider tăng giảm số lượng tham số để thấy sự biến thiên.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Mô phỏng tình huống sự cố (failover, bottleneck, rò rỉ bộ nhớ).</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Feature 3 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center p-8 rounded-3xl bg-slate-50 dark:bg-[#10161D] border border-slate-200/80 dark:border-white/10">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                <Brain className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                3. Ôn tập Lặp lại Ngắt quãng (Spaced Repetition SM-2)
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Đọc xong một cuốn sách mà 2 tuần sau quên 80% là vấn đề phổ biến. Breaking Books tích hợp thuật toán khoa học SuperMemo SM-2 tự động nhắc bạn ôn lại thẻ kiến thức vào đúng thời điểm chuẩn bị quên.
              </p>
              <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Flashcard hai mặt: Thuật ngữ và giải thích ứng dụng.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Xuất file Anki (.tsv) để học trên điện thoại mọi lúc mọi nơi.</span>
                </li>
              </ul>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Active Recall Flashcard</span>
                <span className="text-emerald-500 font-bold">SM-2 Algorithm</span>
              </div>
              <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 text-center space-y-2">
                <p className="text-[11px] text-slate-500 uppercase tracking-wider">Mặt trước</p>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Định lý CAP phát biểu điều gì?
                </h4>
              </div>
              <div className="flex justify-center gap-2 pt-2">
                <span className="px-3 py-1 rounded-lg bg-rose-500/10 text-rose-500 text-[11px] font-bold">Quên</span>
                <span className="px-3 py-1 rounded-lg bg-amber-500/10 text-amber-500 text-[11px] font-bold">Khó</span>
                <span className="px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-500 text-[11px] font-bold">Nhớ tốt (+4 ngày)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Comparison Table */}
        <div className="p-8 rounded-3xl bg-slate-50 dark:bg-[#10161D] border border-slate-200/80 dark:border-white/10 space-y-6">
          <h2 className="text-xl font-bold text-center text-slate-900 dark:text-white">
            So sánh Breaking Books với cách đọc sách truyền thống
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/10 text-slate-400">
                  <th className="py-3 px-4 font-semibold">Tiêu chí</th>
                  <th className="py-3 px-4 font-semibold text-rose-500">Đọc sách truyền thống</th>
                  <th className="py-3 px-4 font-semibold text-orange-500">Breaking Books</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                <tr>
                  <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">Thời gian hoàn thành</td>
                  <td className="py-3 px-4 text-slate-500">3 - 6 tuần (thường bỏ dở giữa chừng)</td>
                  <td className="py-3 px-4 font-semibold text-emerald-600 dark:text-emerald-400">5-10 phút mỗi chủ đề ngắn gọn</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">Khả năng ghi nhớ sau 1 tháng</td>
                  <td className="py-3 px-4 text-slate-500">Chỉ nhớ khoảng 10-20%</td>
                  <td className="py-3 px-4 font-semibold text-emerald-600 dark:text-emerald-400">Nhớ hơn 85% nhờ Spaced Repetition</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">Hình ảnh minh họa</td>
                  <td className="py-3 px-4 text-slate-500">Sơ đồ đen trắng tĩnh, khó hình dung</td>
                  <td className="py-3 px-4 font-semibold text-emerald-600 dark:text-emerald-400">100% Visual Lab tương tác trực tiếp</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">Không gian riêng tư</td>
                  <td className="py-3 px-4 text-slate-500">Ghi chú rải rác khó tìm lại</td>
                  <td className="py-3 px-4 font-semibold text-emerald-600 dark:text-emerald-400">Thư viện cá nhân bảo mật cho từng thành viên</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center pt-6">
          <Link
            href="/register?redirect=/library"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl text-sm font-bold bg-orange-600 hover:bg-orange-500 text-white shadow-xl shadow-orange-600/25 transition-all transform hover:scale-105"
          >
            <span>Trải nghiệm toàn bộ tính năng ngay</span>
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
