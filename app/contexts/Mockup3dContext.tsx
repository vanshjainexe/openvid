"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

interface Mockup3dState {
  selectedTemplateId: string | null;
  setSelectedTemplateId: (id: string | null) => void;

  motionImageUrl: string | null;
  setMotionImageUrl: (url: string | null) => void;

  motionIntensity: number;
  setMotionIntensity: (i: number) => void;
  /** Whether the phone mockup is active in image mode */
  imagePhoneActive: boolean;
  setImagePhoneActive: (v: boolean) => void;
  /** X offset (px) from canvas center */
  imagePhoneX: number;
  setImagePhoneX: (v: number) => void;
  /** Y offset (px) from canvas center */
  imagePhoneY: number;
  setImagePhoneY: (v: number) => void;
  /** Canvas-level scale of the phone mockup */
  imagePhoneScale: number;
  setImagePhoneScale: (v: number) => void;
  /** Persisted 3D rotation offset (degrees) from user drag */
  imagePhoneRotX: number;
  setImagePhoneRotX: (v: number) => void;
  imagePhoneRotY: number;
  setImagePhoneRotY: (v: number) => void;
  /** Z-axis rotation (degrees) for the phone mockup */
  imagePhoneRotZ: number;
  setImagePhoneRotZ: (v: number) => void;
  /** Perspective (px) for the 3D transform on the phone mockup */
  imagePhonePerspective: number;
  setImagePhonePerspective: (v: number) => void;
  /** Which 3D device model is active: the default phone JSON, iPhone 15 Pro Max, Samsung S25 Ultra, or single macOS laptop */
  imagePhoneDevice: 'phone' | 'iphone' | 'iphone-13-pro-max' | 'samsung' | 'laptop';
  setImagePhoneDevice: (d: 'phone' | 'iphone' | 'iphone-13-pro-max' | 'samsung' | 'laptop') => void;
  imagePhonePresetId: string;
  setImagePhonePresetId: (id: string) => void;
  /** Laptop opening animation progress (0 = closed, 1 = fully open) */
  imagePhoneOpening: number;
  setImagePhoneOpening: (v: number) => void;
  /** Drop-shadow intensity for the active device mockup (0 = no shadow, 1 = full) */
  imagePhoneShadow: number;
  setImagePhoneShadow: (v: number) => void;
  /** Drop-shadow color (CSS color string) */
  imagePhoneShadowColor: string;
  setImagePhoneShadowColor: (v: string) => void;
  /** Undo the last motion transform change. Returns true if there was something to undo. */
  undoMotion: () => boolean;
  /** Redo a previously-undone motion transform change. Returns true if there was something to redo. */
  redoMotion: () => boolean;
  /** Push the current motion transform state to the undo history. */
  pushHistory: () => void;
  /** True when there is at least one entry in the motion undo stack. */
  canUndoMotion: boolean;
  /** True when there is at least one entry in the motion redo stack. */
  canRedoMotion: boolean;
}

const Mockup3dContext = createContext<Mockup3dState | null>(null);

export function Mockup3dProvider({ children }: { children: ReactNode }) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [motionImageUrl, setMotionImageUrl] = useState<string | null>(null);
  const [motionIntensity, setMotionIntensity] = useState(70);
  // Add this with your other useState hooks inside Mockup3dProvider

  // Image mode phone mockup
  const [imagePhoneActive, setImagePhoneActive] = useState(false);
  const [imagePhoneX, setImagePhoneX] = useState(0);
  const [imagePhoneY, setImagePhoneY] = useState(0);
  const [imagePhoneScale, setImagePhoneScale] = useState(1);
  const [imagePhoneRotX, setImagePhoneRotX] = useState(0);
  const [imagePhoneRotY, setImagePhoneRotY] = useState(0);
  const [imagePhoneRotZ, setImagePhoneRotZ] = useState(0);
  const [imagePhonePerspective, setImagePhonePerspective] = useState(600);
  const [imagePhoneDevice, setImagePhoneDevice] = useState<'phone' | 'iphone' | 'iphone-13-pro-max' | 'samsung' | 'laptop'>('phone');
  const [imagePhonePresetId, setImagePhonePresetId] = useState('front');
  const [imagePhoneOpening, setImagePhoneOpening] = useState(1);
  const [imagePhoneShadow, setImagePhoneShadow] = useState(0.6);
  const [imagePhoneShadowColor, setImagePhoneShadowColor] = useState("#000000");

  // ── Undo/redo stack for motion transforms (max 50 entries) ────────────────
  const historyRef = useRef<{
    past: Array<{
      x: number; y: number; scale: number;
      rx: number; ry: number; rz: number;
      opening: number; shadow: number; shadowColor: string;
    }>;
    future: Array<{
      x: number; y: number; scale: number;
      rx: number; ry: number; rz: number;
      opening: number; shadow: number; shadowColor: string;
    }>;
  }>({ past: [], future: [] });
  const MAX_HISTORY = 50;
  const [canUndoMotion, setCanUndoMotion] = useState(false);
  const [canRedoMotion, setCanRedoMotion] = useState(false);

  const refreshCanFlags = () => {
    setCanUndoMotion(historyRef.current.past.length > 0);
    setCanRedoMotion(historyRef.current.future.length > 0);
  };

  const pushHistory = () => {
    historyRef.current.past.push({
      x: imagePhoneX, y: imagePhoneY, scale: imagePhoneScale,
      rx: imagePhoneRotX, ry: imagePhoneRotY, rz: imagePhoneRotZ,
      opening: imagePhoneOpening, shadow: imagePhoneShadow, shadowColor: imagePhoneShadowColor,
    });
    if (historyRef.current.past.length > MAX_HISTORY) historyRef.current.past.shift();
    historyRef.current.future = [];
    refreshCanFlags();
  };

  const undoMotion = useCallback(() => {
    const past = historyRef.current.past;
    if (past.length === 0) return false;
    historyRef.current.future.push({
      x: imagePhoneX, y: imagePhoneY, scale: imagePhoneScale,
      rx: imagePhoneRotX, ry: imagePhoneRotY, rz: imagePhoneRotZ,
      opening: imagePhoneOpening, shadow: imagePhoneShadow, shadowColor: imagePhoneShadowColor,
    });
    const snap = past.pop()!;
    setImagePhoneX(snap.x); setImagePhoneY(snap.y); setImagePhoneScale(snap.scale);
    setImagePhoneRotX(snap.rx); setImagePhoneRotY(snap.ry); setImagePhoneRotZ(snap.rz);
    setImagePhoneOpening(snap.opening); setImagePhoneShadow(snap.shadow); setImagePhoneShadowColor(snap.shadowColor);
    refreshCanFlags();
    return true;
  }, [imagePhoneX, imagePhoneY, imagePhoneScale, imagePhoneRotX, imagePhoneRotY, imagePhoneRotZ, imagePhoneOpening, imagePhoneShadow, imagePhoneShadowColor]);

  const redoMotion = useCallback(() => {
    const future = historyRef.current.future;
    if (future.length === 0) return false;
    historyRef.current.past.push({
      x: imagePhoneX, y: imagePhoneY, scale: imagePhoneScale,
      rx: imagePhoneRotX, ry: imagePhoneRotY, rz: imagePhoneRotZ,
      opening: imagePhoneOpening, shadow: imagePhoneShadow, shadowColor: imagePhoneShadowColor,
    });
    const snap = future.pop()!;
    setImagePhoneX(snap.x); setImagePhoneY(snap.y); setImagePhoneScale(snap.scale);
    setImagePhoneRotX(snap.rx); setImagePhoneRotY(snap.ry); setImagePhoneRotZ(snap.rz);
    setImagePhoneOpening(snap.opening); setImagePhoneShadow(snap.shadow); setImagePhoneShadowColor(snap.shadowColor);
    refreshCanFlags();
    return true;
  }, [imagePhoneX, imagePhoneY, imagePhoneScale, imagePhoneRotX, imagePhoneRotY, imagePhoneRotZ, imagePhoneOpening, imagePhoneShadow, imagePhoneShadowColor]);

  return (
    <Mockup3dContext.Provider value={{
      selectedTemplateId, setSelectedTemplateId,
      motionImageUrl, setMotionImageUrl,
      motionIntensity, setMotionIntensity,
      imagePhoneActive, setImagePhoneActive,
      imagePhoneX, setImagePhoneX,
      imagePhoneY, setImagePhoneY,
      imagePhoneScale, setImagePhoneScale,
      imagePhoneRotX, setImagePhoneRotX,
      imagePhoneRotY, setImagePhoneRotY,
      imagePhoneRotZ, setImagePhoneRotZ,
      imagePhonePerspective, setImagePhonePerspective,
      imagePhoneDevice, setImagePhoneDevice,
      imagePhonePresetId, setImagePhonePresetId,
      imagePhoneOpening, setImagePhoneOpening,
      imagePhoneShadow, setImagePhoneShadow,
      imagePhoneShadowColor, setImagePhoneShadowColor,
      undoMotion, redoMotion, pushHistory,
      canUndoMotion,
      canRedoMotion,
    }}>
      {children}
    </Mockup3dContext.Provider>
  );
}

export function useMockup3dContext() {
  const ctx = useContext(Mockup3dContext);
  if (!ctx) throw new Error("useMockup3dContext must be used inside Mockup3dProvider");
  return ctx;
}