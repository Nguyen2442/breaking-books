"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import {
  BookOpen,
  ArrowRight,
  Search,
  Filter,
  Sparkles,
  Layers,
  GraduationCap,
  Clock,
  CheckCircle2,
  Bookmark,
  ExternalLink,
} from "lucide-react";

export default function BooksCatalogPage() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const sampleBooks = [
    {
      id: "ddia-2e",
      title: "Designing Data-Intensive Applications",
      edition: "2nd Edition",
      author: "Martin Kleppmann",
      category: "system",
      categoryName: "Hệ thống Phân tán",
      cover: "/covers/ddia-2e.jpg",
      description:
        "Cuốn sách gối đầu giường của mọi kỹ sư phần mềm về độ tin cậy, khả năng mở rộng và khả năng bảo trì của các hệ thống lưu trữ phân tán lớn.",
      totalChapters: 12,
      topicsCount: 58,
      tags: ["Replication", "Partitioning", "Transactions", "Consensus", "Batch/Stream"],
      featured: true,
    },
    {
      id: "building-microservices-2nd-edition-sam-newman",
      title: "Building Microservices",
      edition: "2nd Edition",
      author: "Sam Newman",
      category: "architecture",
      categoryName: "Kiến trúc Phần mềm",
      cover: "/covers/building-microservices-2nd-edition-sam-newman.jpg",
      description:
        "Hướng dẫn toàn diện về cách phân tách monolith thành các microservices độc lập, bảo mật giao tiếp liên dịch vụ và thiết kế cơ sở dữ liệu phân tán.",
      totalChapters: 7,
      topicsCount: 35,
      tags: ["Microservices", "API Gateway", "Saga Pattern", "Event-Driven", "Observability"],
      featured: true,
    },
    {
      id: "head-first-javascript-programming-a-brain-friendly-guide",
      title: "Head First JavaScript Programming",
      edition: "A Brain-Friendly Guide",
      author: "Eric Freeman & Elisabeth Robson",
      category: "frontend",
      categoryName: "Lập trình Web",
      cover: "/covers/head-first-javascript-programming-a-brain-friendly-guide.jpg",
      description:
        "Tiếp cận JavaScript theo phương pháp tư duy hình ảnh thân thiện với não bộ: từ biến, hàm, closures cho tới DOM manipulation và lập trình bất đồng bộ.",
      totalChapters: 13,
      topicsCount: 62,
      tags: ["JavaScript", "Closures", "Prototypes", "DOM", "Async/Await"],
      featured: true,
    },
  ];

  useEffect(() => {
    fetch("/api/overview")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.books && data.books.length > 0) {
          // Merge API books with sample metadata
          const merged = sampleBooks.map((sb) => {
            const apiB = data.books.find((b) => b.id === sb.id);
            if (apiB) {
              return {
                ...sb,
                title: apiB.title || sb.title,
                totalChapters: apiB.chapters?.length || sb.totalChapters,
              };
            }
            return sb;
          });
          setBooks(merged);
        } else {
          setBooks(sampleBooks);
        }
      })
      .catch(() => {
        setBooks(sampleBooks);
      })
      .finally(() => setLoading(false));
  }, []);

  const categories = [
    { id: "all", name: "Tất cả sách" },
    { id: "system", name: "Hệ thống Phân tán" },
    { id: "architecture", name: "Kiến trúc Phần mềm" },
    { id: "frontend", name: "Lập trình & Kỹ thuật" },
  ];

  const filteredBooks = books.filter((b) => {
    const matchesCat = selectedCategory === "all" || b.category === selectedCategory;
    const matchesSearch =
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-white dark:bg-[#090D13] text-slate-900 dark:text-slate-100 font-sans selection:bg-orange-500/20 selection:text-orange-700 dark:selection:text-orange-300 transition-colors duration-300">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-12 space-y-12">
        {/* Header Hero */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 text-xs font-semibold">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Tủ Sách Tiêu Biểu & Thư Viện Tương Tác</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
            Khám phá những cuốn sách kinh điển đã được bóc tách trực quan
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
            Mỗi cuốn sách dưới đây đều được chuẩn bị sẵn sàng với sơ đồ Visual Lab tương tác, tóm tắt lý thuyết cô đọng và hệ thống câu hỏi kiểm tra tư duy.
          </p>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-[#10161D] border border-slate-200/80 dark:border-white/10">
          {/* Categories */}
          <div className="flex flex-wrap items-center gap-2">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  selectedCategory === c.id
                    ? "bg-orange-600 text-white shadow-md shadow-orange-600/20"
                    : "bg-white dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200/80 dark:border-white/10"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên sách, tác giả, tag..."
              className="w-full pl-10 pr-4 py-2 rounded-xl text-xs bg-white dark:bg-white/5 border border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-orange-500"
            />
          </div>
        </div>

        {/* Books Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredBooks.map((book) => (
            <div
              key={book.id}
              className="rounded-3xl bg-slate-50 dark:bg-[#10161D] border border-slate-200/80 dark:border-white/10 overflow-hidden flex flex-col justify-between hover:shadow-2xl transition-all duration-300 group hover:-translate-y-1"
            >
              <div>
                {/* Cover Image */}
                <div className="h-64 overflow-hidden bg-slate-900 relative">
                  <img
                    src={book.cover}
                    alt={book.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-slate-900/80 backdrop-blur-md text-[11px] font-mono font-bold text-orange-400 border border-white/10">
                    {book.totalChapters} Chương
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                  <div className="space-y-1">
                    <span className="text-[11px] font-mono font-bold text-orange-600 dark:text-orange-400 uppercase">
                      {book.categoryName}
                    </span>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug">
                      {book.title}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Tác giả: {book.author}
                    </p>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3">
                    {book.description}
                  </p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {book.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-white/5 text-[10px] font-mono text-slate-600 dark:text-slate-400"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Footer */}
              <div className="p-6 pt-0 border-t border-slate-200/60 dark:border-white/5 mt-4">
                <div className="pt-4 flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-500 flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Đã bóc tách 100%</span>
                  </span>

                  <Link
                    href={`/books/${book.id}`}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-500 text-white shadow-md shadow-orange-600/20 inline-flex items-center gap-1.5 transition-all"
                  >
                    <span>Bắt đầu đọc</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Banner */}
        <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-orange-600 to-amber-600 text-white text-center space-y-4">
          <h3 className="text-2xl font-bold">Bạn có cuốn sách riêng muốn bóc tách?</h3>
          <p className="text-sm text-orange-100 max-w-xl mx-auto">
            Tải file PDF bất kỳ vào thư viện cá nhân của bạn, hệ thống AI sẽ tự động phân rã thành bài học và dựng sơ đồ tương tác chỉ trong vài giây.
          </p>
          <div className="pt-2">
            <Link
              href="/library"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold bg-white text-orange-700 hover:bg-orange-50 shadow-lg transition-all"
            >
              <Bookmark className="w-4 h-4" />
              <span>Tải sách lên Thư viện của tôi</span>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
