"use client";

import React, { useState } from "react";
import { Brain, Sparkles, Layers, Cpu, Atom, BookOpen } from "lucide-react";

/**
 * Interactive 3D Holographic Knowledge Engine
 * Renders nested orbiting 3D rings with interactive perspective tilt
 */
export default function Interactive3DHologram({
  title = "Trí tuệ Nhân tạo Đột phá",
  subtitle = "Mô hình Hóa Tri thức Đa chiều",
  icon = "brain", // "brain" | "atom" | "cpu" | "book"
  size = 280,
}) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  function handleMouseMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    setTilt({
      x: -(y / (rect.height / 2)) * 25,
      y: (x / (rect.width / 2)) * 30,
    });
  }

  function handleMouseLeave() {
    setTilt({ x: 0, y: 0 });
  }

  const CenterIcon = {
    brain: Brain,
    atom: Atom,
    cpu: Cpu,
    book: BookOpen,
  }[icon] || Brain;

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative flex items-center justify-center p-8 select-none"
      style={{ perspective: 1000 }}
    >
      {/* Outer ambient glow */}
      <div
        className="absolute rounded-full blur-3xl pointer-events-none transition-transform duration-300 motion-safe:block"
        style={{
          width: size * 1.2,
          height: size * 1.2,
          background: "radial-gradient(circle, rgba(249, 115, 22, 0.25) 0%, rgba(168, 85, 247, 0.15) 50%, transparent 75%)",
          transform: `translate(${tilt.y}px, ${tilt.x}px)`,
        }}
      />

      {/* 3D Ring System */}
      <div
        className="relative transition-transform duration-200 ease-out flex items-center justify-center"
        style={{
          width: size,
          height: size,
          transformStyle: "preserve-3d",
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        }}
      >
        {/* Ring 1 - Horizontal Orbit */}
        <div
          className="absolute inset-0 rounded-full border-2 border-orange-500/40 pointer-events-none animate-[spin_18s_linear_infinite]"
          style={{
            transform: "rotateX(75deg)",
            boxShadow: "0 0 20px rgba(249, 115, 22, 0.2)",
          }}
        >
          <div className="w-3 h-3 rounded-full bg-orange-400 absolute -top-1.5 left-1/2 -translate-x-1/2 shadow-lg shadow-orange-500/80" />
        </div>

        {/* Ring 2 - Diagonal Orbit */}
        <div
          className="absolute inset-4 rounded-full border-2 border-amber-400/30 pointer-events-none animate-[spin_24s_linear_infinite_reverse]"
          style={{
            transform: "rotateY(65deg) rotateX(45deg)",
            boxShadow: "0 0 15px rgba(251, 191, 36, 0.2)",
          }}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-amber-300 absolute -bottom-1.5 left-1/3 shadow-lg shadow-amber-400/80" />
        </div>

        {/* Ring 3 - Vertical Orbit */}
        <div
          className="absolute inset-8 rounded-full border border-violet-500/30 pointer-events-none animate-[spin_14s_linear_infinite]"
          style={{
            transform: "rotateY(90deg)",
            boxShadow: "0 0 15px rgba(139, 92, 246, 0.2)",
          }}
        >
          <div className="w-2 h-2 rounded-full bg-violet-400 absolute top-1/4 -right-1 shadow-md shadow-violet-500/80" />
        </div>

        {/* Center Glowing Core */}
        <div
          className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-orange-600 via-amber-500 to-violet-600 p-0.5 shadow-2xl flex items-center justify-center text-white transition-transform duration-300"
          style={{
            transform: "translateZ(40px)",
            boxShadow: "0 10px 30px -5px rgba(249, 115, 22, 0.5), inset 0 2px 10px rgba(255, 255, 255, 0.5)",
          }}
        >
          <div className="w-full h-full rounded-[22px] bg-slate-950/80 backdrop-blur-md flex items-center justify-center">
            <CenterIcon className="w-10 h-10 text-orange-400 animate-pulse" />
          </div>
        </div>

        {/* Floating 3D Micro-Chips */}
        <div
          className="absolute -top-2 right-4 px-2.5 py-1 rounded-full bg-slate-900 border border-orange-500/40 text-xs text-orange-300 font-medium shadow-lg"
          style={{ transform: "translateZ(65px)" }}
        >
          4 trụ cột biện chứng
        </div>

        <div
          className="absolute -bottom-2 left-2 px-2.5 py-1 rounded-full bg-slate-900 border border-violet-500/40 text-xs text-violet-300 font-medium shadow-lg"
          style={{ transform: "translateZ(55px)" }}
        >
          Visual lab tương tác
        </div>
      </div>
    </div>
  );
}
