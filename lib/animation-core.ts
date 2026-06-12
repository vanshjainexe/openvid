// ─── Local types (motion.types.ts fue eliminado al consolidar MockupMenu) ─────
type MotionStyle = "smooth" | "normal" | "cinematic";
type ScriptFn = (
  av: { rx: number; ry: number; tx: number; ty: number; sc: number },
  intensity: number,
  duration: number,
  style: MotionStyle,
  onUpdate?: () => void
) => gsap.core.Timeline;

import gsap from "gsap";

// ─── Neutral resting position (slight 3-D tilt for depth) ────────────────────
export const NRX = 12;
export const NRY = -22;

// ─── Style → easing / amplitude config ───────────────────────────────────────
export const STYLE_CFG: Record<MotionStyle, {
  amp: number;
  e1: string;
  e2: string;
  e3: string;
}> = {
  smooth:    { amp: 0.65, e1: "power1.inOut", e2: "power2.out",  e3: "sine.inOut"   },
  normal:    { amp: 1.00, e1: "power2.inOut", e2: "power3.out",  e3: "power2.inOut" },
  cinematic: { amp: 1.35, e1: "expo.inOut",   e2: "power4.out",  e3: "expo.inOut"   },
};

// ─── Idle: gentle ambient float used when no template script is defined ───────
export const idleScript: ScriptFn = (av, intensity, _dur, style, onUpdate) => {
  const { amp, e1 } = STYLE_CFG[style];
  const a = intensity * amp;
  return gsap.timeline({ repeat: -1, defaults: { ease: e1, onUpdate } })
    .to(av, { rx: NRX + 10 * a, ry: NRY - 28 * a, tx:  22 * a, ty: -14 * a, sc: 1.00, duration: 4.0 })
    .to(av, { rx: NRX + 20 * a, ry: NRY - 58 * a, tx: -18 * a, ty:  10 * a, sc: 0.97, duration: 4.5 })
    .to(av, { rx: NRX +  6 * a, ry: NRY - 80 * a, tx:  12 * a, ty: -20 * a, sc: 1.00, duration: 3.8 })
    .to(av, { rx: NRX + 24 * a, ry: NRY - 50 * a, tx: -28 * a, ty:  16 * a, sc: 0.98, duration: 4.2 })
    .to(av, { rx: NRX + 10 * a, ry: NRY - 28 * a, tx:   0,     ty:   0,     sc: 1.00, duration: 3.5 });
};