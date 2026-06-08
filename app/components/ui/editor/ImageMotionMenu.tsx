"use client";

import { useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { useMotionContext } from "@/app/contexts/MotionContext";
import { SliderControl } from "../SliderControl";
import { getWallpaperUrl } from "@/lib/wallpaper.utils";

const PAD_H = 130;
const X_HALF = 500;
const Y_HALF = 500;
const HANDLE_R = 9;

function PositionPad({
  x, y, onChangeX, onChangeY, onDragStart, backgroundUrl, backgroundColorCss,
}: {
  x: number; y: number;
  onChangeX: (v: number) => void;
  onChangeY: (v: number) => void;
  onDragStart?: () => void;
  backgroundUrl?: string | null;
  backgroundColorCss?: string | null;
}) {
  const padRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [isDraggingState, setIsDraggingState] = useState(false);

  // Forzamos límites matemáticos para los valores de X e Y
  const cx = Math.max(-X_HALF, Math.min(X_HALF, x));
  const cy = Math.max(-Y_HALF, Math.min(Y_HALF, y));

  // Calculamos las posiciones en porcentaje para que responda al ancho fluido de CSS
  const pctX = (cx + X_HALF) / (X_HALF * 2);
  const hy = ((cy + Y_HALF) / (Y_HALF * 2)) * PAD_H;

  const fromEvent = (e: React.PointerEvent) => {
    if (!padRef.current) return;

    const rect = padRef.current.getBoundingClientRect();
    const currentWidth = rect.width;

    const rx = Math.max(0, Math.min(currentWidth, e.clientX - rect.left));
    const ry = Math.max(0, Math.min(PAD_H, e.clientY - rect.top));

    onChangeX(Math.round((rx / currentWidth) * X_HALF * 2 - X_HALF));
    onChangeY(Math.round((ry / PAD_H) * Y_HALF * 2 - Y_HALF));
  };

  // Build the background layer style: prefer the image URL, fall back to a CSS color/gradient
  const bgLayerStyle: React.CSSProperties = backgroundUrl
    ? {
      backgroundImage: `url('${backgroundUrl}')`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    }
    : backgroundColorCss
      ? (backgroundColorCss.startsWith("#") || backgroundColorCss.startsWith("rgb"))
        ? { backgroundColor: backgroundColorCss }
        : { backgroundImage: backgroundColorCss, backgroundSize: "cover", backgroundPosition: "center" }
      : {};

  return (
    <div className="relative group w-full cursor-default">
      <div
        ref={padRef}
        className={`relative w-full rounded-[14px] overflow-hidden select-none border shadow-[inset_0_2px_8px_rgba(0,0,0,0.8)] transition-all duration-200 ${isDraggingState
          ? "border-cyan-500/40 ring-1 ring-cyan-500/20"
          : "border-zinc-800/50"
          }`}
        style={{ height: PAD_H }}
        onPointerDown={(e) => {
          dragging.current = true;
          setIsDraggingState(true);
          (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
          onDragStart?.();
          fromEvent(e);
        }}
        onPointerMove={(e) => { if (dragging.current) fromEvent(e); }}
        onPointerUp={() => {
          dragging.current = false;
          setIsDraggingState(false);
        }}
      >
        {/* Background layer (canvas background) */}
        <div className="absolute inset-0 pointer-events-none" style={bgLayerStyle} />

        {/* Dark overlay so the grid/handles remain readable on bright backgrounds */}
        <div className="absolute inset-0 pointer-events-none bg-black/40" />

        {/* Active highlight ring while dragging */}
        {isDraggingState && (
          <div className="absolute inset-0 pointer-events-none rounded-[14px] ring-2 ring-cyan-400/30 animate-pulse" />
        )}

        {/* Grid */}
        <div className="absolute inset-0 pointer-events-none opacity-10 bg-[radial-gradient(#a1a1aa_1px,transparent_1px)] bg-size-[14px_14px]" />

        {/* Crosshairs */}
        <div className="absolute top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" style={{ left: '50%' }} />
        <div className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" style={{ top: '50%' }} />

        <div className="absolute pointer-events-none bg-white/5 transition-opacity" style={{ left: `calc(${pctX * 100}%)`, top: 0, bottom: 0, width: 1 }} />
        <div className="absolute pointer-events-none bg-white/5 transition-opacity" style={{ top: hy, left: 0, right: 0, height: 1 }} />

        <div
          className={`absolute bg-white border border-white/40 rounded-full shadow-[0_0_20px_4px_rgba(255,255,255,0.12),0_4px_12px_rgba(0,0,0,0.6)] mix-blend-screen flex items-center justify-center transition-all duration-75 pointer-events-auto ${isDraggingState ? "cursor-grabbing scale-125" : "cursor-grab"
            }`}
          style={{
            width: HANDLE_R * 3,
            height: HANDLE_R * 3,
            left: `calc(${pctX * 100}% - ${HANDLE_R}px)`,
            top: hy - HANDLE_R,
          }}
        >
        </div>
      </div>
    </div>
  );
}

// ─── Device template definition ───────────────────────────────────────────────
const IMAGE_DEVICE_TEMPLATES = [
  {
    id: "none",
    title: "None",
    accentColor: "#555",
    icon: "ph:prohibit",
  },
  {
    id: "iphone-13-pro-max",
    title: "iPhone 13 Pro",
    accentColor: "#7C7C85",
    icon: "simple-icons:apple",
    modelUrl: "/models/apple_iphone_13_pro_max.glb",
  },
  {
    id: "phone",
    title: "Phone",
    accentColor: "#00A3FF",
    icon: "ph:device-mobile-bold",
    modelUrl: "/models/phone-gltf.glb",
  },
  {
    id: "iphone",
    title: "iPhone 15 Pro",
    accentColor: "#A8A8B0",
    icon: "simple-icons:apple",
    modelUrl: "/models/iphone-15-pro-max.glb",
  },
  {
    id: "samsung",
    title: "Samsung S25",
    accentColor: "#1428A0",
    icon: "simple-icons:samsung",
    modelUrl: "/models/samsung-galaxy-s25-ultra.glb",
  },
  {
    id: "laptop",
    title: "macOS Laptop",
    accentColor: "#CECFD3",
    icon: "ph:laptop-bold",
    modelUrl: "/models/mac-book.glb",
  }
] as const;

type ImageDeviceId = typeof IMAGE_DEVICE_TEMPLATES[number]["id"];

// ─── ImageMotionMenu ──────────────────────────────────────────────────────────
export function ImageMotionMenu({
  backgroundUrl,
  backgroundColorCss,
  backgroundTab,
  selectedWallpaper,
  selectedImageUrl,
}: {
  backgroundUrl?: string | null;
  backgroundColorCss?: string | null;
  backgroundTab?: "wallpaper" | "image" | "color" | "unsplash";
  selectedWallpaper?: number;
  selectedImageUrl?: string;
}) {
  // Compute the current canvas background URL based on the active tab
  const resolvedBackgroundUrl = (() => {
    if (backgroundUrl) return backgroundUrl;
    if (backgroundTab === "image" && selectedImageUrl) return selectedImageUrl;
    if (backgroundTab === "wallpaper" && typeof selectedWallpaper === "number" && selectedWallpaper >= 0) {
      return getWallpaperUrl(selectedWallpaper);
    }
    return null;
  })();

  const {
    imagePhoneActive, setImagePhoneActive,
    imagePhoneX, setImagePhoneX,
    imagePhoneY, setImagePhoneY,
    imagePhoneScale, setImagePhoneScale,
    setImagePhoneRotX, setImagePhoneRotY,
    imagePhoneDevice, setImagePhoneDevice,
    imagePhoneOpening, setImagePhoneOpening,
    imagePhoneShadow, setImagePhoneShadow,
    imagePhoneShadowColor, setImagePhoneShadowColor,
    pushHistory,
  } = useMotionContext();

  const activeDeviceId: ImageDeviceId = imagePhoneActive ? imagePhoneDevice : "none";
  const isLaptop = imagePhoneActive && imagePhoneDevice === "laptop";

  const handleDeviceClick = (id: ImageDeviceId) => {
    if (id === "none") {
      setImagePhoneActive(false);
    } else {
      if (id !== imagePhoneDevice) {
        setImagePhoneDevice(id);
        setImagePhoneX(0);
        setImagePhoneY(0);
        setImagePhoneScale(0.8);
        // ← Inicializar rotación con los defaults correctos según el device
        if (id === "iphone-13-pro-max") {
          setImagePhoneRotX(-58.23);
          setImagePhoneRotY(-29.82);
        } else {
          setImagePhoneRotX(0);
          setImagePhoneRotY(0);
        }
        if (id === "laptop") {
          setImagePhoneOpening(1);
          setImagePhoneScale(1);
        }
      }
      setImagePhoneActive(true);
    }
  };

  const handleReset = () => {
    setImagePhoneX(0);
    setImagePhoneY(0);
    setImagePhoneScale(0.8);
    setImagePhoneRotX(0);
    setImagePhoneRotY(0);
    if (imagePhoneDevice === "laptop") {
      setImagePhoneOpening(1);
      setImagePhoneShadow(0.7);
    } else {
      setImagePhoneShadow(0.4);
    }
    setImagePhoneShadowColor("#000000");
  };

  return (
    <div className="p-4 flex flex-col gap-5 w-full bg-[#111113] min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-white font-medium">
          <Icon icon="mage:box-3d" width="20" aria-hidden="true" />
          <span>Motion</span>
        </div>
      </div>

      {/* Device template grid */}
      <div className="grid grid-cols-2 gap-3 items-start">
        {IMAGE_DEVICE_TEMPLATES.map((tpl) => {
          const isActive = activeDeviceId === tpl.id;
          const isNone = tpl.id === "none";
          return (
            <div key={tpl.id} className="relative">
              <button
                type="button"
                onClick={() => handleDeviceClick(tpl.id)}
                className={`group flex h-full w-full flex-col overflow-hidden rounded-2xl border text-left transition-all duration-300 active:scale-[0.98] ${isActive
                  ? "border-white/20 bg-[#1a1a1e]"
                  : "border-white/6 bg-[#17171a] hover:border-white/20"
                  }`}
              >
                <div className="relative aspect-video w-full shrink-0 bg-[#0d0d10]">
                  <div
                    className="absolute inset-0"
                    style={{
                      background: isActive
                        ? `linear-gradient(135deg, ${tpl.accentColor}22 0%, transparent 70%)`
                        : `linear-gradient(135deg, ${tpl.accentColor}10 0%, transparent 70%)`,
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Icon
                      icon={tpl.icon}
                      width="20"
                      style={{ color: isActive ? `${tpl.accentColor}cc` : `${tpl.accentColor}55` }}
                    />
                  </div>
                  {isActive && !isNone && (
                    <div
                      className="absolute top-1.5 right-1.5 size-4 rounded-full flex items-center justify-center"
                      style={{ background: tpl.accentColor }}
                    >
                      <Icon icon="mdi:check-bold" width={9} className="text-white" />
                    </div>
                  )}
                </div>
                <div className="border-t border-white/5 bg-[#111113] px-3 py-2.5 flex items-center justify-between">
                  <h3 className={`truncate text-xs font-semibold ${isActive ? "text-white" : "text-white/60"}`}>
                    {tpl.title}
                  </h3>
                </div>
              </button>

              {isActive && (
                <div
                  className="pointer-events-none absolute inset-0 rounded-2xl"
                  style={{
                    boxShadow: `0 0 0 1.5px ${tpl.accentColor}88`,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Config panel — shown when phone is active */}
      {imagePhoneActive && (
        <div className="flex flex-col gap-4 pt-2 border-t border-white/6">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Configuración</span>
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1 text-[11px] text-white/40 hover:text-white/80 transition-colors"
            >
              <Icon icon="lucide:rotate-ccw" width="11" />
              Resetear
            </button>
          </div>

          <SliderControl
            label="Escala"
            value={Math.round(imagePhoneScale * 100)}
            min={30}
            max={300}
            step={1}
            onChange={(v) => { pushHistory(); setImagePhoneScale(v / 100); }}
            suffix="%"
          />

          {isLaptop && (
            <SliderControl
              icon="material-symbols:laptop-chromebook-outline"
              label="Apertura de laptop"
              value={Math.round(imagePhoneOpening * 100)}
              min={0}
              max={100}
              step={1}
              onChange={(v) => { pushHistory(); setImagePhoneOpening(v / 100); }}
              suffix="%"
            />
          )}

          <SliderControl
            icon="mdi:blur"
            label="Sombra"
            value={Math.round(imagePhoneShadow * 100)}
            min={0}
            max={100}
            step={1}
            onChange={(v) => { pushHistory(); setImagePhoneShadow(v / 100); }}
            suffix="%"
          />

          <div className="flex flex-col gap-2">
            <span className="text-xs text-white/60 font-medium">Posición</span>
            <PositionPad
              x={imagePhoneX}
              y={imagePhoneY}
              onChangeX={setImagePhoneX}
              onChangeY={setImagePhoneY}
              onDragStart={pushHistory}
              backgroundUrl={resolvedBackgroundUrl}
              backgroundColorCss={backgroundColorCss}
            />
          </div>
        </div>
      )}
    </div>
  );
}
