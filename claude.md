# openvid (openvidshot) — Guía del proyecto

> Crea demos y mockups profesionales en segundos, directamente en el navegador.
> Graba la pantalla o sube un video, agrega zooms suaves, mockups de dispositivos, efectos 3D y fondos personalizados, y exporta un demo cinematográfico.

---

## 1. Visión general

openvid es un **editor de video web** orientado a la creación de demos, screencasts y mockups. El repo contiene:

| Carpeta | Rol |
|---|---|
| raíz (`app/`, `components/`, `lib/`, `hooks/`, `types/`) | **Frontend / editor 100% client-side** en Next.js 16 + React 19 + Tailwind 4. Grabación, mockups, zoom 3D, audio, exportación en navegador. |
| `openvid-back/` | Subproyecto auxiliar (opcional) para renderizado headless en servidor. Ver §6. |

El **editor funciona sin backend**: todo se procesa con FFmpeg.wasm / MediaBunny / Canvas 2D / Three.js directamente en el cliente. La carpeta `openvid-back/` se mantiene como referencia/spec pero no es prioritaria para el día a día del editor.

---

## 2. Características principales

### Entrada de video
- **Grabación de pantalla** en el navegador (sin instalación) — `useScreenRecording` / `useScreenCapture` + `RecordingContext` con `MediaRecorder` API.
- **Subida de archivos** (MP4, WebM, QuickTime, MKV) con drag & drop.
- **Screen capture** instantáneo desde la landing (`useScreenCapture`).
- **Biblioteca de videos** persistente en IndexedDB (`openvid-videos-library`) con thumbnails, audio flags, file size, etc.

### Modo editor (Video vs Photo)
- **Editor mode** seleccionado por URL (`?mode=video` o `?mode=photo`) — `useEditorMode`.
- `VIDEO_MODE_CONFIG` y `PHOTO_MODE_CONFIG` (`types/editor-mode.types.ts`) activan/desactivan features: timeline, playerControls, videoClips, audioTracks, zoomFragments, camera, cursor, mockups, background, elements, export.
- **Photo mode**: sube/edita imágenes con mockups, 3D previews, image masking, export como PNG/WEBP/JPG/AVIF.

### Mockups (15+ componentes)
Definidos en `lib/mockup-data.tsx` con catálogo `MOCKUPS: Mockup[]` y renderer en `MockupWrapper.tsx`:
- **macOS** (light/dark, glass, ghost, ghost-glass, container-glass, dark-ide, ghost-ide)
- **iPhone** (slim)
- **S24 Ultra** (Samsung)
- **Chrome** / **Brave** / **Browser tab glass**
- **VSCode** (editor oscuro)
- **Glass variants** (curve, full, ui-container, hard-shell)
- **Mockup config**: `darkMode`, `frameColor`, `url`, `headerScale`, `headerOpacity`, `cornerRadius` — cada mockup declara qué features soporta (`MockupFeatures`).
- **Smart radius**: `BOTTOM_ONLY_RADIUS_MOCKUPS` y `SELF_SHADOWING_MOCKUPS` en `lib/constants.ts` controlan cómo se renderiza el `border-radius` y la sombra por mockup.
- **Perspectiva 3D** del frame vía CSS 3D transforms o canvas (`lib/perspective3d.ts` con Three.js `WebGLRenderer` offscreen).
- **Duplicación deliberada**: cada mockup vive en `app/components/ui/editor/mockups/*.tsx` (preview React) y en `lib/mockup-canvas/*.ts` (renderer canvas para export) — **NO tocar uno sin tocar el otro**.

### Fondos
- **100+ presets** categorizados en `lib/wallpaper.catalog.ts` (desktop, gradient, minimal, pattern).
- **Unsplash / Pexels / Pixabay** vía proxy `app/api/photos/route.ts` (descubrimiento rotativo + búsqueda + caché 5min).
- **Imágenes propias** (LocalStorage `openvid-uploaded-images` + IndexedDB `image-upload-cache`).
- **Color sólido / gradiente** vía `BackgroundColorEditor`.
- **Blur 0–100%** aplicado en el canvas render con `ctx.filter`.

### Personalización visual
- Padding dinámico, esquinas redondeadas, sombras, rotación y traslación del frame (`VideoTransform`).
- Crop area (`CropArea`) — soporta `VideoCropperModal` y `ImageCropperModal`.
- Image mask con gradientes lineales (`ImageMaskConfig` con top/bottom/left/right/angle) — `GetMediaMaskStyles` aplica a DOM; canvas usa `createLinearGradient` + `globalCompositeOperation = 'destination-in'`.
- Aspect ratios: `auto`, `16:9`, `9:16`, `1:1`, `4:3`, `3:4`, `custom` — `ASPECT_RATIO_DIMENSIONS` en `types/editor.types.ts`.

### Canvas y elementos
- **3 tipos de elementos** (`types/canvas-elements.types.ts`): `svg`, `image`, `text` — todos extienden `CanvasElementBase` (x, y, width, height, rotation, opacity, zIndex, visible, locked, groupId).
- **Categorías** en `lib/canvas-elements.config.ts`: `SVG_CATEGORIES`, `IMAGE_CATEGORIES`, `PINNED_SVG_ITEMS`, `PINNED_IMAGE_ITEMS`.
- **Sistema de capas**: `VIDEO_Z_INDEX = 1000` separa elementos delante/detrás del video; `layers.utils.ts` agrupa y numera; `LayersPanel.tsx` permite reordenar, bloquear, ocultar, agrupar.
- **Inline text editing** Figma-style (contentEditable) + `T` shortcut para colocar texto con crosshair.
- **Multi-select** con drag-reorder, copy/paste, bring-to-front/send-to-back.

### Zoom y cámara 3D
- **`ZoomFragment`** (`types/zoom.types.ts`): id, startTime, endTime, zoomLevel, speed, focusX/Y, optional `movementEnabled`+`movementEndX/Y`, `enable3D`+`perspective3DIntensity/AngleX/AngleY`.
- **Curvas easing**: `easeOutQuart`, `easeInOutQuart` (en `types/zoom.types.ts`).
- **3-phase zoom** (`calculateZoomPhaseState`): `entry → hold → exit` con `scale`, `focusX`, `focusY`, `rotateX`, `rotateY`, `perspective`.
- **Pivot point** calculado para que el focus quede pinned al centro del canvas a `S=S_target`.
- **3D perspective** vía `lib/perspective3d.ts` (offscreen WebGL + CanvasTexture) — aplicado SOLO al foreground (mockup), no al background.
- **GlobalConfig** (`ZoomGlobalConfig.tsx`) lista fragmentos, **TrackItem** los muestra en la timeline, **Editor** edita focus points + toggle movement/3D.

### Motion / 3D Phone
- **`MotionContext`** (`app/contexts/MotionContext.tsx`) — estado global: `selectedTemplateId`, `motionDuration/Intensity/Style/VariantId/AnimMode/ImageUrl` + `imagePhoneActive/X/Y/Scale/RotX/RotY/Device/PresetId`.
- **`MotionTemplate`** con `ScriptFn` que devuelve un `gsap.core.Timeline` (`types/motion.types.ts`).
- **`Phone3DViewer.tsx`** — única master timeline (idle → entry → hold → exit → done) con `gsap.timeline()` + `gsap.delayedCall`. Carga GLTF (phone default, iPhone 15 Pro Max, Samsung S25 Ultra) desde `public/models/`.
- **Templates registrados** en `lib/template-registry.ts` (`soloVideoTemplate`, `phoneTemplate`; otros comentados para futuro).
- **Style presets** (`STYLE_CFG` en `lib/animation-core.ts`): `smooth` / `normal` / `cinematic` con amplitudes y easings distintos.
- **`ImageMotionMenu.tsx`** para modo foto: position pad (X/Y), device picker, presets, image upload.
- **Ctrl+scroll zoom** en phone overlay con badge indicador.

### Audio
- **Multi-track** (hasta `MAX_AUDIO_TRACKS = 5`).
- **Cada track** (`types/audio.types.ts`): id, audioId, name, startTime, duration, volume, loop, trimStart.
- **HTMLAudio elements** sincronizados con `videoRef.currentTime` (sync ±0.1s).
- **Per-track volume + master volume** multiplicativos.
- **Auto-trim** si el audio excede `videoDuration` (`AudioTrimModal`).
- **Mute original** audio (toggle global o por-clip en multi-video).
- **Formatos soportados**: `audio/mpeg`, `audio/wav`, `audio/ogg`, `audio/aac`, `audio/m4a` (max 10MB).

### Camera overlay (picture-in-picture)
- **`CameraConfig`** (`types/camera.types.ts`): enabled, deviceId, shape (`squircle`/`circle`/`square`), size, position, corner (`top-left`/`top-right`/`bottom-left`/`bottom-right`/`custom`), mirror.
- **`CameraMenu.tsx`** + **`FloatingCameraPreview.tsx`** para previsualizar y arrastrar.
- En `VideoCanvas.drawFrame`, `drawCameraOverlay` pinta el camera frame con shape clipping + shadow sobre el canvas final.

### Cursor
- **Grabado** durante recording (vía `CaptureController` API cuando hay soporte).
- **`CursorConfig`** (`types/cursor.types.ts`): style (`mac`/`windows`/`dot`/`none`), color, size, smoothing, clickEffect (`ripple`/`ring`/`none`).
- **Interpolación** entre keyframes con `easeInOutCubic` (`interpolateCursorPosition`).
- Reemplazo visual del cursor nativo en preview/export.

### Video multi-clip
- **`VideoTrackClip`** (`types/video-track.types.ts`): id, libraryVideoId, name, startTime, duration, trimStart, trimEnd, thumbnailUrl, hasCamera.
- **Helpers**: `calculateTotalDuration`, `findNextClipPosition`, `getClipAtTime`, `doClipsOverlap`.
- **Multi-clip playback** (`app/[locale]/(editor)/editor/page.tsx:2042-2247`): un solo `<video>` element que swappea el `src` al cruzar clip boundaries; `updateTimeSmoothRef` con `requestAnimationFrame` traduce video-time → timeline-time.
- **Clips en `videosLibrary`** con `hasAudio` flag per-clip.

### Exportación
- **Calidades** (`lib/constants.ts`): 4K (3840×2160@30), 2K (2560×1440@30), 1080p (1920×1080@30), 720p (1280×720@30), 480p (854×480@24), GIF, WebM-alpha.
- **MP4 (H.264)**: `@ffmpeg/ffmpeg` (WASM) + `@ffmpeg/util` (FFmpeg.wasm en `public/ffmpeg/`).
- **WebM (VP9) con transparencia**: `mediabunny` (Output + Mp4OutputFormat + BufferTarget + CanvasSource).
- **Image export** (modo photo): `html-to-image` (`toBlob`) con escalado a dimensiones export.
- **PNG/WEBP/JPG/AVIF**: vía `html-to-image` con `backgroundColor` opcional.
- **GIF**: pipeline FFmpeg.wasm.
- **Pipeline principal**: `useVideoExport` → dibuja cada frame con `canvasRef.current.drawFrame()` → muxa con FFmpeg (audio + encoding).
- **Transparencia**: `selectedWallpaper === -1` habilita alpha channel.

### Internacionalización
- **`next-intl`** con locales `es` (default), `en`, `ru` (`i18n.ts`).
- Rutas localizadas vía segmento `[locale]`.
- Cinco fuentes cargadas: Inter, Roboto, Poppins, Montserrat, DM_Sans (variables CSS).
- Traducciones en `messages/{es,en,ru}.json`.

### Autenticación
- **Supabase Auth** (OAuth Google/GitHub/Twitch) — `utils/supabase/` con clientes `client.ts`/`server.ts`/`middleware.ts`.
- Hook `useAuth` con `AuthProvider`, `user`, `profile`, `signOut`.
- Avatar fallback: `https://api.dicebear.com/7.x/initials/svg?seed={name}`.
- Tabla `user_profiles` con `first_name`, `last_name`, `avatar_url`, `provider`.

### Home / Landing
- **`<Hero />`** con upload (video o imagen) → guarda en `video-upload-cache`/`image-upload-cache` y redirige a `/editor?mode=video|photo`.
- **`<VideoHero />`** demo video loop con blur gradients.
- **`<InteractiveRecordingSteps />`** (3 steps) inicia recording via `RecordingContext`.
- **`<EditorPreview />`** con Atropos parallax.
- **`<CarouselDemos />`** con 8 demo videos + 12 imágenes.
- **`<HeroScrollMask />`** GSAP ScrollTrigger pinned animation.
- **`<BannerCTA />`** con spotlight hover effect.
- **`<DonationCard />`** link a `/donate` con Yape/Visa/QR.

---

## 3. Stack tecnológico

### Frontend
- **Framework**: Next.js 16.1.6 (App Router) · React 19.2 · TypeScript 5
- **Estilos**: Tailwind CSS 4 (`@tailwindcss/postcss`), `tw-animate-css`, `class-variance-authority`, `tailwind-merge`, `clsx`
- **UI primitives**: Radix UI (`@radix-ui/react-dialog`, `react-dropdown-menu`), `radix-ui`, shadcn (`components.json`), iconos `lucide-react` y `@iconify/react`
- **Animaciones**: Framer Motion 12, GSAP 3.15 + ScrollTrigger, Atropos (parallax), Swapy (drag-reorder)
- **3D / gráficos**: Three.js 0.184 + `@types/three` (WebGL renderer offscreen para perspective 3D y motion phone)
- **Video / media**:
  - `@ffmpeg/ffmpeg` + `@ffmpeg/core` + `@ffmpeg/util` (servidos desde `public/ffmpeg/`)
  - `mediabunny` (pipeline de video optimizado MP4/WebM)
  - `html-to-image` (export de mockups DOM → imagen)
- **i18n**: `next-intl` 4
- **Auth / data**: `@supabase/ssr`, `@supabase/supabase-js`

### Subproyecto `openvid-back/` (opcional, no prioritario)
Servicio independiente para renderizado headless en servidor (NestJS + BullMQ + Redis + Remotion + Prisma + Supabase). Existe como referencia/contrato para exportaciones asíncronas; el editor no lo requiere. Ver `BACKEND_SPEC.md`/`BACKEND_TESTING.md` si se necesita profundizar.

### Almacenamiento (cliente)
- **IndexedDB** (3 DBs):
  - `openvid-videos-library` (DB_VERSION 3) — biblioteca de videos grabados y subidos, con thumbnails, audio flags, cleanup 60 días.
  - `openvid-uploaded-videos` (DB_VERSION 2) — videos recién subidos en tránsito.
  - DB de `useScreenRecording` para el video "current".
- **LocalStorage**:
  - `openvid-uploaded-images` — imágenes recientes de background.
  - `openvid-elements-uploads` — imágenes subidas para usar como elementos del canvas.
- **Caché en memoria**: `Map<id, Blob/HTMLImageElement/HTMLAudioElement` para videos library, element images, SVG images, audio tracks, thumbnails.

---

## 4. Estructura de carpetas

```
openvidshot/
├── app/                                 # Next.js App Router (frontend)
│   ├── api/
│   │   └── photos/route.ts              # Proxy Unsplash/Pexels/Pixabay (search + curated, cache 5min)
│   ├── components/                      # Componentes de aplicación (no shadcn)
│   │   ├── common/                      # Header, Footer, UserMenu, LanguageSwitcher, MobileMenu
│   │   ├── seo/                         # StructuredData (JSON-LD: WebApp + Organization)
│   │   └── ui/
│   │       ├── editor/                  # Núcleo del editor (ver §5)
│   │       │   ├── mockups/             # 18+ componentes React de mockups
│   │       │   └── templates-motion/    # Plantillas de animación (Phone)
│   │       ├── home/                    # Landing (Hero, Demo, BannerCTA, RecordingSteps, ...)
│   │       ├── floating/                # FloatingCameraPreview, RecordingOverlay, ExportOverlay
│   │       └── ...                      # AspectRatioSelect, BackgroundColorEditor, ExportDropdown, PhotoPicker, RecordingSetup, SidebarTool, Skeleton, SliderControl, TabButton, TemplateEditorShell, WalpaperSections
│   ├── config/env.ts                    # ENV tipado (unsplash, pexels, pixabay keys)
│   ├── contexts/       
│   │   ├── MotionContext.tsx                # Estado global de motion/3D phone
│   │   ├── RecordingContext.tsx             # Provider de grabación + Alt+S/Alt+D shortcuts
│   │   ├── useAuth.tsx                      # Sesión Supabase + AuthProvider
│   ├── [locale]/
│   │   ├── (auth)/login/                # Página de login
│   │   ├── (editor)/editor/             # Página principal del editor (page.tsx ~3000 líneas)
│   │   ├── (home)/                      # Landing + /donate (DonateClient)
│   │   ├── (legal)/privacy, terms/
│   │   ├── auth/callback/route.ts       # OAuth callback de Supabase
│   │   └── layout.tsx                   # Providers: NextIntlClientProvider + TooltipProvider
│   ├── globals.css                      # Tailwind 4 base + tokens
│   ├── layout.tsx, robots.ts, sitemap.ts, not-found.tsx
│   └── favicon.ico
│
├── components/                          # Componentes compartidos / shadcn-ui
│   ├── ui/                              # button, input, select, popover, tooltip, dropdown-menu, alert,
│   │                                    # toggle, hover-card, LoadingSpinner, DropImage, CtxMenuItem,
│   │                                    # GitHubStars, ProgressiveImg, RotationHandleIcon, SectionToggle,
│   │                                    # TrackVolumeSlider, tooltip-action, SidebarTool, ...
│   ├── canvas-svg/                      # SVG inlines del canvas (iconos categorizados)
│   └── cursor-svg/                      # SVGs de cursores animados (Mac/Windows/Dot)
│
├── hooks/                               # React hooks de dominio
│   ├── useScreenCapture.ts              # Captura de pantalla (imagen)
│   ├── useScreenRecording.ts            # Grabación de pantalla (video) con camera + audio
│   ├── useVideoUpload.ts / useVideoThumbnails.ts / useVideoExport.ts
│   ├── useImageExport.ts / useImageProjects.ts
│   ├── useEditorMode.ts                 # Lee `?mode=` de URL
│   ├── useUndoRedo.ts                   # History stack (max 50)
│   ├── useDebounce.ts
│
├── lib/                                 # Lógica pura, utils y catálogos
│   ├── animation-core.ts                # NRX/NRY neutral pose, STYLE_CFG, idleScript
│   ├── canvas-elements.config.ts        # SVG_CATEGORIES, IMAGE_CATEGORIES, pinned items
│   ├── canvas.utils.ts                  # drawRoundedRect, calculateScaledPadding, applyCanvasBackground,
│   │                                    # getAspectRatioStyle/Number/MaxWidth, calculateSmoothZoom
│   ├── canvas-icons/                    # action, editor, navigation, status icons
│   ├── color.utils.ts
│   ├── constants.ts                     # QUALITY_SETTINGS, VIDEO_Z_INDEX, BOTTOM_ONLY_RADIUS_MOCKUPS,
│   │                                    # SELF_SHADOWING_MOCKUPS, TIMELINE_ZOOM_SCALE, MIN_TRIM_DURATION
│   ├── layers.utils.ts                  # buildLayerNames, buildGroupNumbers
│   ├── mockup-canvas/                   # 18+ canvas renderers (chrome, macos*, s24, vscode, glass*)
│   │                                    # + types.ts + shared.ts + index.ts barrel
│   ├── mockup-canvas.utils.ts           # drawMockupToCanvas (entry point)
│   ├── mockup-data.tsx                  # MOCKUPS array con preview React de cada mockup
│   ├── mockup-previews.tsx              # React preview components (None/Macos/Brave/Chrome/...)
│   ├── perspective3d.ts                 # Three.js offscreen WebGL renderer (singleton)
│   ├── photo-providers.ts               # Unsplash/Pexels/Pixabay config
│   ├── template-registry.ts             # TEMPLATES: soloVideoTemplate + phoneTemplate
│   ├── thumbnail-cache.ts               # Video thumbnails persistence
│   ├── video-cache-utils.ts             # Helpers
│   ├── image-projects-cache.ts          # IndexedDB wrapper para ImageProject (modo photo)
│   ├── image-upload-cache.ts            # IndexedDB cache para uploads
│   ├── video-upload-cache.ts            # IndexedDB cache para uploads de video
│   ├── videos-library.ts                # IndexedDB library wrapper (DB 'openvid-videos-library', v3)
│   ├── video.utils.ts                   # formatTime, getZoomMultiplier, ensureVideoReady
│   ├── wallpaper.catalog.ts             # 100+ fondos (desktop/gradient/minimal/pattern)
│   ├── wallpaper.utils.ts               # getWallpaperUrl, getWallpaperPreviewUrl
│   ├── utils.ts                         # cn() (twMerge + clsx)
│   └── index.ts                         # Barrel
│
├── types/                               # Tipos TypeScript del dominio (uno por feature)
│   ├── audio.types.ts                   # AudioTrack, UploadedAudio, AudioConfig, MAX_AUDIO_TRACKS
│   ├── background.types.ts              # BackgroundColorConfig
│   ├── camera.types.ts                  # CameraConfig, CameraShape, CameraCorner, DEFAULT_CAMERA_CONFIG
│   ├── canvas-elements.types.ts         # CanvasElement (svg/image/text), Svg/Image/TextElement
│   ├── control-panel.types.ts           # ControlPanelProps (props del panel reactivo)
│   ├── cursor.types.ts                  # CursorKeyframe, CursorConfig, interpolateCursorPosition
│   ├── editor-mode.types.ts             # EditorMode ('video'|'photo'), EditorModeConfig
│   ├── editor-state.types.ts            # EditorState (full undo/redo snapshot), createInitialEditorState
│   ├── editor.types.ts                  # Tool, BackgroundTab, AspectRatio, CropArea, VideoTransform,
│   │                                    # VideoCanvasHandle, VideoCanvasProps, VideoThumbnail
│   ├── image-project.types.ts           # ImageProjectPreview (modo photo)
│   ├── ImageMask.types.ts               # MaskPreset, ImageMaskEditorProps
│   ├── layers.types.ts                  # LayersPanelProps, ContextMenuProps
│   ├── mockup.types.ts                  # MockupConfig (darkMode/frameColor/url/headerScale/...),
│   │                                    # MockupFeatures, MockupCategory, DEFAULT_MOCKUP_CONFIG
│   ├── motion.types.ts                  # MotionTemplate, ScriptFn, AnimMode, MotionStyle, AV
│   ├── photo.types.ts                   # Preview3DConfig, ImageMaskConfig, PREVIEW_CONFIGS,
│   │                                    # PREVIEW_TO_PHONE_OFFSET (front/top-left-angle/...)
│   ├── player-control.types.ts          # PlayerControlsProps, MIN_ZOOM, MAX_ZOOM, ZOOM_STEP
│   ├── recording.types.ts               # RecordingState, RecordingResult, RecordingContextType
│   ├── timeline.types.ts                # TrimRange, TimelineProps
│   ├── tool-sidebar.types.ts            # ToolsSidebarProps
│   ├── video-track.types.ts             # VideoTrackClip + calculateTotalDuration/findNextClipPosition/
│   │                                    # getClipAtTime/doClipsOverlap
│   ├── video.types.ts                   # VideoData, LibraryVideo, LibraryVideoInfo
│   ├── zoom.types.ts                    # ZoomFragment, ZoomPhaseState, easeOutQuart,
│   │                                    # calculateZoomPhaseState, zoomLevelToFactor, speedToTransitionMs
│   └── index.ts                         # Barrel reexport
│
├── utils/supabase/                      # Clientes Supabase (client / server / middleware SSR)
│
├── messages/                            # Traducciones i18n
│   ├── en.json · es.json · ru.json
│
├── public/                              # Assets estáticos
│   ├── ffmpeg/                          # ffmpeg-core.js/.wasm (servidos COOP/COEP)
│   ├── images/
│   │   ├── backgrounds/ (desktop, gradient, minimal, pattern)
│   │   ├── carousel/ (decorators, images, videos)
│   │   ├── metadata/ (favicon, OG preview, apple, shortcut)
│   │   ├── mockups/ (bg-browser, bg-ide, bg-mobile)
│   │   ├── pages/ (hero, demos, login, qr, posters, openvid)
│   │   └── scroll/ (logos sponsors/decoradores)
│   ├── models/                          # glTF/GLB: iphone-15-pro-max.glb, samsung-galaxy-s25-ultra.glb, phone-gltf.json
│   ├── svg/                             # logo, mockups, cursores, openvid
│   ├── videos/                          # Previews de features (audio, mockup, zoom, ...)
│   ├── elements/images/                 # assets, overlays, stickers
│   └── llms.txt
│
├── openvid-back/                        # Subproyecto auxiliar (render headless, no prioritario)
│
├── .agents/skills/                      # Skills de IA (3d-web-experience, gsap, react-three-fiber)
├── .github/                             # CI/PR templates
│
├── i18n.ts                              # Config next-intl (locales es/en/ru)
├── navigation.ts                        # Helpers de navegación localizada
├── proxy.ts                             # Proxy / middleware adicional
├── next.config.ts                       # Remote images + headers COOP/COEP
├── tsconfig.json · eslint.config.mjs · postcss.config.mjs
├── components.json                      # Config shadcn-ui
├── supabase-setup.sql                   # Script SQL inicial (tablas + RLS)
├── BACKEND_SPEC.md                      # Especificación detallada del backend (referencia)
├── BACKEND_TESTING.md                   # Guía de testing del backend (referencia)
├── README.md · LICENSE.md
└── package.json (Next 16, React 19, FFmpeg.wasm, Three, GSAP, Framer)
```

---

## 5. Núcleo del editor

### 5.1 `app/components/ui/editor/` — Componentes principales

| Componente | Rol |
|---|---|
| `VideoCanvas.tsx` (~2400 líneas) | **Canvas principal**. Maneja `<video>` + `<canvas>` de export + `CanvasElementsLayer` + `MockupWrapper` + `Phone3DViewer` (dynamic, ssr:false). Expone `VideoCanvasHandle` (getExportCanvas/drawFrame/getPreviewContainer/clearAllSelection/restoreSelectionState) vía `forwardRef`. Lee `MotionContext` para phone overlay. Implementa `drawFrame` que renderiza a canvas con zoom 3D, mockup frame, video mask, canvas elements, camera overlay, motion phone bezel. Drag/rotate handles para video transform. |
| `CanvasElementsLayer.tsx` | Capa de elementos (shapes, text, SVG, imágenes) sobre el canvas; inline text editor Figma-style. |
| `Timeline.tsx` | Timeline con trim, video clips, zoom fragments, audio tracks. Pan via framer-motion, ghosts en drag. |
| `PlayerControls.tsx` | Transport: play/pause, skip ±5s, aspect ratio, crop, zoom level, fullscreen, video mask editor. |
| `EditorTopBar.tsx` | Logo, undo/redo, export dropdown (video/image), user menu, alert de export error. |
| `ToolsSidebar.tsx` | Sidebar vertical con tools: screenshot, mockup, motion, zoom, audio, videos, camera, cursor, elements, history. |
| `MobileToolsMenu.tsx` | Menú de tools en mobile (Dialog bottom sheet). |
| `MobileControlPanel.tsx` | ControlPanel en mobile via Dialog bottom sheet. |
| `ControlPanel.tsx` | Panel reactivo principal (lazy-loaded, muchos sub-skeletons). Cambia contenido según `activeTool`. |
| `LabelSidebar.tsx` | Etiquetas laterales (Video/Zoom/Audio) en el timeline. |
| `MockupMenu.tsx` + `mockups/*` | Selector de mockups por categoría + renderers. |
| `MotionMenu.tsx` + `ImageMotionMenu.tsx` + `templates-motion/Phone.tsx` | Plantillas motion (phone) para video e image mode. |
| `CameraMenu.tsx` | Configuración de camera overlay (shape, corner, size, mirror). |
| `Phone3DViewer.tsx` (~836 líneas) | Three.js viewer para el phone overlay con GSAP master timeline. |
| `FloatingCameraPreview.tsx` | Preview flotante arrastrable de la cámara (sidebar). |
| `ZoomFragmentEditor.tsx` / `ZoomFragmentTrackItem.tsx` / `ZoomGlobalConfig.tsx` | Editor de focus point + track item + lista global. |
| `AudioMenu.tsx` / `AudioFragmentTrackItem.tsx` / `AudioTrimModal.tsx` | Multi-track de audio (max 5). |
| `VideoClipTrackItem.tsx` / `VideoCropperModal.tsx` / `VideosMenu.tsx` | Clips de video (multi-clip) + cropper + library. |
| `ImageCropperModal.tsx` / `ImageMaskEditor.tsx` / `GetMediaMaskStyles.tsx` | Crop + mask + helpers. |
| `ElementsMenu.tsx` (3 tabs: text/elements/uploads) | Shapes, SVG, imágenes, texto. |
| `CursorMenu.tsx` | Configuración del cursor (style, color, size, click effect). |
| `LayersPanel.tsx` (~927 líneas) | Panel de capas con drag-reorder, lock, hide, group/ungroup, multi-select. |
| `HistoryMenu.tsx` | Lista de proyectos de imagen (modo photo). |
| `ContextMenu.tsx` | Menú contextual de las capas (bring to front, send to back, group, delete). |
| `EditorHoverTooltip.tsx` | Tooltip on-canvas con shortcuts (Ctrl+Scroll zoom, Ctrl+V paste). |
| `PhotoEditorPlaceholder.tsx` | Placeholder del editor de foto (debajo del canvas en photo mode). |
| `PlaceholderEditor.tsx` | Placeholder inicial antes de subir archivo. |
| `Skeleton.tsx` | Skeletons de carga para cada menu. |
| `CanvasElementsLayer.tsx` | Capa DOM de elementos con text editor inline. |

### 5.2 `app/[locale]/(editor)/editor/page.tsx` — Orquestador (~3000 líneas)

El componente `Editor` raíz coordina todo el estado y los hooks del editor:

**Estados principales** (todos como `useState`):
- Editor mode: `useEditorMode` lee `?mode=` de URL
- Auth: `useAuth`
- Undo/Redo: `useUndoRedo<EditorState>` (centralizado, sincroniza con `editorState` en `useEffect`)
- Image state: `imageUrl`, `imageRef`, `imageExportProgress`
- Capture: `useScreenCapture`
- Image projects: `useImageProjects` (IndexedDB)
- 3D preview: `imageTransform`, `apply3DToBackground`
- **UI state**: `activeTool`, `backgroundTab`, `selectedWallpaper`, `backgroundBlur`, `padding`, `roundedCorners`, `shadows`, `isControlPanelOpen`
- **Video transform**: `videoTransform` (rotation, translateX, translateY)
- **Uploaded images**: array + LocalStorage sync
- **Background color/gradient**: `backgroundColorConfig`
- **Aspect ratio**: `aspectRatio`, `customDimensions`, `isFullscreen`, `cropArea`
- **Video state**: `videoUrl`, `videoId`, `videoDuration`, `currentTime`, `isPlaying`
- **Timeline state**: `timelineZoom`, `isDraggingPlayhead`, `trimRange`, `scrubTime`
- **Zoom fragments**: `zoomFragments`, `selectedZoomFragmentId`
- **Mockup state**: `mockupId`, `mockupConfig`
- **Canvas elements**: `canvasElements`, `selectedElementId`
- **Audio state**: `uploadedAudios`, `audioTracks`, `muteOriginalAudio`, `masterVolume`, `selectedAudioTrackId`
- **Video clips (multi-video)**: `videoClips`, `videosLibraryRefresh`, blobs/urls en refs
- **Camera state**: `cameraConfig`, `cameraUrl`

**Refs clave** (múltiples `useRef`):
- `videoRef`, `canvasRef`, `editorAreaRef`
- `zoomFragmentsRef`, `videoClipsRef`, `muteOriginalAudioRef` (evitar stale closures)
- `videoBlobsRef`, `videoUrlsRef`, `activeClipIdRef`, `activeClipDataRef`
- `clipAudioStateRef`, `audioElementsRef`
- `clipSwitchTimeRef`, `isSeekingToClipRef`, `isSwitchingClipRef`, `justEndedRef`
- `multiDragStartRef`, `wasDragRef`, `pendingCollapseRef`
- `animationFrameRef`, `updateTimeSmoothRef`

**Flujo crítico de playback (multi-clip)** (`page.tsx:2042-2247`):
1. `updateTimeSmoothRef` corre en `requestAnimationFrame` mientras `isPlaying`.
2. Detecta clip activo con `getClipAtTime(videoClips, timelineTime)`.
3. Si cambia el clip: pausa, swap de `videoRef.current.src` al nuevo clip, espera `canplay`, seek a `clipTime`, play.
4. Si llega al `trimEnd`: pasa al siguiente clip o pausa.
5. Sincroniza `audioElements` con `syncAudioPlayback(timelineTime, playing)`.

**Auto-save (modo foto)**: `autoSaveCurrentProject` con debounce 3s → `saveCurrentProject` con todo el estado.

**Export** (`handleExport`, `page.tsx:1352-1461`):
1. Log del "Recipe JSON" para tests del backend (no se envía — solo debug).
2. Llama `exportVideo({ quality, videoBlob, transparentBackground, trim, muteOriginalAudio, audioTracks, masterVolume, videoClips, videoClipBlobs, clipAudioStates })`.
3. `useVideoExport` orquesta: prepara canvas, codifica con MediaBunny, mezcla audio con FFmpeg.wasm, descarga blob.

**Keyboard shortcuts** (`page.tsx:1981-2009`, `2660-2735`):
- `Ctrl/Cmd+Z` undo, `Ctrl/Cmd+Shift+Z` / `Ctrl/Cmd+Y` redo
- `T` text tool (crosshair para colocar texto)
- `Ctrl/Cmd+C/V` copy/paste elementos
- `Delete/Backspace` eliminar selección (elemento/video clip/audio track/zoom fragment)
- `Escape` deseleccionar
- `Space/K` play/pause (en `PlayerControls`)
- `Ctrl+V` paste image (solo photo mode)
- Alt+S start recording, Alt+D stop recording (en `RecordingContext`)

**Render**:
```jsx
<div className="flex flex-col h-screen">
  <div className="flex flex-1">
    <ToolsSidebar ... />
    <AnimatePresence><ControlPanel ... /></AnimatePresence>
    <div ref={editorAreaRef}>
      <VideoCanvas ... layersPanelToolbar={<EditorTopBar ... />} />
      {isVideoMode && (
        <PlayerControls ... />
        <Timeline ... />
      )}
      {isPhotoMode && <PhotoEditorPlaceholder ... />}
    </div>
  </div>
  <MobileToolsMenu ... />
  <MobileControlPanel ... />
</div>
```

### 5.3 Contexts y providers

- **`MotionContext`** (`app/contexts/MotionContext.tsx`) — state global de motion templates, intensity, style, animMode, image phone X/Y/scale/rotation, device. Hook `useMotionContext`.
- **`AuthProvider`** (`app/contexts/useAuth.tsx`) — sesión Supabase + user profile.
- **`RecordingProvider`** (`app/contexts/RecordingContext.tsx`) — wrapper de `useScreenRecording` con shortcuts Alt+S/Alt+D.
- **`TooltipProvider`** (`components/ui/tooltip.tsx`) — Radix tooltip con `delayDuration={200}`.
- **`NextIntlClientProvider`** en `[locale]/layout.tsx` para i18n.

Orden de providers en `app/[locale]/(editor)/layout.tsx`:
```jsx
<AuthProvider>
  <RecordingProvider>
    <MotionProvider>
      <div>{children}</div>
    </MotionProvider>
    <RecordingOverlay />
  </RecordingProvider>
</AuthProvider>
```

### 5.4 Hooks destacados

- **`useUndoRedo<T>(initialState)`** — history stack (past/present/future) con `MAX_HISTORY_SIZE=50`. `setState` con `skipHistory` flag.
- **`useEditorMode`** — lee `?mode=` de URL, expone `isVideoMode`/`isPhotoMode`/`setMode`.
- **`useVideoExport(videoRef, canvasRef)`** — pipeline de export con MediaBunny + FFmpeg.wasm. Maneja cancellation token.
- **`useVideoThumbnails(url, duration, options)`** — genera thumbnails cada 0.1s, calidad "low"/"high".
- **`useImageProjects`** — CRUD de proyectos de imagen en IndexedDB (auto-save 3s).
- **`useScreenRecording`** — estado de grabación, countdown, camera stream, cursor data.

---

## 6. Subproyecto `openvid-back/` (referencia)

Servicio independiente para renderizado headless en servidor (NestJS + BullMQ + Redis + Remotion + Prisma + Supabase). Existe como referencia/contrato; el editor funciona sin él. Ver `BACKEND_SPEC.md`/`BACKEND_TESTING.md` si se necesita profundizar.

---

## 7. Scripts

### Frontend (raíz)
```bash
pnpm install
pnpm dev      # next dev
pnpm build    # next build
pnpm start    # next start
pnpm lint     # eslint
```

### `openvid-back/` (referencia, opcional)
```bash
pnpm install
pnpm start:dev          # nest start --watch
pnpm build              # nest build
pnpm start:prod         # node dist/main
pnpm test / test:e2e / test:cov
pnpm lint / format
```

---

## 8. Variables de entorno

- **Frontend**: ver `.env.example` (credenciales Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, claves de Unsplash/Pexels/Pixabay en `app/config/env.ts`).
- **`openvid-back/`** (referencia): `openvid-back/docker/.env.example` (Redis, Supabase service role, Storage buckets, DATABASE_URL para Prisma/Postgres).

---

## 9. Notas útiles para trabajar en el código

### Arquitectura general
- **App Router con route groups**: `(auth)`, `(editor)`, `(home)`, `(legal)` agrupan layouts sin afectar la URL.
- **Editor monolítico**: `page.tsx` del editor es ~3000 líneas — la mayoría es state local y handlers. Los subcomponentes (`VideoCanvas`, `Timeline`, `ControlPanel`) son los que tienen la lógica pesada.
- **Lazy loading**: `ControlPanel`, `Timeline`, `ExportOverlay`, `VideoCropperModal`, `ImageCropperModal`, `PhotoEditorPlaceholder`, y muchos menús dentro de `ControlPanel` usan `lazy()` o `dynamic()` con `ssr: false` para reducir bundle inicial.

### Patrones de código
- **Headers COOP/COEP** se setean globalmente en `next.config.ts` — necesarios para FFmpeg.wasm con `SharedArrayBuffer`.
- **Tres cachés IndexedDB distintas** (no mezclar):
  - `videos-library.ts` → `openvid-videos-library` (DB_VERSION 3): biblioteca persistente con thumbnails, audio flags.
  - `video-upload-cache.ts` → `openvid-uploaded-videos` (DB_VERSION 2): tránsito tras upload desde landing.
  - `useScreenRecording` → DB propia para `currentVideo` (cleanup 7 días).
- **Mockups duplicados a propósito**: cada mockup vive como React (`app/components/ui/editor/mockups/*.tsx`) y como canvas renderer (`lib/mockup-canvas/*.ts`) para preview en DOM y export a canvas/video. El catálogo compartido está en `lib/mockup-data.tsx` (lista MOCKUPS).
- **Fidelidad visual**: el `VideoCanvas.drawFrame` debe reproducir fielmente lo que se ve en el DOM. Cualquier cambio en un mockup React debe reflejarse en su contraparte canvas.
- **`VIDEO_Z_INDEX = 1000`**: cualquier elemento con `zIndex < 1000` va detrás del video, `>= 1000` delante. Usar `bringToFront`/`sendToBack` que respetan este límite.
- **Tipos por feature**: cada dominio (zoom, mockup, audio, camera, ...) tiene su propio `*.types.ts` en `types/`; el barrel `types/index.ts` reexporta.
- **shadcn-ui** está activo (`components.json`) — primitives en `components/ui/`. Para nuevos componentes usar `npx shadcn@latest add <name>`.
- **Idioma por defecto**: `es` (ver `i18n.ts`). Todos los textos visibles usan `useTranslations("namespace")` de `next-intl`.
- **Refs vs State**: el editor usa muchos `useRef` para evitar stale closures en `requestAnimationFrame`, drag handlers, y event listeners globales.
- **i18n keys**: están en `messages/{es,en,ru}.json` — agregar clave en los 3 al añadir un texto nuevo.
- **Animaciones GSAP**: se registran plugins (`ScrollTrigger` en home, `GLTFLoader` en Phone3DViewer) — limpiar con `gsap.matchMedia()` o `killTweensOf`.
- **Three.js singleton**: `lib/perspective3d.ts` mantiene un único `WebGLRenderer`/`Scene`/`Camera` reutilizado entre renders; llamar `disposePerspective3D()` en cleanup.
- **Framer Motion**: usado para AnimatePresence (panel open/close, export overlay, hover).
- **Atropos**: solo en `EditorPreview.tsx` (home) para parallax 3D.
- **Swapy**: instalado pero no usado actualmente (en `package.json`).

### Estructura de un mockup nuevo
1. Crear componente React en `app/components/ui/editor/mockups/{name}Mockup.tsx`.
2. Crear renderer canvas en `lib/mockup-canvas/{name}.ts` (misma forma de API).
3. Agregar preview React en `lib/mockup-previews.tsx`.
4. Registrar en `MOCKUPS` (`lib/mockup-data.tsx`) con `id`, `name`, `category`, `features`, `defaultConfig`, `preview`.
5. Agregar a `BOTTOM_ONLY_RADIUS_MOCKUPS` o `SELF_SHADOWING_MOCKUPS` en `lib/constants.ts` si necesita tratamiento especial de border-radius/shadow.
6. Verificar que `MockupWrapper.tsx` lo importe.

### Estructura de un motion template nuevo
1. Definir `MotionTemplate` en `app/components/ui/editor/templates-motion/{name}.tsx` con `script: ScriptFn` (función que devuelve `gsap.core.Timeline`).
2. Registrar en `lib/template-registry.ts` (descomentar línea correspondiente).
3. Si tiene panel de edición, exponer `EditorPanel` en el template.

### Estructura de un nuevo tool en el sidebar
1. Agregar el tool al union type `Tool` en `types/editor.types.ts`.
2. Agregar la entrada en `ToolsSidebar.tsx` (icono + handler + scroll ref).
3. Si necesita panel propio, agregar un componente lazy en `ControlPanel.tsx` con su `Skeleton`.
