"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@iconify/react";
import { SliderControl } from "../SliderControl";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MOCKUPS, MOCKUP_CATEGORIES } from "@/lib/mockup-data";
import { IMAGE_DEVICE_TEMPLATES, ImageDeviceId, MenuPage, MockupCategory, MockupConfig, MockupFeatures } from "@/types/mockup.types";
import { FRAME_COLORS, FRAME_COLORS_DARK, getMockupFeatures, HANDLE_R, PAD_H, X_HALF, Y_HALF } from "@/types/mockup.types";
import { MockupGridSkeleton } from "../Skeleton";
import { Button } from "@/components/ui/button";
import { useMockup3dContext } from "@/app/contexts/Mockup3dContext";
import { getWallpaperUrl } from "@/lib/wallpaper.utils";
import { DetailPageHeader } from "@/components/ui/DetailHeaderMenu";

function PositionPad({
  x,
  y,
  onChangeX,
  onChangeY,
  onDragStart,
  backgroundUrl,
  backgroundColorCss,
}: {
  x: number;
  y: number;
  onChangeX: (v: number) => void;
  onChangeY: (v: number) => void;
  onDragStart?: () => void;
  backgroundUrl?: string | null;
  backgroundColorCss?: string | null;
}) {
  const padRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [isDraggingState, setIsDraggingState] = useState(false);

  const cx = Math.max(-X_HALF, Math.min(X_HALF, x));
  const cy = Math.max(-Y_HALF, Math.min(Y_HALF, y));
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

  const bgLayerStyle: React.CSSProperties = backgroundUrl
    ? {
      backgroundImage: `url('${backgroundUrl}')`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    }
    : backgroundColorCss
      ? backgroundColorCss.startsWith("#") || backgroundColorCss.startsWith("rgb")
        ? { backgroundColor: backgroundColorCss }
        : {
          backgroundImage: backgroundColorCss,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }
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
        <div className="absolute inset-0 pointer-events-none" style={bgLayerStyle} />
        <div className="absolute inset-0 pointer-events-none bg-black/40" />
        {isDraggingState && (
          <div className="absolute inset-0 pointer-events-none rounded-[14px] ring-2 ring-cyan-400/30 animate-pulse" />
        )}
        <div className="absolute inset-0 pointer-events-none opacity-10 bg-[radial-gradient(#a1a1aa_1px,transparent_1px)] bg-size-[14px_14px]" />
        <div className="absolute top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" style={{ left: "50%" }} />
        <div className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" style={{ top: "50%" }} />
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
        />
      </div>
    </div>
  );
}

function DeviceCard({
  tpl,
  isActive,
  onClick,
}: {
  tpl: (typeof IMAGE_DEVICE_TEMPLATES)[number];
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <div className="relative w-40 shrink-0 snap-start mt-0.5">
      <button
        type="button"
        onClick={onClick}
        className={`group flex h-full w-full flex-col overflow-hidden rounded-2xl border text-left transition-all duration-300 active:scale-[0.98] ${isActive
          ? "border-white/20 bg-[#1a1a1e]"
          : "border-white/6 bg-[#17171a] hover:border-white/20"
          }`}
      >
        <div className="relative aspect-3/4 w-full shrink-0 bg-[#0d0d10]">
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
              width="22"
              style={{
                color: isActive ? `${tpl.accentColor}cc` : `${tpl.accentColor}55`,
              }}
            />
          </div>

          {isActive && (
            <div
              className="absolute top-1.5 right-1.5 size-4 rounded-full flex items-center justify-center"
              style={{ background: tpl.accentColor }}
            >
              <Icon icon="mdi:check-bold" width={9} className="text-white" />
            </div>
          )}
        </div>

        <div className="border-t border-white/5 bg-[#111113] px-3 py-2.5">
          <h3
            className={`truncate text-xs font-semibold ${isActive ? "text-white" : "text-white/60"
              }`}
          >
            {tpl.title}
          </h3>
        </div>
      </button>

      {isActive && (
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl"
          style={{ boxShadow: `0 0 0 1.5px ${tpl.accentColor}88` }}
        />
      )}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface MockupMenuProps {
  mockupId?: string;
  mockupConfig?: MockupConfig;
  onMockupChange?: (mockupId: string) => void;
  onMockupConfigChange?: (config: Partial<MockupConfig>) => void;
  // Background props forwarded from parent (needed for PositionPad)
  backgroundUrl?: string | null;
  backgroundColorCss?: string | null;
  backgroundTab?: "wallpaper" | "image" | "color" | "unsplash";
  selectedWallpaper?: number;
  selectedImageUrl?: string;
}

// ─── MockupMenu ───────────────────────────────────────────────────────────────

export function MockupMenu({
  mockupId = "none",
  mockupConfig,
  onMockupChange,
  onMockupConfigChange,
  backgroundUrl,
  backgroundColorCss,
  backgroundTab,
  selectedWallpaper,
  selectedImageUrl,
}: MockupMenuProps) {
  const t = useTranslations("mockupMenu");

  // ── Navigation state ──
  const [page, setPage] = useState<MenuPage>("home");

  // ── 2D popover state ──
  const [selectedCategory, setSelectedCategory] = useState<MockupCategory>("all");
  const [gridLoaded, setGridLoaded] = useState(false);
  const devicesScrollRef = useRef<HTMLDivElement>(null);
  const [isDevicesHover, setIsDevicesHover] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateDevicesScrollState = useCallback(() => {
    const el = devicesScrollRef.current;
    if (!el) return;

    const maxScrollLeft = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 8);
    setCanScrollRight(el.scrollLeft < maxScrollLeft - 8);
  }, []);

  const devicesScrollLeftRef = useRef(0);

  const handleDevicesScroll = useCallback(() => {
    const el = devicesScrollRef.current;
    if (!el) return;

    devicesScrollLeftRef.current = el.scrollLeft;
    updateDevicesScrollState();
  }, [updateDevicesScrollState]);

  const restoreDevicesScroll = useCallback(() => {
    const el = devicesScrollRef.current;
    if (!el) return;

    el.scrollLeft = devicesScrollLeftRef.current;
    updateDevicesScrollState();
  }, [updateDevicesScrollState]);

  const scrollDevices = useCallback((direction: "left" | "right") => {
    const el = devicesScrollRef.current;
    if (!el) return;

    const amount = Math.max(220, Math.round(el.clientWidth * 0.78));
    el.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  }, []);

  useEffect(() => {
    if (page !== "home") return;

    const id = requestAnimationFrame(() => {
      restoreDevicesScroll();
    });

    const el = devicesScrollRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;

      // Si ya es scroll horizontal, lo dejamos pasar
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };

    const onScroll = () => updateDevicesScrollState();

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateDevicesScrollState);

    // estado inicial correcto al volver a home
    updateDevicesScrollState();

    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", updateDevicesScrollState);
    };

    return () => cancelAnimationFrame(id);
  }, [page, restoreDevicesScroll, updateDevicesScrollState]);

  // ── 3D context ──
  const {
    imagePhoneActive,
    setImagePhoneActive,
    imagePhoneX,
    setImagePhoneX,
    imagePhoneY,
    setImagePhoneY,
    imagePhoneScale,
    setImagePhoneScale,
    setImagePhoneRotX,
    setImagePhoneRotY,
    imagePhoneDevice,
    setImagePhoneDevice,
    imagePhoneOpening,
    setImagePhoneOpening,
    imagePhoneShadow,
    setImagePhoneShadow,
    setImagePhoneShadowColor,
    pushHistory,
  } = useMockup3dContext();

  // ── Derived ──
  const filteredMockups =
    selectedCategory === "all"
      ? MOCKUPS
      : MOCKUPS.filter((m) => m.category === selectedCategory);

  const currentMockup = MOCKUPS.find((m) => m.id === mockupId);
  const features: MockupFeatures = getMockupFeatures(currentMockup);

  const activeDeviceId: ImageDeviceId | null = imagePhoneActive
    ? (imagePhoneDevice as ImageDeviceId)
    : null;
  const activeDeviceTpl = IMAGE_DEVICE_TEMPLATES.find((t) => t.id === activeDeviceId) ?? null;
  const isLaptop = imagePhoneActive && imagePhoneDevice === "laptop";

  const resolvedBackgroundUrl = (() => {
    if (backgroundUrl) return backgroundUrl;
    if (backgroundTab === "image" && selectedImageUrl) return selectedImageUrl;
    if (
      backgroundTab === "wallpaper" &&
      typeof selectedWallpaper === "number" &&
      selectedWallpaper >= 0
    ) {
      return getWallpaperUrl(selectedWallpaper);
    }
    return null;
  })();

  const hasActiveFrame = mockupId !== "none" || imagePhoneActive;

  // ── Handlers: 2D ──

  const handleMockupSelect = (id: string) => {
    onMockupChange?.(id);
    if (imagePhoneActive) setImagePhoneActive(false);
    if (id !== "none") setPage("detail-2d");
  };

  const handleCategoryChange = (cat: MockupCategory) => {
    setSelectedCategory(cat);
    setGridLoaded(false);
    setTimeout(() => setGridLoaded(true), 250);
  };

  const handleDarkModeChange = (isDark: boolean) => {
    const currentFrameColor = (mockupConfig?.frameColor || "#f6f6f6").toLowerCase();
    const isCurrentColorDark = FRAME_COLORS_DARK.includes(currentFrameColor);
    let newFrameColor = currentFrameColor;
    if (isDark && !isCurrentColorDark) newFrameColor = "#1e1e1e";
    else if (!isDark && isCurrentColorDark) newFrameColor = "#f6f6f6";
    onMockupConfigChange?.({ darkMode: isDark, frameColor: newFrameColor });
  };

  const handleFrameColorChange = (color: string) =>
    onMockupConfigChange?.({ frameColor: color.toLowerCase() });

  const handleUrlChange = (url: string) => onMockupConfigChange?.({ url });
  const handleHeaderScaleChange = (headerScale: number) => onMockupConfigChange?.({ headerScale });
  const handleHeaderOpacityChange = (headerOpacity: number) => onMockupConfigChange?.({ headerOpacity });

  // ── Handlers: 3D ──

  const handleDeviceClick = (id: ImageDeviceId) => {
    if (id !== imagePhoneDevice) {
      setImagePhoneDevice(id);
      setImagePhoneX(0);
      setImagePhoneY(0);
      setImagePhoneScale(0.8);
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
        setImagePhoneRotX(43.23);
        setImagePhoneRotY(-37.82);
      }
    }
    setImagePhoneActive(true);
    if (mockupId !== "none") onMockupChange?.("none");
    setPage("detail-3d");
  };

  const handle3DReset = () => {
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

  // ── Handlers: shared ──

  const handleRemoveAll = () => {
    onMockupChange?.("none");
    setImagePhoneActive(false);
    setPage("home");
  };

  // ─────────────────────────────────────────────────────────────────────────
  // PAGE: HOME
  // ─────────────────────────────────────────────────────────────────────────

  if (page === "home") {
    return (
      <div className="p-4 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center gap-2 text-white font-medium">
          <Icon icon="hugeicons:ai-browser" width="20" aria-hidden="true" />
          <span>{t("title")}</span>
        </div>

        {/* ── 2D Section ── */}
        <div className="flex flex-col gap-3">
          <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold">
            Marcos 2D
          </p>

          {/* 2D selector trigger */}
          <Popover
            onOpenChange={(open) => {
              if (open && !gridLoaded) {
                setTimeout(() => setGridLoaded(true), 300);
              }
            }}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                className={`group relative flex items-center gap-3 p-2 squircle-element border transition-all w-full h-35 ${mockupId !== "none"
                  ? "bg-blue-500/10 border-blue-500/40 text-blue-300"
                  : "bg-white/[0.03] border-white/[0.07] text-white/40 hover:border-white/20"
                  }`}
                aria-label={t("windowType")}
                aria-haspopup="dialog"
              >
                <div className="flex-1 flex flex-col gap-2 h-full justify-center overflow-hidden">
                  <div className="w-full squircle-element overflow-hidden bg-neutral-900 relative h-full">
                    {(() => {
                      const categoryConfig = MOCKUP_CATEGORIES.find(
                        (c) => c.id === currentMockup?.category
                      );
                      const bgUrl =
                        categoryConfig?.bgUrl ||
                        "https://i.ibb.co/r2JQ3Gcy/minimal-02.jpg";
                      return (
                        <div
                          className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-500 group-hover:scale-110"
                          style={{ backgroundImage: `url('${bgUrl}')` }}
                        />
                      );
                    })()}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none scale-95">
                      {currentMockup?.preview}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold tracking-wider">
                      {currentMockup?.name || t("none")}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-center px-2 border-l border-white/5 h-full group-hover:text-white transition-colors">
                  <Icon icon="uil:sort" aria-hidden="true" />
                </div>
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="right"
              align="start"
              sideOffset={12}
              className="w-125 p-0 border-0 shadow-2xl"
            >
              <div className="flex flex-col bg-[#111113] border border-white/10 rounded-xl overflow-hidden shadow-2xl max-h-150">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/2 flex-wrap">
                  {MOCKUP_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => handleCategoryChange(cat.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium uppercase tracking-wider transition-all ${selectedCategory === cat.id
                        ? "bg-blue-500/20 text-blue-400 border border-blue-500/40"
                        : "bg-white/5 text-white/50 hover:text-white/70 border border-transparent hover:border-white/10"
                        }`}
                    >
                      <Icon icon={cat.icon} width="12" />
                      <span>{cat.label}</span>
                    </button>
                  ))}
                  <span className="ml-auto text-[10px] text-white/60">
                    {t("count", { count: filteredMockups.length })}
                  </span>
                </div>
                <div className="relative overflow-y-auto custom-scrollbar overflow-x-hidden min-h-62.5">
                  <div
                    className={`absolute inset-0 w-full transition-all duration-300 ease-out z-10 ${gridLoaded
                      ? "opacity-0 blur-md pointer-events-none scale-105"
                      : "opacity-100 blur-0 scale-100"
                      }`}
                  >
                    <MockupGridSkeleton />
                  </div>
                  <div
                    className={`p-3 grid grid-cols-3 gap-2 transition-all duration-300 ease-out ${!gridLoaded
                      ? "opacity-0 scale-95 pointer-events-none"
                      : "opacity-100 scale-100"
                      }`}
                  >
                    {filteredMockups.map((mockup) => {
                      const categoryConfig = MOCKUP_CATEGORIES.find(
                        (c) => c.id === mockup.category
                      );
                      const isActive = mockupId === mockup.id;
                      return (
                        <button
                          key={mockup.id}
                          onClick={() => handleMockupSelect(mockup.id)}
                          className={`group relative w-full h-28 squircle-element border-2 overflow-hidden shadow-lg transition-all active:scale-95 ${isActive
                            ? "border-blue-500 ring-2 ring-blue-500/50"
                            : "border-neutral-800 hover:border-white/20"
                            }`}
                        >
                          <div
                            className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-500 group-hover:scale-105"
                            style={{
                              backgroundImage: `url('${categoryConfig?.bgUrl ||
                                "https://i.ibb.co/r2JQ3Gcy/minimal-02.jpg"
                                }')`,
                            }}
                          >
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              {mockup.preview}
                            </div>
                          </div>
                          <div className="absolute inset-0 group-hover:bg-black/5 transition-colors pointer-events-none" />
                          <div className="absolute bottom-0 left-0 bg-black/60 border-t border-r border-white/10 px-2 py-1 text-[9px] text-white/80 font-bold tracking-tighter rounded-tr-md rounded-bl-lg z-30">
                            {mockup.name}
                          </div>
                          {isActive && (
                            <div className="absolute top-2 right-2 rounded-full shadow-[0_0_10px_rgba(96,165,250,0.8)] z-30">
                              <Icon
                                icon="icon-park-solid:check-one"
                                width="20"
                                className="text-blue-500"
                              />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              {[
                "glass-ui-container",
                "macos",
                "macos-glass",
                "brave",
                "macos-dark-ide",
                "glass-curve",
              ].map((id) => {
                const mockup = MOCKUPS.find((m) => m.id === id);
                if (!mockup) return null;
                const categoryConfig = MOCKUP_CATEGORIES.find(
                  (c) => c.id === mockup.category
                );
                const isActive = mockupId === mockup.id;
                return (
                  <button
                    key={id}
                    onClick={() => handleMockupSelect(id)}
                    className={`group relative w-full h-20 squircle-element border overflow-hidden transition-all active:scale-95 ${isActive
                      ? "border-blue-500/60 ring-1 ring-blue-500/30"
                      : "border-white/[0.07] hover:border-white/20"
                      }`}
                  >
                    <div
                      className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                      style={{ backgroundImage: `url('${categoryConfig?.bgUrl || ""}')` }}
                    >
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none scale-90">
                        {mockup.preview}
                      </div>
                    </div>
                    <div className="absolute bottom-0 left-0 bg-black/60 border-t border-r border-white/10 px-2 py-0.5 text-[8px] text-white/80 font-bold tracking-tighter rounded-tr-md rounded-bl-lg z-30">
                      {mockup.name}
                    </div>
                    {isActive && (
                      <div className="absolute top-1.5 right-1.5 rounded-full shadow-[0_0_8px_rgba(96,165,250,0.7)] z-30">
                        <Icon icon="icon-park-solid:check-one" width="14" className="text-blue-500" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-white/[0.06]" />

        <div className="flex flex-col gap-3">
          <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold">
            Dispositivos 3D
          </p>

          <div
            className="relative group"
            onMouseEnter={() => setIsDevicesHover(true)}
            onMouseLeave={() => setIsDevicesHover(false)}
          >
            <div
              className={`pointer-events-none absolute inset-y-0 left-0 z-20 w-10 bg-gradient-to-r from-[#141417] to-transparent transition-opacity duration-200 ${isDevicesHover && canScrollLeft ? "opacity-100" : "opacity-0"
                }`}
            />
            <div
              className={`pointer-events-none absolute inset-y-0 right-0 z-20 w-12 bg-gradient-to-l from-[#141417] to-transparent transition-opacity duration-200 ${isDevicesHover && canScrollRight ? "opacity-100" : "opacity-0"
                }`}
            />

            <button
              type="button"
              onClick={() => scrollDevices("left")}
              disabled={!canScrollLeft}
              className={`absolute left-1 top-1/2 -translate-y-1/2 z-30 flex items-center justify-center size-8 rounded-full border backdrop-blur-md transition-all duration-200 ${isDevicesHover && canScrollLeft
                ? "opacity-100 translate-x-0 bg-black/45 border-white/10 text-white/80 hover:bg-black/70 hover:text-white"
                : "opacity-0 -translate-x-2 pointer-events-none"
                }`}
              aria-label="Scroll left"
            >
              <Icon icon="ph:caret-left-bold" width="14" />
            </button>

            <button
              type="button"
              onClick={() => scrollDevices("right")}
              disabled={!canScrollRight}
              className={`absolute right-1 top-1/2 -translate-y-1/2 z-30 flex items-center justify-center size-8 rounded-full border backdrop-blur-md transition-all duration-200 ${isDevicesHover && canScrollRight
                ? "opacity-100 translate-x-0 bg-black/45 border-white/10 text-white/80 hover:bg-black/70 hover:text-white"
                : "opacity-0 translate-x-2 pointer-events-none"
                }`}
              aria-label="Scroll right"
            >
              <Icon icon="ph:caret-right-bold" width="14" />
            </button>

            <div
              ref={devicesScrollRef}
              className="flex gap-2 overflow-x-auto overflow-y-hidden snap-x snap-mandatory scroll-smooth pb-2 pl-1 pr-12 custom-scrollbar"
              style={{
                scrollbarWidth: "none",
                msOverflowStyle: "none",
              }}
              onScroll={handleDevicesScroll}
            >
              {IMAGE_DEVICE_TEMPLATES.map((tpl) => (
                <DeviceCard
                  key={tpl.id}
                  tpl={tpl}
                  isActive={activeDeviceId === tpl.id}
                  onClick={() => handleDeviceClick(tpl.id)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── Remove button (unified) ── */}
        {hasActiveFrame && (
          <Button
            onClick={handleRemoveAll}
            variant="outline"
            className="w-full text-xs"
            aria-label={t("remove")}
          >
            <Icon icon="ph:trash-bold" width="13" aria-hidden="true" />
            {t("remove")}
          </Button>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PAGE: DETAIL 2D
  // ─────────────────────────────────────────────────────────────────────────

  if (page === "detail-2d") {
    return (
      <>
        <div className="flex items-center gap-2 p-3 border-b border-white/6 shrink-0">
          <DetailPageHeader
            label="Marco 2D"
            icon="hugeicons:ai-browser"
            onBack={() => setPage("home")}
          />
        </div>

        <div className="p-4 flex flex-col gap-5">

          {currentMockup && (
            <div className="relative w-full h-32 squircle-element overflow-hidden bg-neutral-900 border border-blue-500/30">
              {(() => {
                const categoryConfig = MOCKUP_CATEGORIES.find(
                  (c) => c.id === currentMockup.category
                );
                const bgUrl =
                  categoryConfig?.bgUrl ||
                  "https://i.ibb.co/r2JQ3Gcy/minimal-02.jpg";
                return (
                  <div
                    className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                    style={{ backgroundImage: `url('${bgUrl}')` }}
                  />
                );
              })()}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {currentMockup.preview}
              </div>
              <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-black/80 to-transparent">
                <span className="text-[11px] font-bold text-white/90 tracking-wide">
                  {currentMockup.name}
                </span>
              </div>
            </div>
          )}

          {/* 2D config controls */}
          {features.hasDarkMode && (
            <fieldset className="flex items-center justify-between w-full gap-4">
              <legend className="float-left flex items-center gap-2 text-[11px] text-white/55 whitespace-nowrap">
                <Icon icon="ph:moon-bold" width="14" aria-hidden="true" />
                <span>{t("darkMode.label")}</span>
              </legend>
              <div
                className="flex items-center gap-1 p-0.5 rounded-lg bg-white/6 border border-white/[0.07]"
                role="group"
                aria-label={t("darkMode.label")}
              >
                <button
                  onClick={() => handleDarkModeChange(true)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] transition-colors ${mockupConfig?.darkMode
                    ? "bg-[#09090B] border border-white/10 text-white/70"
                    : "text-white/30 hover:text-white/50"
                    }`}
                  aria-pressed={mockupConfig?.darkMode}
                  aria-label={t("darkMode.dark")}
                >
                  <Icon icon="ph:moon-bold" width="10" aria-hidden="true" />{" "}
                  {t("darkMode.dark")}
                </button>
                <button
                  onClick={() => handleDarkModeChange(false)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] transition-colors ${!mockupConfig?.darkMode
                    ? "bg-[#09090B] border border-white/10 text-white/70"
                    : "text-white/30 hover:text-white/50"
                    }`}
                  aria-pressed={!mockupConfig?.darkMode}
                  aria-label={t("darkMode.light")}
                >
                  <Icon icon="ph:sun-bold" width="10" aria-hidden="true" />{" "}
                  {t("darkMode.light")}
                </button>
              </div>
            </fieldset>
          )}

          {features.hasFrameColor && (
            <div className="space-y-2.5">
              <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold">
                {t("frameColor.label")}
              </p>
              <div className="grid grid-cols-6 gap-2">
                {FRAME_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => handleFrameColorChange(color)}
                    className={`aspect-square squircle-element cursor-pointer hover:ring-2 transition shadow-sm ring-white/60 border border-white/10 ${mockupConfig?.frameColor?.toLowerCase() === color.toLowerCase()
                      ? "ring-2 ring-white/90 shadow-lg shadow-white"
                      : "border-white/10 border-transparent hover:border-white/30"
                      }`}
                    style={{ backgroundColor: color }}
                    aria-label={t("frameColor.ariaLabel", { color })}
                  />
                ))}
                <label className="aspect-square squircle-element border border-dashed border-white/30 bg-white/5 flex items-center justify-center hover:bg-white/10 transition group cursor-pointer relative">
                  <Icon icon="mingcute:color-picker-fill" width="20" className="text-white/30" aria-hidden="true" />
                  <input
                    type="color"
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    onChange={(e) => handleFrameColorChange(e.target.value)}
                    value={mockupConfig?.frameColor || "#ffffff"}
                  />
                </label>
              </div>
            </div>
          )}

          {features.hasUrl && (
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold">
                {t("url.label")}
              </p>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#09090B] border border-white/[0.07] focus-within:border-blue-500/40 transition-colors">
                <Icon icon="line-md:link" width="13" className="text-white/30 shrink-0" aria-hidden="true" />
                <input
                  type="text"
                  value={mockupConfig?.url || ""}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder={t("url.placeholder")}
                  className="flex-1 bg-transparent text-[11px] text-white/70 placeholder:text-white/20 outline-none font-mono"
                  aria-label={t("url.label")}
                />
              </div>
            </div>
          )}

          {(features.hasHeaderScale || features.hasHeaderOpacity) && (
            <div className="space-y-3">
              {features.hasHeaderScale && (
                <SliderControl
                  icon="mdi:resize"
                  label={t("sliders.headerScale")}
                  value={mockupConfig?.headerScale ?? 70}
                  min={50}
                  max={100}
                  onChange={handleHeaderScaleChange}
                />
              )}
              {features.hasHeaderOpacity && (
                <SliderControl
                  icon="mdi:opacity"
                  label={t("sliders.headerOpacity")}
                  value={mockupConfig?.headerOpacity ?? 100}
                  min={0}
                  max={100}
                  onChange={handleHeaderOpacityChange}
                />
              )}
            </div>
          )}

          <Button
            onClick={handleRemoveAll}
            variant="outline"
            className="w-full text-xs mt-auto"
            aria-label={t("remove")}
          >
            <Icon icon="ph:trash-bold" width="13" aria-hidden="true" />
            {t("remove")}
          </Button>
        </div>
      </>
    );
  }

  if (page === "detail-3d") {
    return (
      <>
        <div className="flex items-center gap-2 p-3 border-b border-white/6 shrink-0">
          <DetailPageHeader
            label="Dispositivo 3D"
            icon="mage:box-3d"
            onBack={() => setPage("home")}
          />
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4 space-y-5">
          {/* Active device preview — same card UI as 2D preview */}
          {activeDeviceTpl && (
            <div
              className="relative w-full h-70 overflow-hidden rounded-2xl border"
              style={{ borderColor: `${activeDeviceTpl.accentColor}44` }}
            >
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(135deg, ${activeDeviceTpl.accentColor}22 0%, transparent 70%)`,
                }}
              />
              <div className="absolute inset-0 bg-[#0d0d10]" style={{ zIndex: -1 }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <Icon
                  icon={activeDeviceTpl.icon}
                  width="48"
                  style={{ color: `${activeDeviceTpl.accentColor}cc` }}
                />
              </div>
              <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-black/80 to-transparent">
                <span className="text-[11px] font-bold text-white/90 tracking-wide">
                  {activeDeviceTpl.title}
                </span>
              </div>
              <div
                className="absolute top-2 right-2 size-5 rounded-full flex items-center justify-center"
                style={{ background: activeDeviceTpl.accentColor }}
              >
                <Icon icon="mdi:check-bold" width={11} className="text-white" />
              </div>
            </div>
          )}

          {/* 3D config */}
          {imagePhoneActive && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">
                  Configuración
                </span>
                <button
                  type="button"
                  onClick={handle3DReset}
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

          <Button
            onClick={handleRemoveAll}
            variant="outline"
            className="w-full text-xs mt-2"
          >
            <Icon icon="ph:trash-bold" width="13" aria-hidden="true" />
            Quitar marco
          </Button>
        </div>
      </>

    );
  }

  return null;
}