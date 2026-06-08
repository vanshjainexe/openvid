"use client";

import { Icon } from "@iconify/react";
import { useMotionContext } from "@/app/contexts/MotionContext";
import { useState, useEffect } from "react";
import type { EditorPanelProps, MotionTemplate, AnimMode } from "@/types/motion.types";
import { CAMERA_VARIANTS, DEFAULT_VARIANT_ID, EASING_OPTIONS, phoneScript } from "@/lib/motion.utils";

function EasingPicker() {
  const { motionStyle, setMotionStyle } = useMotionContext();
  return (
    <div className="flex gap-1.5">
      {EASING_OPTIONS.map((opt) => {
        const active = motionStyle === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => setMotionStyle(opt.id)}
            className={`flex flex-col items-center gap-0 p-0 rounded-lg transition-colors flex-1 ${
              active ? "ring-1 ring-blue-500/60" : "hover:bg-white/[0.04]"
            }`}
          >
            <svg
              viewBox="0 -12 48 72"
              className={`w-full aspect-square rounded-t-lg ${active ? "bg-blue-500/10" : "bg-white/[0.04]"}`}
            >
              <line x1="0" y1="48" x2="48" y2="0" stroke="currentColor" opacity="0.08" strokeWidth="1" />
              <path
                d={opt.path} fill="none"
                stroke={active ? "#60a5fa" : "currentColor"}
                strokeWidth="2" strokeLinecap="round"
                opacity={active ? 1 : 0.35}
              />
            </svg>
            <span className={`text-[9px] font-medium truncate w-full text-center py-1 ${active ? "text-blue-300" : "text-white/30"}`}>
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Camera variant picker ────────────────────────────────────────────────────
function VariantPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {CAMERA_VARIANTS.map((v) => {
        const active = value === v.id;
        return (
          <button
            key={v.id}
            type="button"
            title={v.description}
            onClick={() => onChange(v.id)}
            className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border transition-all duration-150 text-left ${
              active
                ? "border-blue-500/60 bg-blue-500/10 text-blue-300"
                : "border-white/[0.08] text-white/35 hover:border-white/20 hover:text-white/60 bg-white/[0.02]"
            }`}
          >
            <Icon icon={v.icon} width="13" className="shrink-0" />
            <span className="text-[10px] font-medium truncate">{v.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────
function SectionHeader({ label }: { label: string }) {
  return (
    <div className="text-[9px] uppercase tracking-[0.2em] text-white/25 font-bold px-0.5">
      {label}
    </div>
  );
}

function SliderRow({
  icon, label, value, min, max, step = 1, suffix = "", onChange,
}: {
  icon: string; label: string; value: number;
  min: number; max: number; step?: number; suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5 w-20 shrink-0">
        <Icon icon={icon} width="13" className="text-white/30 shrink-0" />
        <span className="text-[10px] text-white/50 truncate">{label}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-1 appearance-none bg-white/10 rounded-full outline-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-white/30"
      />
      <span className="text-[10px] font-mono text-white/40 w-6 text-right shrink-0">
        {value}{suffix}
      </span>
    </div>
  );
}

// ─── Editor panel ─────────────────────────────────────────────────────────────
export function PhoneEditorPanel({ template }: EditorPanelProps) {
  const {
    motionDuration, setMotionDuration,
    motionIntensity, setMotionIntensity,
    motionVariantId, setMotionVariantId,
    motionAnimMode, setMotionAnimMode,
    setMotionImageUrl,
  } = useMotionContext();

  const [imageUrl, setImageUrl]   = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    setMotionImageUrl(imageUrl);
  }, [imageUrl]);

  const readImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => setImageUrl(e.target?.result as string ?? null);
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">

      {/* Image upload */}
      <div className="space-y-2">
        <SectionHeader label="Imagen en pantalla" />
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault(); setIsDragging(false);
            const file = e.dataTransfer.files[0];
            if (file?.type.startsWith("image/")) readImageFile(file);
          }}
          className={`relative rounded-xl border-2 border-dashed transition-all duration-200 overflow-hidden ${
            isDragging ? "border-blue-500/60 bg-blue-500/5" : "border-white/[0.1] hover:border-white/20 bg-[#0d0d10]"
          }`}
        >
          {imageUrl ? (
            <div className="relative aspect-video">
              <img src={imageUrl} alt="Source" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <label className="flex items-center gap-1.5 text-[10px] font-medium text-white bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-1.5 rounded-lg cursor-pointer transition-colors">
                  <Icon icon="ph:swap-bold" width="11" />
                  Cambiar
                  <input type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) readImageFile(f); }} />
                </label>
                <button
                  onClick={() => setImageUrl(null)}
                  className="flex items-center gap-1.5 text-[10px] font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Icon icon="ph:trash-bold" width="11" />
                  Quitar
                </button>
              </div>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-3 py-8 cursor-pointer">
              <div className="size-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                <Icon icon="ph:image-square-bold" width="16" className="text-white/30" />
              </div>
              <div className="text-center">
                <p className="text-[10px] text-white/50 font-medium">Suelta una imagen o haz clic</p>
                <p className="text-[9px] text-white/20 mt-0.5">PNG, JPG, WebP — máx 10 MB</p>
              </div>
              <input type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) readImageFile(f); }} />
            </label>
          )}
        </div>
        <p className="text-[9px] text-white/20 leading-relaxed">
          Sin imagen se muestra el video del canvas en la pantalla del teléfono.
        </p>
      </div>

      {/* Camera path */}
      <div className="space-y-2.5 border-t border-white/[0.05] pt-3">
        <SectionHeader label="Recorrido de cámara" />
        <VariantPicker
          value={motionVariantId ?? DEFAULT_VARIANT_ID}
          onChange={setMotionVariantId}
        />
        <p className="text-[9px] text-white/20 leading-relaxed pt-0.5">
          {CAMERA_VARIANTS.find((v) => v.id === (motionVariantId ?? DEFAULT_VARIANT_ID))?.description ?? ""}
        </p>
      </div>

      {/* Animation mode */}
      <div className="space-y-2 border-t border-white/[0.05] pt-3">
        <SectionHeader label="Animación" />
        <div className="grid grid-cols-4 gap-1">
          {(["entry", "exit", "entry+exit", "none"] as AnimMode[]).map((m) => {
            const labels: Record<AnimMode, string> = { "entry": "Entrada", "exit": "Salida", "entry+exit": "Ambas", "none": "Ninguna", "static": "Estática" };
            const icons: Record<AnimMode, string> = { "entry": "ph:arrow-line-down-bold", "exit": "ph:arrow-line-up-bold", "entry+exit": "ph:arrows-vertical-bold", "none": "ph:minus-bold", "static": "ph:pause-bold" };
            const active = motionAnimMode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMotionAnimMode(m)}
                title={labels[m]}
                className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl border transition-all duration-150 ${
                  active
                    ? "border-blue-500/60 bg-blue-500/10 text-blue-300"
                    : "border-white/[0.08] text-white/35 hover:border-white/20 hover:text-white/60 bg-white/[0.02]"
                }`}
              >
                <Icon icon={icons[m]} width="13" className="shrink-0" />
                <span className="text-[9px] font-medium truncate w-full text-center leading-tight">{labels[m]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Motion controls */}
      <div className="space-y-3 border-t border-white/[0.05] pt-3">
        <SectionHeader label="Movimiento" />
        <SliderRow
          icon="ph:waves-bold" label="Intensidad"
          value={motionIntensity} min={0} max={100} suffix="%"
          onChange={setMotionIntensity}
        />
        <SliderRow
          icon="ph:timer-bold" label="Duración"
          value={motionDuration / 1000} min={1} max={16} step={0.5} suffix="s"
          onChange={(v) => setMotionDuration(v * 1000)}
        />
      </div>

      {/* Easing style */}
      <div className="space-y-2 border-t border-white/[0.05] pt-3">
        <SectionHeader label="Estilo de curva" />
        <EasingPicker />
      </div>

    </div>
  );
}

// ─── Template definition ──────────────────────────────────────────────────────
export const phoneTemplate: MotionTemplate = {
  id:              "phone",
  title:           "Phone",
  description:     "Recorridos cinemáticos de cámara en 3D",
  accentColor:     "#22d3ee",
  icon:            "ph:film-strip-bold",
  tags:            ["UI", "Editor"],
  defaultDuration: 4000,
  showPhone:       true,
  script:          phoneScript,
  EditorPanel:     PhoneEditorPanel,
};