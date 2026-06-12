/** Animation vector — GSAP tweens this object, Three.js reads it */
export interface AV {
  rx: number;
  ry: number;
  tx: number;
  ty: number;
  sc: number;
}

// ─── Tipos restaurados (motion.types.ts fue modificado pero aún los usa CameraVariant) ─────
export type MotionStyle = "smooth" | "normal" | "cinematic";
export type AnimMode = "entry" | "exit" | "entry+exit" | "none" | "static";

/** A cinematic script function — returns a repeating GSAP timeline */
export type ScriptFn = (
  av: AV,
  intensity: number,   // 0–1
  durMs: number,
  onUpdate: () => void,
) => gsap.core.Timeline;

/** What each template declares about itself */
export interface MotionTemplate {
  id: string;
  title: string;
  description: string;
  accentColor: string;
  icon: string;
  tags: string[];
  defaultDuration: number;   // ms
  /** If false, shows plain video with no phone overlay */
  showPhone: boolean;
  /** The cinematic script — only defined on templates that have one */
  script?: ScriptFn;
  /** Template-specific editor panel component (lazy-imported by the menu) */
  EditorPanel?: React.ComponentType<EditorPanelProps>;
}

/** Props every EditorPanel receives */
export interface EditorPanelProps {
  template: MotionTemplate;
}

export interface CameraVariant {
  id: string;
  label: string;
  description: string;
  icon: string;
  /** Suggested default animMode for this variant */
  defaultAnimMode: AnimMode;
  /** Duration in ms for the entry animation */
  entryDuration: number;
  /** Duration in ms for the exit animation */
  exitDuration: number;
  /** Entry: dramatic pose → REST (NRX/NRY). Must end at REST. */
  entryScript: ScriptFn;
  /** Exit: REST (NRX/NRY) → dramatic pose. */
  exitScript: ScriptFn;
  /** Kept for backwards compat with one-shot preview */
  script: ScriptFn;
}