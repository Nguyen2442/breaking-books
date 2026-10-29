"use client";

import React, { useState, useRef } from "react";
import { ShieldCheck, Cpu, Wifi, KeyRound, Sparkles, CheckCircle2, RefreshCw, UserCheck } from "lucide-react";

/**
 * Bespoke 3D Interactive Holographic Access Passcard
 * Features true 3D perspective tilt, specular holographic glare,
 * multi-depth parallax layers (translateZ), and interactive 3D card flip.
 */
export default function Interactive3DCard({
  mode = "login", // "login" | "register"
  userName = "",
  userEmail = "",
  active = false,
}) {
  const [rotate, setRotate] = useState({ x: 0, y: 0 });
  const [isFlipped, setIsFlipped] = useState(false);
  const [glare, setGlare] = useState({ x: 50, y: 50, opacity: 0 });
  const cardRef = useRef(null);

  function handleMouseMove(e) {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const px = x / rect.width;
    const py = y / rect.height;

    // Tilt angle (-18 to 18 degrees)
    const rotX = -(py - 0.5) * 24;
    const rotY = (px - 0.5) * 28;

    setRotate({ x: rotX, y: rotY });
    setGlare({
      x: px * 100,
      y: py * 100,
      opacity: 0.35,
    });
  }

  function handleMouseLeave() {
    setRotate({ x: 0, y: 0 });
    setGlare({ x: 50, y: 50, opacity: 0 });
  }

  const isLogin = mode === "login";
  const displayName = userName || (isLogin ? "Thành viên Breaking Books" : "Học viên Đăng ký Mới");
  const displayEmail = userEmail || (isLogin ? "member@breakingbooks.internal" : "new.student@breakingbooks.internal");
  const cardId = isLogin ? "BB-PASS-2026-AUTH" : "BB-ENROLL-2026-NEW";

  return (
    <div className="w-full flex flex-col items-center select-none py-4">
      {/* 3D Perspective Viewport */}
      <div
        className="w-full max-w-[360px] h-[220px] relative cursor-pointer"
        style={{ perspective: 1000 }}
        onClick={() => setIsFlipped(!isFlipped)}
        title="Bấm để lật thẻ 3D"
      >
        {/* Card Rotator Container */}
        <div
          ref={cardRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="w-full h-full relative motion-safe:transition-transform duration-200 ease-out"
          style={{
            transformStyle: "preserve-3d",
            transform: `rotateX(${rotate.x}deg) rotateY(${rotate.y + (isFlipped ? 180 : 0)}deg)`,
          }}
        >
          {/* ============================================================== */}
          {/* FRONT FACE (Mặt trước thẻ)                                     */}
          {/* ============================================================== */}
          <div
            className="absolute inset-0 rounded-2xl p-5 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-orange-500/30 text-white shadow-2xl flex flex-col justify-between overflow-hidden"
            style={{
              backfaceVisibility: "hidden",
              boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.7), inset 0 1px 1px rgba(255, 255, 255, 0.2)",
            }}
          >
            {/* Holographic Specular Glare Overlay */}
            <div
              className="absolute inset-0 pointer-events-none mix-blend-overlay motion-safe:transition-opacity duration-150"
              style={{
                opacity: glare.opacity,
                background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255, 255, 255, 0.6) 0%, rgba(249, 115, 22, 0.2) 40%, transparent 70%)`,
              }}
            />

            {/* Geometric Circuit Pattern Grid */}
            <div
              className="absolute inset-0 opacity-10 pointer-events-none"
              style={{
                backgroundImage: "radial-gradient(rgba(255, 255, 255, 0.4) 1px, transparent 1px)",
                backgroundSize: "16px 16px",
              }}
            />

            {/* Top Bar: Brand, Chip, and NFC Signal */}
            <div
              className="flex items-center justify-between relative z-10 motion-safe:transition-transform duration-200"
              style={{ transform: "translateZ(25px)" }}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-orange-600 flex items-center justify-center text-white shadow-md shadow-orange-600/30">
                  <KeyRound className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-xs font-bold tracking-tight text-white block leading-none">
                    Breaking Books
                  </span>
                  <span className="text-[10px] text-orange-400 font-medium block mt-0.5">
                    {isLogin ? "Thẻ xác thực thành viên" : "Thẻ phát hành tài khoản"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-slate-400 rotate-90" />
                <div className="w-8 h-6 rounded-md bg-gradient-to-br from-amber-300 via-amber-400 to-amber-600 border border-amber-200/60 shadow-inner flex items-center justify-center">
                  <Cpu className="w-3.5 h-3.5 text-amber-950 opacity-80" />
                </div>
              </div>
            </div>

            {/* Middle Section: Security ID & Biometric Hash */}
            <div
              className="relative z-10 my-auto motion-safe:transition-transform duration-200"
              style={{ transform: "translateZ(35px)" }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-slate-200 truncate">
                  {displayName}
                </span>
                <span className="text-[10px] text-emerald-400 flex items-center gap-1 shrink-0 font-medium">
                  <ShieldCheck className="w-3 h-3" />
                  <span>{isLogin ? "Sẵn sàng đăng nhập" : "Cấp quyền truy cập"}</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5">
                {displayEmail}
              </p>
            </div>

            {/* Bottom Bar: Access Key ID, Tier, and Shimmer Ribbon */}
            <div
              className="flex items-end justify-between relative z-10 border-t border-white/10 pt-2.5 motion-safe:transition-transform duration-200"
              style={{ transform: "translateZ(20px)" }}
            >
              <div>
                <span className="text-[10px] text-slate-400 block">
                  Mã định danh bảo mật
                </span>
                <span className="text-xs font-bold text-orange-400">
                  {cardId}
                </span>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-slate-400 block">
                  Hạng tài nguyên
                </span>
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>Kỹ sư Nền tảng</span>
                </span>
              </div>
            </div>
          </div>

          {/* ============================================================== */}
          {/* BACK FACE (Mặt sau thẻ)                                       */}
          {/* ============================================================== */}
          <div
            className="absolute inset-0 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-orange-500/20 text-white shadow-2xl flex flex-col justify-between overflow-hidden"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.7)",
            }}
          >
            {/* Magnetic Stripe */}
            <div className="w-full h-9 bg-slate-950 border-y border-white/5 mt-4" />

            {/* Signature & Security Seal */}
            <div className="px-5 space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-7 rounded bg-slate-800 border border-white/10 px-2 flex items-center justify-between text-xs text-slate-400 italic">
                  <span className="truncate">Chữ ký điện tử bảo mật</span>
                  <span className="text-white not-italic font-bold">256-SHA</span>
                </div>
                <div className="w-7 h-7 rounded-full bg-orange-500/20 border border-orange-500/40 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-orange-400" />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Thẻ định danh kỹ thuật số cấp quyền đọc sách, chạy visual lab và lưu trữ tiến độ cá nhân.
              </p>
            </div>

            {/* Bottom Meta */}
            <div className="px-5 pb-4 flex items-center justify-between text-[10px] text-slate-400 border-t border-white/10 pt-2">
              <span>Hệ thống AI Engine v2.0</span>
              <span className="text-orange-400 font-semibold">TLS 1.3 ENC</span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Controls & Hint Below Card */}
      <div className="flex items-center gap-3 mt-3.5">
        <button
          type="button"
          onClick={() => setIsFlipped(!isFlipped)}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700/80 text-xs text-slate-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <RefreshCw className="w-3 h-3 text-orange-400" />
          <span>{isFlipped ? "Xem mặt trước" : "Lật mặt sau"}</span>
        </button>
        <span className="text-xs text-slate-400">
          Rê chuột để cảm nhận chiều sâu 3D
        </span>
      </div>
    </div>
  );
}
