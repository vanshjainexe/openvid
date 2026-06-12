"use client";

/**
 * useActiveTool
 *
 * Sincroniza la herramienta activa del editor (sidebar/ControlPanel) con
 * el query param `?m=<tool>` de la URL.
 *
 *   /es/editor?mode=video&m=mockup     → mockup menu
 *   /es/editor?mode=photo&m=elements   → elements menu
 *
 * Usa `useSearchParams` de Next.js + `useRouter` para que el state se
 * mantenga sincronizado con la URL en AMBAS direcciones:
 * - Al hacer click en un tool → URL cambia → state se actualiza
 *   (porque useSearchParams es reactivo a router.replace)
 * - Al navegar a una URL con `?m=X` (pegar URL, back/forward) → el
 *   state lee el valor de la URL en mount/vía re-render.
 *
 * El setter usa `router.replace` en lugar de `window.history.replaceState`
 * para que Next.js se entere del cambio y `useSearchParams` se actualice.
 */

import { useCallback, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Tool } from "@/types/editor.types";

const VALID_TOOLS: ReadonlySet<Tool> = new Set<Tool>([
    "screenshot",
    "elements",
    "audio",
    "zoom",
    "mockup",
    "cursor",
    "videos",
    "camera",
    "history",
    "motion",
]);

function parseTool(value: string | null): Tool {
    if (value && VALID_TOOLS.has(value as Tool)) {
        return value as Tool;
    }
    return "screenshot";
}

/**
 * Hook estilo `useState`: retorna [value, setter]. Lee `m` de la URL y
 * actualiza la URL al cambiar.
 */
export function useActiveTool(): [Tool, (next: Tool) => void] {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // `useSearchParams` es reactivo a router.replace (no a replaceState).
    // En mount, ya tiene el valor de la URL; no necesita useEffect extra.
    const tool = parseTool(searchParams.get("m"));

    const setTool = useCallback((next: Tool) => {
        // Construye los nuevos params preservando todos los existentes
        // (mode, preset, etc.) y actualizando solo `m`
        const params = new URLSearchParams(searchParams.toString());
        params.set("m", next);
        router.replace(`${pathname}?${params.toString()}`);
    }, [router, pathname, searchParams]);

    return [tool, setTool];
}
