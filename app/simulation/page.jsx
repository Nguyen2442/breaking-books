"use client";

import React, { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import {
  Cpu,
  Zap,
  Layers,
  Sparkles,
  ArrowRight,
  Play,
  RotateCcw,
  Sliders,
  CheckCircle2,
  TrendingUp,
  GitBranch,
  Brain,
  Share2,
  BarChart3,
  Flame,
} from "lucide-react";

export default function InteractiveLabPage() {
  const [activeTab, setActiveTab] = useState("pod"); // "pod" | "mindmap" | "chart" | "decision" | "system"

  // 1. Mind Map state (Atomic Habits loop)
  const [selectedMindNode, setSelectedMindNode] = useState("cue");

  // 2. Chart state (Compound growth calculator)
  const [monthlySaving, setMonthlySaving] = useState(5); // Triệu VNĐ
  const [growthRate, setGrowthRate] = useState(12); // % mỗi năm
  const [years, setYears] = useState(10); // Năm

  // 3. Technical simulation state (Distributed Sync vs Async)
  const [replicationMode, setReplicationMode] = useState("sync");
  const [packetSent, setPacketSent] = useState(false);
  const [ackReceived, setAckReceived] = useState(false);

  // 4. Decision Tree state
  const [decisionStep, setDecisionStep] = useState(1);
  const [decisionHistory, setDecisionHistory] = useState([]);

  // 5. Pod Resource Isolation state (Kubernetes / DevOps)
  const [podScenario, setPodScenario] = useState("cgroups"); // "nolimits" | "cgroups" | "oom"
  const [podTraffic, setPodTraffic] = useState(1200); // req/s

  // Calculate compound interest for Chart
  function calculateCompound(pMonthly, rate, yr) {
    const r = rate / 100 / 12;
    const n = yr * 12;
    const futureVal = pMonthly * ((Math.pow(1 + r, n) - 1) / r);
    const totalInvested = pMonthly * n;
    const profit = Math.max(0, futureVal - totalInvested);
    return {
      futureVal: Math.round(futureVal),
      totalInvested: Math.round(totalInvested),
      profit: Math.round(profit),
    };
  }

  const chartData = calculateCompound(monthlySaving, growthRate, years);

  function triggerPacket() {
    setPacketSent(true);
    setAckReceived(false);
    setTimeout(() => {
      setAckReceived(true);
    }, replicationMode === "sync" ? 800 : 250);
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#090D13] text-slate-900 dark:text-slate-100 font-sans selection:bg-orange-500/20 selection:text-orange-700 dark:selection:text-orange-300 transition-colors duration-300">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-8 py-12 space-y-12">
        {/* Hero */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 text-xs font-semibold">
            <Cpu className="w-3.5 h-3.5" />
            <span>Phòng Thí Nghiệm Trực Quan Đa Lĩnh Vực</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
            Không còn sơ đồ chết trên trang giấy. <br />
            <span className="bg-gradient-to-r from-orange-600 via-amber-500 to-orange-500 bg-clip-text text-transparent">
              Chạm, điều khiển và trực quan hóa kiến thức.
            </span>
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
            Tùy theo thể loại sách và bản chất tri thức, Breaking Books tự động thiết lập dạng thức trực quan tối ưu nhất: từ <b>Sơ đồ tư duy (Mind Map)</b>, <b>Biểu đồ tương tác (Chart)</b> cho tới <b>Cây quyết định (Decision Tree)</b> và <b>Mô phỏng kiến trúc hệ thống (Simulation)</b>.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-wrap items-center justify-center gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-[#10161D] max-w-4xl mx-auto border border-slate-200/80 dark:border-white/10">
          <button
            onClick={() => setActiveTab("pod")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "pod"
                ? "bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>Cô lập Tài nguyên Pod (K8s)</span>
          </button>

          <button
            onClick={() => setActiveTab("mindmap")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "mindmap"
                ? "bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Brain className="w-4 h-4" />
            <span>Sơ đồ Tư duy (Mind Map)</span>
          </button>

          <button
            onClick={() => setActiveTab("chart")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "chart"
                ? "bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Biểu đồ Tương tác (Chart)</span>
          </button>

          <button
            onClick={() => setActiveTab("decision")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "decision"
                ? "bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <GitBranch className="w-4 h-4" />
            <span>Ma trận Quyết định (2x2)</span>
          </button>

          <button
            onClick={() => setActiveTab("system")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "system"
                ? "bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Sao chép Phân tán (Replication)</span>
          </button>
        </div>

        {/* =========================================================================
            TAB 0: POD RESOURCE ISOLATION (Mô phỏng Cô lập Tài nguyên Pod trên Node Đơn)
           ========================================================================= */}
        {activeTab === "pod" && (
          <div className="rounded-3xl bg-slate-900 text-white p-6 sm:p-10 border border-slate-800 shadow-2xl space-y-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-semibold mb-2">
                  <span>🧪 Phòng Thí Nghiệm Trực Quan · Kubernetes & Microservices</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold">
                  Mô phỏng Cô lập Tài nguyên Pod trên Node Đơn
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Điều chỉnh tải lượng request và quan sát cách container Web API và Worker tác vụ nền tranh chấp hoặc cô lập tài nguyên qua Linux cgroups.
                </p>
              </div>

              {/* Slider for Traffic */}
              <div className="w-full sm:w-64 bg-slate-800/80 p-3 rounded-2xl border border-slate-700 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-300">Tải lượng Request</span>
                  <span className="font-mono text-orange-400 font-bold">{podTraffic.toLocaleString()} req/s</span>
                </div>
                <input
                  type="range"
                  min="200"
                  max="5000"
                  step="100"
                  value={podTraffic}
                  onChange={(e) => setPodTraffic(Number(e.target.value))}
                  className="w-full accent-orange-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Scenario Pills */}
            <div className="flex flex-wrap gap-2.5">
              {[
                { id: "nolimits", label: "🔴 1. Không giới hạn (No Limits)", desc: "Tranh chấp CPU & Noisy Neighbor" },
                { id: "cgroups", label: "🟢 2. Bật cgroups CPU Limit", desc: "Cô lập an toàn & Throttling" },
                { id: "oom", label: "⚠️ 3. Thử nghiệm Rò rỉ RAM (OOM)", desc: "OOMKilled & Bảo vệ Node" },
              ].map((sc) => (
                <button
                  key={sc.id}
                  onClick={() => setPodScenario(sc.id)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    podScenario === sc.id
                      ? "bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-600/30 scale-[1.02]"
                      : "bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{sc.label}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* 3 Metric Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className={`p-4 rounded-2xl border transition-all ${
                podScenario === "nolimits"
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                  : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              }`}>
                <span className="text-[11px] font-mono text-slate-400 block">Độ trễ P99 Web API</span>
                <span className="text-2xl font-black font-mono mt-1 block">
                  {podScenario === "nolimits" ? "1,450 ms" : "18 ms"}
                </span>
                <span className="text-[11px] mt-1 block">
                  {podScenario === "nolimits" ? "⚠️ Timeout & Nghẽn nặng" : "✓ Mượt mà & Đạt SLA"}
                </span>
              </div>

              <div className={`p-4 rounded-2xl border transition-all ${
                podScenario === "nolimits"
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                  : "bg-slate-800/80 border-slate-700 text-slate-200"
              }`}>
                <span className="text-[11px] font-mono text-slate-400 block">Tổng tải CPU Node (4 Cores)</span>
                <span className="text-2xl font-black font-mono mt-1 block">
                  {podScenario === "nolimits" ? "98% (3.9 / 4 Cores)" : "62% (2.5 / 4 Cores)"}
                </span>
                <span className="text-[11px] mt-1 block">
                  {podScenario === "nolimits" ? "Nguy cơ sập toàn Node" : "Trong ngưỡng an toàn"}
                </span>
              </div>

              <div className={`p-4 rounded-2xl border transition-all ${
                podScenario === "oom"
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                  : podScenario === "nolimits"
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                  : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              }`}>
                <span className="text-[11px] font-mono text-slate-400 block">Trạng thái Pod Worker</span>
                <span className="text-xl font-black font-mono mt-1 block">
                  {podScenario === "oom"
                    ? "OOMKilled (Exit 137)"
                    : podScenario === "nolimits"
                    ? "Chiếm 3.2 Cores"
                    : "Throttled (1.0 Core Max)"}
                </span>
                <span className="text-[11px] mt-1 block">
                  {podScenario === "oom"
                    ? "K8s tự khởi động lại worker"
                    : podScenario === "nolimits"
                    ? "Lấn át Web API chính"
                    : "cgroups kẹp chặt trần"}
                </span>
              </div>
            </div>

            {/* Visual Architecture Box (Node Frame + 2 Containers + cgroups wall) */}
            <div className="p-6 rounded-2xl bg-slate-950/80 border border-slate-800 relative overflow-hidden">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 text-xs">
                <span className="font-mono font-bold text-slate-300 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-orange-500" />
                  <span>K8s Worker Node (4 CPU Cores · 8 GB RAM)</span>
                </span>
                <span className="font-mono text-slate-400">cgroups v2 enabled</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 relative">
                {/* Web API Container */}
                <div className={`p-5 rounded-2xl border transition-all ${
                  podScenario === "nolimits"
                    ? "bg-rose-950/20 border-rose-500/40"
                    : "bg-emerald-950/20 border-emerald-500/40"
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white flex items-center gap-2">
                      <span>🚀 Web API Container (Chính)</span>
                    </span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                      podScenario === "nolimits"
                        ? "bg-rose-500/20 text-rose-300"
                        : "bg-emerald-500/20 text-emerald-300"
                    }`}>
                      {podScenario === "nolimits" ? "CPU Starvation (Nghẽn)" : "Guaranteed (2.0 Cores)"}
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div>
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>CPU Được Cấp</span>
                        <span className="font-mono font-bold text-white">
                          {podScenario === "nolimits" ? "0.7 Core (Bị cướp)" : "2.0 Cores (Đủ)"}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            podScenario === "nolimits" ? "bg-rose-500 w-[20%]" : "bg-emerald-500 w-[60%]"
                          }`}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>Request Hàng Đợi (Queue)</span>
                        <span className="font-mono text-white">
                          {podScenario === "nolimits" ? "1,240 req (Tràn)" : "12 req (Trống)"}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            podScenario === "nolimits" ? "bg-rose-500 w-[95%]" : "bg-emerald-500 w-[10%]"
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Worker Container */}
                <div className={`p-5 rounded-2xl border transition-all ${
                  podScenario === "oom"
                    ? "bg-amber-950/20 border-amber-500/40"
                    : podScenario === "nolimits"
                    ? "bg-rose-950/20 border-rose-500/40"
                    : "bg-blue-950/20 border-blue-500/40"
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white flex items-center gap-2">
                      <span>⚙️ Worker Batch (Tác vụ nền)</span>
                    </span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                      podScenario === "oom"
                        ? "bg-amber-500/20 text-amber-300"
                        : podScenario === "nolimits"
                        ? "bg-rose-500/20 text-rose-300"
                        : "bg-blue-500/20 text-blue-300"
                    }`}>
                      {podScenario === "oom"
                        ? "OOMKilled (Exit 137)"
                        : podScenario === "nolimits"
                        ? "Chiếm 3.2 Cores (Lấn lướt)"
                        : "Throttled (Limit 1.0 Core)"}
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div>
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>CPU Tiêu Thụ</span>
                        <span className="font-mono font-bold text-white">
                          {podScenario === "oom" ? "0 Core (Restarting)" : podScenario === "nolimits" ? "3.2 Cores (80%)" : "1.0 Core (Capped)"}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            podScenario === "oom"
                              ? "bg-slate-700 w-0"
                              : podScenario === "nolimits"
                              ? "bg-rose-500 w-[85%]"
                              : "bg-blue-500 w-[30%]"
                          }`}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>Bộ nhớ RAM</span>
                        <span className="font-mono text-white">
                          {podScenario === "oom" ? "Vượt 2GB trần -> Kill" : podScenario === "nolimits" ? "6.2 GB (Không giới hạn)" : "1.2 GB / 2.0 GB"}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            podScenario === "oom"
                              ? "bg-rose-500 w-[100%]"
                              : podScenario === "nolimits"
                              ? "bg-amber-500 w-[80%]"
                              : "bg-blue-500 w-[55%]"
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Pedagogical Explanation Card */}
            <div className="p-6 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Phân tích Cơ chế & Luồng Khái niệm Kiến trúc</span>
              </div>

              <h4 className="text-base font-bold text-white">
                {podScenario === "nolimits" && "Kịch bản 1: Tranh chấp CPU & Hiện tượng Noisy Neighbor"}
                {podScenario === "cgroups" && "Kịch bản 2: Cơ chế Throttling của Linux cgroups & Bảo toàn SLO"}
                {podScenario === "oom" && "Kịch bản 3: Cách ly Sự cố cấp Container với Kernel OOM-Killer"}
              </h4>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                {podScenario === "nolimits" && (
                  "Khi một Pod không được thiết lập resources.limits, Linux kernel CFS sẽ phân bổ chu kỳ CPU tự do. Khi tác vụ nền (Worker) gặp lô dữ liệu lớn, nó chiếm dụng toàn bộ tài nguyên rảnh rỗi trên Node, khiến Web API bị 'bỏ đói' CPU (CPU Starvation). Độ trễ phản hồi vọt từ 18ms lên 1,450ms làm người dùng gặp lỗi 504 Gateway Timeout."
                )}
                {podScenario === "cgroups" && (
                  "Bằng cách thiết lập resources.limits.cpu = 1.0 cho Worker, Linux CFS cgroups sẽ áp đặt hạn ngạch chu kỳ thời gian (cpu.cfs_quota_us). Dù Worker muốn ngốn thêm CPU, kernel lập tức bóp xung nhịp (Throttling). Tác vụ nền chạy lâu hơn một chút nhưng Web API luôn giữ trọn vẹn 2.0 Cores để phục vụ khách hàng với độ trễ 18ms."
                )}
                {podScenario === "oom" && (
                  "Khác với CPU có thể bóp xung nhịp (Throttling), bộ nhớ RAM không thể co giãn. Khi Worker rò rỉ RAM vượt quá hạn mức 2GB, Linux cgroup memory subsystem gửi tín hiệu SIGKILL (Exit code 137) CHỈ tới tiến trình Worker vi phạm. K8s tự động khởi động lại container mới mà KHÔNG làm ảnh hưởng đến Web API hay các Pod khác trên cùng Node."
                )}
              </p>

              <div className="p-3.5 rounded-xl bg-slate-900/90 border-l-4 border-orange-500 text-xs text-slate-200">
                <strong>🎯 Quy tắc Thiết kế Thực chiến:</strong>{" "}
                {podScenario === "nolimits" && "Không bao giờ triển khai Pod lên Kubernetes Production mà bỏ trống phần resources.requests và limits."}
                {podScenario === "cgroups" && "Dùng requests để cam kết sàn tài nguyên khi lập lịch (Scheduling), dùng limits để ngăn chặn hiện tượng Noisy Neighbor."}
                {podScenario === "oom" && "Đặt memory limit sát với thực tế kèm buffer 25-30% để phát hiện sớm rò rỉ bộ nhớ trước khi kéo sập cả Node."}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 1: INTERACTIVE MIND MAP (Phát triển bản thân / Tâm lý)
           ========================================================================= */}
        {activeTab === "mindmap" && (
          <div className="rounded-3xl bg-slate-900 text-white p-6 sm:p-10 border border-slate-800 shadow-2xl space-y-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
              <div>
                <span className="text-xs font-mono font-bold text-orange-400 uppercase tracking-wider">
                  Mô hình Sách Phát triển bản thân & Tâm lý học
                </span>
                <h3 className="text-xl font-bold mt-1">
                  Vòng Lặp 4 Bước Hình Thành Thói Quen (The Habit Loop)
                </h3>
              </div>
              <span className="px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-semibold">
                Click vào từng nút để khám phá
              </span>
            </div>

            {/* Interactive Mind Map Visualizer */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                {
                  id: "cue",
                  step: "Bước 1",
                  name: "Gợi ý (Cue)",
                  sub: "Tín hiệu kích hoạt",
                  desc: "Môi trường hoặc thời gian kích hoạt não bộ dự đoán phần thưởng.",
                  color: "border-amber-500 bg-amber-500/10 text-amber-300",
                  rule: "Quy luật 1: Làm cho nó rõ ràng (Make it obvious).",
                },
                {
                  id: "craving",
                  step: "Bước 2",
                  name: "Khao khát (Craving)",
                  sub: "Động lực nội tại",
                  desc: "Không phải bản thân thói quen, mà là cảm giác biến đổi tâm lý do nó mang lại.",
                  color: "border-orange-500 bg-orange-500/10 text-orange-300",
                  rule: "Quy luật 2: Làm cho nó hấp dẫn (Make it attractive).",
                },
                {
                  id: "response",
                  step: "Bước 3",
                  name: "Phản hồi (Response)",
                  sub: "Hành động thực tế",
                  desc: "Hành động thói quen cụ thể bạn thực hiện khi ma sát đủ thấp.",
                  color: "border-blue-500 bg-blue-500/10 text-blue-300",
                  rule: "Quy luật 3: Làm cho nó dễ dàng (Make it easy).",
                },
                {
                  id: "reward",
                  step: "Bước 4",
                  name: "Phần thưởng (Reward)",
                  sub: "Thỏa mãn & Ghi nhớ",
                  desc: "Dopamine giải phóng, não bộ đóng dấu thói quen để lặp lại trong tương lai.",
                  color: "border-emerald-500 bg-emerald-500/10 text-emerald-300",
                  rule: "Quy luật 4: Làm cho nó thỏa mãn (Make it satisfying).",
                },
              ].map((node) => (
                <button
                  key={node.id}
                  onClick={() => setSelectedMindNode(node.id)}
                  className={`p-5 rounded-2xl border text-left transition-all cursor-pointer ${
                    selectedMindNode === node.id
                      ? `${node.color} scale-[1.02] shadow-lg ring-2 ring-white/20`
                      : "border-slate-800 bg-slate-800/40 text-slate-300 hover:bg-slate-800/80"
                  }`}
                >
                  <span className="text-[10px] font-mono font-bold uppercase opacity-80">
                    {node.step}
                  </span>
                  <h4 className="text-base font-bold mt-1 text-white">{node.name}</h4>
                  <p className="text-xs text-slate-400 mt-0.5">{node.sub}</p>
                </button>
              ))}
            </div>

            {/* Mind Map Dynamic Detail Box */}
            <div className="p-6 rounded-2xl bg-slate-800/70 border border-slate-700 space-y-3">
              <h4 className="text-sm font-bold text-orange-400">
                💡 Phân tích chiến lược áp dụng:
              </h4>
              <p className="text-sm text-slate-200 leading-relaxed">
                {selectedMindNode === "cue" &&
                  "Gợi ý: Đặt sách ngay trên gối, để giày chạy bộ cạnh cửa phòng ngủ. Muốn loại bỏ thói quen xấu? Giấu xa tầm mắt (Make it invisible)."}
                {selectedMindNode === "craving" &&
                  "Khao khát: Kết hợp thói quen cần làm với thói quen ưa thích (Temptation Bundling) — ví dụ: chỉ được nghe podcast yêu thích khi đang chạy bộ."}
                {selectedMindNode === "response" &&
                  "Phản hồi: Áp dụng 'Quy tắc 2 phút' (Two-Minute Rule). Bắt đầu một cuốn sách bằng việc chỉ đọc đúng 1 trang mỗi tối để triệt tiêu ma sát trì hoãn."}
                {selectedMindNode === "reward" &&
                  "Phần thưởng: Đánh dấu tích xanh vào lịch sau mỗi buổi tập (Visual Habit Tracker). Sự tiến bộ trực quan là phần thưởng tâm lý gây nghiện nhất."}
              </p>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 2: INTERACTIVE CHART (Sách Kinh tế / Tài chính)
           ========================================================================= */}
        {activeTab === "chart" && (
          <div className="rounded-3xl bg-slate-900 text-white p-6 sm:p-10 border border-slate-800 shadow-2xl space-y-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
              <div>
                <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider">
                  Mô hình Sách Tài chính, Kinh tế & Đầu tư
                </span>
                <h3 className="text-xl font-bold mt-1">
                  Mô Phỏng Sức Mạnh Lãi Suất Kép & Tự Do Tài Chính
                </h3>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 font-mono">Tài sản tích lũy dự kiến:</span>
                <p className="text-xl font-black text-emerald-400">
                  {chartData.futureVal.toLocaleString("vi-VN")} Triệu VNĐ
                </p>
              </div>
            </div>

            {/* Controls Sliders */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 p-6 rounded-2xl bg-slate-800/60 border border-slate-700">
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Tiết kiệm / tháng:</span>
                  <span className="font-bold text-white">{monthlySaving} Triệu VNĐ</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="50"
                  step="1"
                  value={monthlySaving}
                  onChange={(e) => setMonthlySaving(Number(e.target.value))}
                  className="w-full accent-orange-500"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Lợi suất đầu tư / năm:</span>
                  <span className="font-bold text-white">{growthRate}% / năm</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="25"
                  step="1"
                  value={growthRate}
                  onChange={(e) => setGrowthRate(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Thời gian đầu tư:</span>
                  <span className="font-bold text-white">{years} Năm</span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="30"
                  step="1"
                  value={years}
                  onChange={(e) => setYears(Number(e.target.value))}
                  className="w-full accent-blue-500"
                />
              </div>
            </div>

            {/* Interactive SVG Bar Chart */}
            <div className="p-6 rounded-2xl bg-slate-800/40 border border-slate-700/80 space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>So sánh: Vốn tự bỏ ra vs Lợi nhuận sinh lời từ Lãi Kép</span>
                <span className="font-mono text-emerald-300">
                  Lãi gấp {(chartData.futureVal / (chartData.totalInvested || 1)).toFixed(1)}x vốn
                </span>
              </div>

              <div className="space-y-3 pt-2">
                {/* Total Invested */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">Tổng vốn tích lũy:</span>
                    <span className="font-mono font-bold">{chartData.totalInvested.toLocaleString()} Tr</span>
                  </div>
                  <div className="w-full h-4 rounded-full bg-slate-700 overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, (chartData.totalInvested / chartData.futureVal) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Compound Profit */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-emerald-400 font-bold">Lợi nhuận từ Lãi Kép (Kỳ quan thứ 8):</span>
                    <span className="font-mono font-bold text-emerald-400">+{chartData.profit.toLocaleString()} Tr</span>
                  </div>
                  <div className="w-full h-4 rounded-full bg-slate-700 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, (chartData.profit / chartData.futureVal) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 3: DECISION TREE (Sách Chiến lược / Quản trị)
           ========================================================================= */}
        {activeTab === "decision" && (
          <div className="rounded-3xl bg-slate-900 text-white p-6 sm:p-10 border border-slate-800 shadow-2xl space-y-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
              <div>
                <span className="text-xs font-mono font-bold text-blue-400 uppercase tracking-wider">
                  Mô hình Sách Chiến lược & Ra quyết định
                </span>
                <h3 className="text-xl font-bold mt-1">
                  Ma Trận Ưu Tiên Eisenhower (Khẩn cấp vs Quan trọng)
                </h3>
              </div>
              <button
                onClick={() => setDecisionStep(1)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Đặt lại kịch bản</span>
              </button>
            </div>

            {/* Interactive 2x2 Matrix */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Q1: Do First */}
              <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-md bg-rose-500/20 text-rose-300 text-[10px] font-mono font-bold uppercase">
                    Ô 1: Làm ngay
                  </span>
                  <span className="text-xs font-bold text-rose-400">Khẩn cấp & Quan trọng</span>
                </div>
                <h4 className="text-sm font-bold text-white">Khủng hoảng & Hạn chót</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Sự cố máy chủ ngừng hoạt động, báo cáo thuế hạn chót hôm nay, cấp cứu khách hàng VIP.
                </p>
              </div>

              {/* Q2: Schedule */}
              <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold uppercase">
                    Ô 2: Lên lịch
                  </span>
                  <span className="text-xs font-bold text-emerald-400">Không khẩn cấp nhưng Quan trọng</span>
                </div>
                <h4 className="text-sm font-bold text-white">Vùng Đột phá & Thành công bền vững</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Đọc sách bồi dưỡng tư duy, tập thể dục, xây dựng mối quan hệ chiến lược, lập kế hoạch 5 năm.
                </p>
              </div>

              {/* Q3: Delegate */}
              <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold uppercase">
                    Ô 3: Ủy quyền
                  </span>
                  <span className="text-xs font-bold text-amber-400">Khẩn cấp nhưng Không quan trọng</span>
                </div>
                <h4 className="text-sm font-bold text-white">Bẫy bận rộn giả tạo</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Các cuộc họp vô bổ, cuộc gọi gián đoạn công việc, trả lời email lặt vặt tức thì.
                </p>
              </div>

              {/* Q4: Delete */}
              <div className="p-6 rounded-2xl bg-slate-800/60 border border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-md bg-slate-700 text-slate-300 text-[10px] font-mono font-bold uppercase">
                    Ô 4: Loại bỏ
                  </span>
                  <span className="text-xs font-bold text-slate-400">Không khẩn & Không quan trọng</span>
                </div>
                <h4 className="text-sm font-bold text-white">Kẻ cắp thời gian</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Lướt mạng xã hội vô thức hàng giờ, chơi game quá độ, xem tin tức giật gân tiêu cực.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 4: TECHNICAL SIMULATION (Sách Công nghệ / Hệ thống)
           ========================================================================= */}
        {activeTab === "system" && (
          <div className="rounded-3xl bg-slate-900 text-white p-6 sm:p-10 border border-slate-800 shadow-2xl space-y-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
              <div>
                <span className="text-xs font-mono font-bold text-orange-400 uppercase tracking-wider">
                  Mô hình Sách Kỹ thuật & Hệ thống Phân tán
                </span>
                <h3 className="text-xl font-bold mt-1">
                  Mô Phỏng Sao Chép Dữ Liệu: Synchronous vs Asynchronous Replication
                </h3>
              </div>

              <div className="flex items-center gap-2 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
                <button
                  onClick={() => setReplicationMode("sync")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    replicationMode === "sync"
                      ? "bg-orange-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Đồng bộ (Sync)
                </button>
                <button
                  onClick={() => setReplicationMode("async")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    replicationMode === "async"
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
              <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/80 space-y-2">
                <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center mx-auto font-bold text-sm">
                  Leader
                </div>
                <h4 className="text-xs font-bold text-white">Leader Node</h4>
                <p className="text-[11px] text-slate-400">Nhận Write Request từ Client</p>
                <div className="h-1 rounded-full bg-emerald-500/50 w-16 mx-auto mt-2" />
              </div>

              {/* Pipe & Trigger Button */}
              <div className="space-y-3">
                <div className="text-xs font-mono text-slate-400">
                  {replicationMode === "sync"
                    ? "Chờ Follower xác nhận ACK trước khi báo thành công"
                    : "Báo thành công ngay khi ghi xong Leader"}
                </div>

                <button
                  onClick={triggerPacket}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-600/30 inline-flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Gửi 1 Ghi dữ liệu (Write Request)</span>
                </button>

                {packetSent && (
                  <div className="text-[11px] font-mono text-orange-300 animate-pulse">
                    {ackReceived
                      ? `✓ Hoàn thành (${replicationMode === "sync" ? "Độ trễ cao hơn, bền vững 100%" : "Cực nhanh, chấp nhận rủi ro mất dữ liệu nếu Leader crash"})`
                      : "Đang truyền gói tin qua mạng..."}
                  </div>
                )}
              </div>

              {/* Follower Node */}
              <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/80 space-y-2">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center mx-auto font-bold text-sm">
                  Replica
                </div>
                <h4 className="text-xs font-bold text-white">Follower Node</h4>
                <p className="text-[11px] text-slate-400">Đồng bộ WAL & phản hồi ACK</p>
                <div className="h-1 rounded-full bg-blue-500/50 w-16 mx-auto mt-2" />
              </div>
            </div>
          </div>
        )}

        {/* Bottom CTA */}
        <div className="text-center pt-8 border-t border-slate-200 dark:border-white/10 space-y-4">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">
            Trải nghiệm toàn bộ phòng thí nghiệm tương tác trong các cuốn sách
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Hơn 100+ sơ đồ tương tác thực tế đang chờ bạn khám phá trong từng bài học nguyên tử.
          </p>
          <div className="pt-2">
            <Link
              href="/library"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-500 text-white shadow-md shadow-orange-600/20 transition-all"
            >
              <span>Vào Thư viện đọc sách ngay</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
