import { phoneTemplate } from "@/app/components/ui/editor/templates-motion/Phone";
import { MotionTemplate } from "@/types/motion.types";

// ─── "No phone" option (no script, no EditorPanel, just deactivates the overlay)
const soloVideoTemplate: MotionTemplate = {
  id:              "none",
  title:           "Solo video",
  description:     "Muestra el video sin mockup de dispositivo",
  accentColor:     "#71717a",
  icon:            "ph:video-bold",
  tags:            ["Video"],
  defaultDuration: 0,
  showPhone:       false,
};

export const TEMPLATES: MotionTemplate[] = [
  soloVideoTemplate,
  phoneTemplate,
];

export { soloVideoTemplate };