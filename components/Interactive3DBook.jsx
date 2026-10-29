"use client";

import React, { useState, useRef } from "react";
import { BookOpen, Sparkles, Layers, Cpu, Award } from "lucide-react";

/**
 * Photorealistic Interactive 3D Book Component
 * Built with pure hardware-accelerated CSS 3D transforms & dynamic lighting
 * Zero heavy WebGL bundle overhead, 60fps smooth on all devices
 */
export default function Interactive3DBook({
  title = "Designing Data-Intensive Applications",
  subtitle = "Hệ thống Phân tán Đáng tin cậy & Linh hoạt",
  author = "Martin Kleppmann",
  coverImage = null,
  badge = "ẤN BẢN ĐẶC BIỆT",
  coverGradient = "from-amber-600 via-orange-600 to-slate-900",
  spineColor = "#9a3412",
  size = "md", // "sm" | "md" | "lg"
  interactive = true,
  autoRotate = false,
  showFloatingBadges = true,
}) {
  const [rotate, setRotate] = useState({ x: 12, y: -24 });
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef(null);

  // Dimensions based on size
  const dimensions = {
    sm: { w: 160, h: 220, d: 28 },
    md: { w: 220, h: 300, d: 36 },
    lg: { w: 260, h: 360, d: 44 },
  }[size] || { w: 220, h: 300, d: 36 };

  function handleMouseMove(e) {
    if (!interactive || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;

    // Calculate rotation (-25 to 25 deg)
    const rotX = -(y / (rect.height / 2)) * 22;
    const rotY = (x / (rect.width / 2)) * 28;
    setRotate({ x: rotX, y: rotY });
  }

  function handleMouseLeave() {
    setIsHovered(false);
    setRotate({ x: 12, y: -24 });
  }

  function handleMouseEnter() {
    setIsHovered(true);
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative flex items-center justify-center select-none py-8"
      style={{ perspective: 1200 }}
    >
      {/* Dynamic Ambient Glow Behind Book */}
      <div
        className="absolute rounded-full blur-3xl pointer-events-none transition-transform duration-500 motion-safe:block"
        style={{
          width: dimensions.w * 1.5,
          height: dimensions.h * 1.3,
          background: "radial-gradient(circle, rgba(234, 88, 12, 0.28) 0%, rgba(217, 119, 6, 0.12) 50%, transparent 75%)",
          transform: `translate(${rotate.y * 1.5}px, ${rotate.x * 1.5}px)`,
        }}
      />

      {/* Floating 3D Pills / Orbital Badges */}
      {showFloatingBadges && (
        <>
          <div
            className="absolute z-30 pointer-events-none transition-transform duration-300 motion-safe:block"
            style={{
              top: "12%",
              right: "-18%",
              transform: `translate3d(${rotate.y * 0.8}px, ${-rotate.x * 0.8}px, 60px)`,
            }}
          >
            <div className="px-3 py-1.5 rounded-full bg-slate-900 border border-orange-500/40 text-orange-400 text-xs font-medium shadow-lg flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Mô hình 3D tương tác</span>
            </div>
          </div>

          <div
            className="absolute z-30 pointer-events-none transition-transform duration-300 motion-safe:block"
            style={{
              bottom: "16%",
              left: "-18%",
              transform: `translate3d(${-rotate.y * 0.6}px, ${rotate.x * 0.6}px, 50px)`,
            }}
          >
            <div className="px-3 py-1.5 rounded-full bg-slate-900 border border-emerald-500/40 text-emerald-400 text-xs font-medium shadow-lg flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-emerald-400" />
              <span>Bóc tách luận đề AI</span>
            </div>
          </div>
        </>
      )}

      {/* 3D Book Assembly */}
      <div
        className="relative transition-transform ease-out cursor-grab active:cursor-grabbing"
        style={{
          width: dimensions.w,
          height: dimensions.h,
          transformStyle: "preserve-3d",
          transform: `rotateX(${rotate.x}deg) rotateY(${rotate.y}deg) scale3d(${isHovered ? 1.05 : 1}, ${isHovered ? 1.05 : 1}, 1)`,
          transitionDuration: isHovered ? "80ms" : "600ms",
        }}
      >
        {/* 1. FRONT COVER */}
        <div
          className={`absolute inset-0 rounded-r-xl rounded-l-sm overflow-hidden shadow-2xl flex flex-col justify-between p-5 text-white ${
            coverImage ? "bg-slate-950" : `bg-gradient-to-br ${coverGradient}`
          }`}
          style={{
            transform: `translateZ(${dimensions.d / 2}px)`,
            backfaceVisibility: "hidden",
            boxShadow: `
              0 25px 50px -12px rgba(0, 0, 0, 0.7),
              inset 4px 0 10px rgba(0, 0, 0, 0.4),
              inset -2px 0 6px rgba(255, 255, 255, 0.2)
            `,
          }}
        >
          {coverImage ? (
            <img
              src={coverImage}
              alt={title}
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : null}

          {/* Spine crease shadow on front cover */}
          <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-black/50 via-black/20 to-transparent pointer-events-none" />

          {/* Badge accent */}
          <div className="relative z-10 flex items-center justify-between">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/20 border border-white/30 text-white">
              {badge}
            </span>
            <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-amber-300" />
            </div>
          </div>

          {/* Book Title & Typography */}
          <div className="relative z-10 space-y-2 mt-auto pb-4">
            <div className="w-8 h-1 rounded-full bg-amber-400" />
            <h3 className="text-lg sm:text-xl font-black leading-snug tracking-tight drop-shadow-md">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-white/85 line-clamp-2 leading-relaxed font-medium">
                {subtitle}
              </p>
            )}
          </div>

          {/* Book Author & Brand */}
          <div className="relative z-10 pt-3 border-t border-white/20 flex items-center justify-between text-xs">
            <span className="font-semibold text-amber-300">
              {author}
            </span>
            <span className="text-xs opacity-80">Breaking Books</span>
          </div>

          {/* Specular Shimmer on Tilt */}
          <div
            className="absolute inset-0 pointer-events-none opacity-40 transition-opacity"
            style={{
              background: `linear-gradient(${120 + rotate.y}deg, rgba(255,255,255,0.45) 0%, transparent 60%)`,
            }}
          />
        </div>

        {/* 2. BOOK SPINE (Left Side) */}
        <div
          className="absolute top-0 bottom-0 rounded-l-sm flex flex-col items-center justify-between py-6 px-1 text-white shadow-inner"
          style={{
            width: dimensions.d,
            left: 0,
            transform: `rotateY(-90deg) translateZ(${dimensions.d / 2}px)`,
            transformOrigin: "left center",
            backgroundColor: spineColor,
            backgroundImage: "linear-gradient(90deg, rgba(0,0,0,0.5) 0%, rgba(255,255,255,0.15) 30%, rgba(0,0,0,0.4) 100%)",
          }}
        >
          <span className="text-[10px] font-medium opacity-75 [writing-mode:vertical-rl] rotate-180">
            Phiên bản điện tử
          </span>
          <span className="text-xs font-semibold line-clamp-1 opacity-90 [writing-mode:vertical-rl] rotate-180">
            {title}
          </span>
          <div className="w-3 h-3 rounded-full bg-amber-400 shadow-sm" />
        </div>

        {/* 3. BOOK PAGES (Right Side Deckle Edge) */}
        <div
          className="absolute top-1 bottom-1 flex flex-col justify-around"
          style={{
            width: dimensions.d - 4,
            right: 0,
            transform: `rotateY(90deg) translateZ(${dimensions.w - dimensions.d / 2}px)`,
            transformOrigin: "right center",
            backgroundColor: "var(--book-paper)",
            backgroundImage: `repeating-linear-gradient(
              0deg,
              var(--book-paper-edge),
              var(--book-paper-edge) 2px,
              var(--book-paper-light) 2px,
              var(--book-paper-light) 4px
            )`,
            boxShadow: "inset 2px 0 6px rgba(0, 0, 0, 0.2)",
          }}
        />

        {/* 4. TOP PAGES EDGE */}
        <div
          className="absolute left-1 right-1"
          style={{
            height: dimensions.d - 4,
            top: 0,
            transform: `rotateX(90deg) translateZ(${dimensions.d / 2 - 2}px)`,
            transformOrigin: "center top",
            backgroundColor: "var(--book-paper)",
            backgroundImage: `repeating-linear-gradient(
              90deg,
              var(--book-paper-edge),
              var(--book-paper-edge) 2px,
              var(--book-paper-light) 2px,
              var(--book-paper-light) 4px
            )`,
            boxShadow: "inset 0 2px 4px rgba(0,0,0,0.2)",
          }}
        />

        {/* 5. BOTTOM PAGES EDGE */}
        <div
          className="absolute left-1 right-1"
          style={{
            height: dimensions.d - 4,
            bottom: 0,
            transform: `rotateX(-90deg) translateZ(${dimensions.h - dimensions.d / 2 - 2}px)`,
            transformOrigin: "center bottom",
            backgroundColor: "var(--book-paper-edge)",
            boxShadow: "inset 0 -2px 4px rgba(0,0,0,0.25)",
          }}
        />

        {/* 6. BACK COVER */}
        <div
          className="absolute inset-0 rounded-l-xl rounded-r-sm bg-slate-900 border border-slate-800 p-6 flex flex-col justify-between text-white"
          style={{
            transform: `translateZ(${-dimensions.d / 2}px) rotateY(180deg)`,
            backfaceVisibility: "hidden",
            boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
          }}
        >
          <div className="space-y-3">
            <span className="text-xs text-orange-400 font-semibold">
              Tổng quan tác phẩm
            </span>
            <p className="text-xs text-slate-300 leading-relaxed">
              Khám phá toàn diện kiến trúc phân tán, tính nhất quán dữ liệu và các đánh đổi kỹ thuật tối quan trọng.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>ISBN 978-1491903063</span>
            <span>Breaking Books</span>
          </div>
        </div>

        {/* Ground Drop Shadow */}
        <div
          className="absolute -bottom-10 left-4 right-4 h-8 rounded-full bg-black/40 blur-xl pointer-events-none transition-transform duration-300"
          style={{
            transform: `translate3d(${rotate.y * 1.2}px, 0, -40px) scale(${isHovered ? 1.15 : 1})`,
          }}
        />
      </div>
    </div>
  );
}
