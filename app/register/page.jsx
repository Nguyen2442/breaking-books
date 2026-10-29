"use client";

import React, { Suspense } from "react";
import AuthFlipCard from "@/components/AuthFlipCard";

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-orange-50/40 dark:bg-slate-950 flex items-center justify-center p-4 sm:p-6 lg:p-10 font-sans selection:bg-orange-500/20 selection:text-orange-700">
      <Suspense fallback={<div className="text-sm text-slate-500">Đang tải không gian 3D…</div>}>
        <AuthFlipCard initialMode="register" />
      </Suspense>
    </div>
  );
}
