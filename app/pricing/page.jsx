"use client";

import React, { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import {
  Tag,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Zap,
  HelpCircle,
  ShieldCheck,
  Cpu,
  BookOpen,
} from "lucide-react";

export default function PricingPage() {
  const [billingPeriod, setBillingPeriod] = useState("free"); // "free"

  const tiers = [
    {
      name: "Cộng Đồng (Community)",
      price: "0đ",
      period: "Mãi mãi miễn phí",
      badge: "Phổ biến nhất",
      description: "Dành cho học sinh, sinh viên, người đi làm và bất kỳ ai khao khát tiếp thu tri thức nhanh chóng.",
      highlight: true,
      features: [
        "Truy cập toàn bộ 3 cuốn sách kinh điển mẫu có sẵn",
        "100% phòng thí nghiệm tương tác (Visual Labs, Mind Maps, Charts)",
        "Tải lên tối đa 3 cuốn sách PDF cá nhân / tháng",
        "Bóc tách chương bằng Hệ thống AI Engine tốc độ cao",
        "Bộ câu hỏi trắc nghiệm kiểm tra tư duy sâu cuối mỗi chương",
        "Xuất Flashcard Anki TSV 1-Click để ôn tập ngắt quãng",
        "Phân quyền dữ liệu cá nhân hoàn toàn bảo mật",
      ],
      ctaText: "Bắt đầu dùng ngay miễn phí",
      ctaHref: "/register?redirect=/library",
    },
    {
      name: "Tự lưu trữ (Self-Hosted Pro)",
      price: "Mã nguồn Mở",
      period: "GitHub Repository",
      badge: "Dành cho Kỹ sư & Nhóm",
      description: "Tự deploy hệ thống trên máy chủ của bạn với Docker, Render hoặc Vercel không giới hạn dung lượng.",
      highlight: false,
      features: [
        "Mã nguồn mở Next.js 15 & Tailwind CSS đầy đủ",
        "Tự cắm API Key AI riêng không giới hạn số lượng sách",
        "Hỗ trợ cơ chế Multi-Key Pool & Load Balancer failover tự động",
        "Tùy biến bộ từ điển thuật ngữ chuyên ngành Domain Knowledge",
        "Kết nối cơ sở dữ liệu PostgreSQL / JSON fallback tùy chọn",
        "Bảng điều khiển Admin Console quản lý toàn diện",
      ],
      ctaText: "Xem mã nguồn trên GitHub",
      ctaHref: "https://github.com/Nguyen2442/breaking-books",
      external: true,
    },
  ];

  const faqs = [
    {
      q: "Breaking Books có thực sự miễn phí 100% cho người đọc không?",
      a: "Hoàn toàn chính xác! Phiên bản Community là hoàn toàn miễn phí. Mục tiêu của dự án là biến việc đọc sách khô khan thành trải nghiệm tương tác mở cho toàn bộ người học Việt Nam.",
    },
    {
      q: "Tôi có thể tải lên sách thuộc bất kỳ lĩnh vực nào không?",
      a: "Có. Hệ thống AI Engine tự động nhận diện lĩnh vực sách (Công nghệ, Tài chính, Tâm lý, Quản trị, Khoa học...) và điều chỉnh cách giải nghĩa, thuật ngữ và dạng thức trực quan (Mind map, Chart, Flowchart) cho phù hợp.",
    },
    {
      q: "Sách do tôi tải lên có bị người khác đọc trộm không?",
      a: "Không. Hệ thống áp dụng cơ chế phân quyền bảo mật riêng biệt (Multi-tenant Isolation). Sách do tài khoản nào tải lên thì chỉ duy nhất tài khoản đó có quyền truy cập.",
    },
    {
      q: "Phòng thí nghiệm tương tác hoạt động như thế nào?",
      a: "Thay vì chỉ đọc văn bản, mỗi bài học đều đính kèm một Interactive Widget (bằng SVG & JavaScript thuần nhẹ tênh). Bạn có thể bấm nút thử nghiệm, kéo thanh trượt điều chỉnh thông số và quan sát biểu đồ, sơ đồ tư duy phản hồi tức thì.",
    },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-[#090D13] text-slate-900 dark:text-slate-100 font-sans selection:bg-orange-500/20 selection:text-orange-700 dark:selection:text-orange-300 transition-colors duration-300">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-8 py-12 space-y-16">
        {/* Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 text-xs font-semibold">
            <Tag className="w-3.5 h-3.5" />
            <span>Chính Sách & Gói Trải Nghiệm</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
            Tri thức mở, tương tác mở. <br />
            <span className="bg-gradient-to-r from-orange-600 via-amber-500 to-orange-500 bg-clip-text text-transparent">
              100% Miễn phí cho người học.
            </span>
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
            Chúng tôi tin rằng việc đọc sách sâu sắc và ứng dụng thực tiễn phải được tiếp cận dễ dàng bởi tất cả mọi người, không bị rào cản chi phí.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto items-stretch">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`rounded-3xl p-8 flex flex-col justify-between transition-all ${
                tier.highlight
                  ? "bg-gradient-to-b from-orange-500/[0.08] to-transparent border-2 border-orange-500 shadow-xl shadow-orange-500/10 relative"
                  : "bg-slate-50 dark:bg-[#10161D] border border-slate-200/80 dark:border-white/10"
              }`}
            >
              {tier.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-orange-600 text-white text-[11px] font-bold tracking-wide shadow-md">
                  {tier.badge}
                </span>
              )}

              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                    {tier.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {tier.description}
                  </p>
                </div>

                <div className="pt-2">
                  <span className="text-4xl font-black text-slate-900 dark:text-white">
                    {tier.price}
                  </span>
                  <span className="text-xs text-slate-500 ml-2">/ {tier.period}</span>
                </div>

                <div className="space-y-3 pt-4 border-t border-slate-200/80 dark:border-white/10">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    Những gì bạn nhận được:
                  </p>
                  <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-8">
                {tier.external ? (
                  <a
                    href={tier.ctaHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 px-4 rounded-xl text-xs font-bold bg-slate-900 dark:bg-white/10 hover:bg-slate-800 text-white flex items-center justify-center gap-2 transition-all"
                  >
                    <span>{tier.ctaText}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <Link
                    href={tier.ctaHref}
                    className="w-full py-3 px-4 rounded-xl text-xs font-bold bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white shadow-lg shadow-orange-600/25 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5"
                  >
                    <span>{tier.ctaText}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* FAQs */}
        <div className="max-w-3xl mx-auto pt-10 space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Câu hỏi thường gặp
            </h2>
            <p className="text-xs text-slate-500">
              Giải đáp thắc mắc về cách sử dụng và bản quyền
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-slate-50 dark:bg-[#10161D] border border-slate-200/80 dark:border-white/10 space-y-2"
              >
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-orange-500 shrink-0" />
                  <span>{faq.q}</span>
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 pl-6 leading-relaxed">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
