"use client";

import { Icon } from "@iconify/react";

export function MotionMenu() {

  return (
    <div className="p-4 flex flex-col gap-5 w-full bg-[#111113] min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-white/90 font-semibold text-sm tracking-wide">
          <Icon icon="ph:film-strip-bold" width="16" className="text-blue-400" />
          <span>Motion</span>
        </div>
        <span className="text-[9px] uppercase tracking-widest text-white/25 font-bold bg-white/5 px-2 py-0.5 rounded-full border border-white/[0.06]">
          Animaciones
        </span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-4 items-start">
       
      </div>
    </div>
  );
}