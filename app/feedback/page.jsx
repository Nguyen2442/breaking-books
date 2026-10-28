"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import {
  BookOpen,
  ArrowRight,
  MessageSquarePlus,
  ThumbsUp,
  Filter,
  CheckCircle2,
  Clock,
  Send,
  Loader2,
  AlertCircle,
  Moon,
  Sun,
  Sparkles,
} from "lucide-react";

const STATUS_MAP = {
  PENDING: { label: "Đang xem xét", color: "bg-slate-500/10 text-slate-500 border-slate-500/20" },
  PLANNED: { label: "Đã lên kế hoạch", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  IN_PROGRESS: { label: "Đang phát triển", color: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  COMPLETED: { label: "Đã hoàn thành", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
};

const CATEGORIES = [
  { id: "all", label: "Tất cả danh mục" },
  { id: "feature", label: "Tính năng mới" },
  { id: "improvement", label: "Cải tiến giao diện" },
  { id: "content", label: "Sách & Nội dung" },
  { id: "other", label: "Khác" },
];

export default function FeedbackPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isDark, setIsDark] = useState(false);

  // Feedbacks list & filters
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  // New feedback form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("feature");
  const [authorName, setAuthorName] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [submitError, setSubmitError] = useState("");

  const [upvotedIds, setUpvotedIds] = useState(new Set());

  const fetchFeedbacks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== "all") params.set("category", selectedCategory);
      if (selectedStatus !== "all") params.set("status", selectedStatus);

      const res = await fetch(`/api/feedback?${params.toString()}`);
      const data = await res.json();
      if (data.ok) setFeedbacks(data.feedbacks || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, selectedStatus]);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
    fetch("/api/auth")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.user) {
          setCurrentUser(data.user);
          setAuthorName(data.user.name || "");
          setAuthorEmail(data.user.email || "");
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchFeedbacks();
  }, [fetchFeedbacks]);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("bb_theme", next ? "dark" : "light");
    } catch {}
  }

  async function handleUpvote(feedbackId) {
    if (upvotedIds.has(feedbackId)) return;
    setUpvotedIds((prev) => new Set([...prev, feedbackId]));

    // Optimistic UI update
    setFeedbacks((prev) =>
      prev.map((f) => (f.id === feedbackId ? { ...f, upvotes: (f.upvotes || 0) + 1 } : f))
    );

    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "upvote", feedbackId }),
      });
    } catch (e) {
      console.error("Upvote error", e);
    }
  }

  async function handleSubmitFeedback(e) {
    e.preventDefault();
    setSubmitError("");
    setSubmitMessage("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          category,
          authorName,
          authorEmail,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Gửi góp ý thất bại");
      }

      setSubmitMessage("Cảm ơn bạn! Ý tưởng của bạn đã được gửi thành công.");
      setTitle("");
      setDescription("");
      fetchFeedbacks();
      setTimeout(() => setSubmitMessage(""), 5000);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#090D13] text-slate-900 dark:text-slate-100 font-sans selection:bg-orange-500/20 selection:text-orange-700 dark:selection:text-orange-300 transition-colors duration-300">
      {/* Background Ambience */}
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-orange-500/10 via-amber-500/5 to-transparent pointer-events-none" />

      {/* Header */}
      <Navbar />

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-16 sm:py-24 space-y-16">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs font-semibold border border-orange-500/20">
            <MessageSquarePlus className="w-3.5 h-3.5" />
            <span>Xây dựng sản phẩm cùng cộng đồng</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
            Góp ý & Yêu cầu Tính năng
          </h1>
          <p className="text-base text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
            Ý kiến của bạn định hình tương lai của Breaking Books. Hãy bình chọn các tính năng bạn yêu thích hoặc gửi ý tưởng mới cho chúng tôi.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Form Gửi Góp Ý */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 p-6 sm:p-7 rounded-3xl bg-slate-50 dark:bg-[#10161D] border border-slate-200/80 dark:border-white/10 space-y-5 shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center font-bold">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Gửi ý tưởng mới</h3>
              </div>

              {submitMessage && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{submitMessage}</span>
                </div>
              )}

              {submitError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              <form onSubmit={handleSubmitFeedback} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tiêu đề ý tưởng *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Đọc sách bằng giọng nói AI..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Danh mục
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
                  >
                    <option value="feature">Tính năng mới</option>
                    <option value="improvement">Cải tiến giao diện</option>
                    <option value="content">Sách & Nội dung</option>
                    <option value="other">Khác</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Mô tả chi tiết *
                  </label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Mô tả cách tính năng này giúp trải nghiệm đọc sách của bạn tốt hơn..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tên của bạn
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Tuấn Nguyễn"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-orange-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-500 text-white shadow-md shadow-orange-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Gửi ý tưởng</span>
                      <Send className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Danh Sách Góp Ý & Upvote */}
          <div className="lg:col-span-2 space-y-6">
            {/* Filter pills */}
            <div className="flex flex-wrap items-center gap-2 pb-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer border ${
                    selectedCategory === cat.id
                      ? "bg-orange-600 text-white border-orange-600"
                      : "bg-slate-50 dark:bg-[#10161D] border-slate-200/80 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="py-20 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto" />
                <p className="text-xs text-slate-500 mt-2">Đang tải danh sách góp ý...</p>
              </div>
            ) : feedbacks.length === 0 ? (
              <div className="p-12 text-center rounded-3xl bg-slate-50 dark:bg-[#10161D] border border-slate-200/80 dark:border-white/10 text-xs text-slate-500">
                Chưa có ý tưởng nào trong danh mục này. Hãy là người đầu tiên đóng góp!
              </div>
            ) : (
              <div className="space-y-4">
                {feedbacks.map((item) => {
                  const statusInfo = STATUS_MAP[item.status] || STATUS_MAP.PENDING;
                  const hasUpvoted = upvotedIds.has(item.id);

                  return (
                    <div
                      key={item.id}
                      className="p-5 sm:p-6 rounded-3xl bg-slate-50 dark:bg-[#10161D] border border-slate-200/80 dark:border-white/10 hover:border-orange-500/30 transition-all flex items-start gap-4 sm:gap-5"
                    >
                      {/* Upvote button */}
                      <button
                        onClick={() => handleUpvote(item.id)}
                        disabled={hasUpvoted}
                        className={`shrink-0 w-14 py-2.5 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer border ${
                          hasUpvoted
                            ? "bg-orange-600 text-white border-orange-600 shadow-md shadow-orange-600/30"
                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-orange-500 hover:text-orange-600"
                        }`}
                        title="Bình chọn cho tính năng này"
                      >
                        <ThumbsUp className={`w-4 h-4 ${hasUpvoted ? "fill-current" : ""}`} />
                        <span className="text-xs font-bold font-mono">{item.upvotes || 0}</span>
                      </button>

                      {/* Content */}
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            {item.title}
                          </h3>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono border ${statusInfo.color}`}
                          >
                            {statusInfo.label}
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                          {item.description}
                        </p>

                        <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-1">
                          <span>Bởi <b>{item.authorName || "Thành viên"}</b></span>
                          <span>•</span>
                          <span>{new Date(item.createdAt).toLocaleDateString("vi-VN")}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-white/10 py-8 px-4 text-center text-xs text-slate-500 space-y-2">
        <p>Breaking Books © 2026 · Nền tảng Đọc sách & Trực quan hoá Thông minh cho Tất cả Mọi người</p>
      </footer>
    </div>
  );
}
