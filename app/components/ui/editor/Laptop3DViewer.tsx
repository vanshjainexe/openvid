"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  createCoverScreenCanvas,
  applyCropToImage,
  parseShadowColor,
  type ImageMaskConfigLike,
} from "@/lib/phone3d.utils";

const LAPTOP_W = 1500;
const LAPTOP_H = 1035;
const RENDER_MULTIPLIER = 2;
const RENDER_W = LAPTOP_W * RENDER_MULTIPLIER;
const RENDER_H = LAPTOP_H * RENDER_MULTIPLIER;

const CAM_FOV = 40;
const CAM_RADIUS = 75;

const screenSize: [number, number] = [29.4, 20];
const LID_CLOSED_X = Math.PI * 0.5;
const LID_OPEN_X = -0.2 * Math.PI;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const DAMPING_FACTOR = 0.08;

const THETA_SPEED = (2 * Math.PI) / LAPTOP_W / 7;
const PHI_SPEED = Math.PI / LAPTOP_H / 7;

export interface Laptop3DApi {
  renderAt: (width: number, height: number) => void;
}

interface Props {
  imageUrl?: string | null;
  imageMaskConfig?: ImageMaskConfigLike | null;
  cropArea?: { x: number; y: number; width: number; height: number } | null;
  openingProgress?: number;
  initialRotationX?: number;
  initialRotationY?: number;
  initialRotationZ?: number;
  onRotationChange?: (rx: number, ry: number) => void;
  onMount?: (canvas: HTMLCanvasElement) => void;
  onApi?: (api: Laptop3DApi | null) => void;
  scale?: number;
  zoom?: number;
  shadowIntensity?: number;
  shadowColor?: string;
}

// ─── GLB cache ────────────────────────────────────────────────────────────────
let gltfCachePromise: Promise<THREE.Group> | null = null;
function loadLaptopGltf(): Promise<THREE.Group> {
  if (!gltfCachePromise) {
    gltfCachePromise = new Promise<THREE.Group>((resolve, reject) =>
      new GLTFLoader().load(
        "/models/mac-book.glb",
        (gltf) => resolve(gltf.scene as THREE.Group),
        undefined,
        reject
      )
    );
  }
  return gltfCachePromise;
}

// ─── Angle helpers ────────────────────────────────────────────────────────────
function anglesFromInitial(rx: number, ry: number, radius: number): THREE.Vector3 {
  const DEG = Math.PI / 180;
  const phi = Math.PI / 2 - rx * DEG;
  const theta = ry * DEG;
  return new THREE.Vector3().setFromSphericalCoords(radius, phi, theta);
}

function rxRyFromCamera(camPos: THREE.Vector3): { rx: number; ry: number } {
  const sph = new THREE.Spherical().setFromVector3(camPos);
  const rx = (Math.PI / 2 - sph.phi) * (180 / Math.PI);
  const ry = sph.theta * (180 / Math.PI);
  return { rx, ry };
}

export function Laptop3DViewer({
  imageUrl = null,
  openingProgress = 1,
  imageMaskConfig = null,
  cropArea = null,
  initialRotationX = 0,
  initialRotationY = 0,
  initialRotationZ = 0,
  onRotationChange,
  onMount,
  onApi,
  scale = 1,
  zoom = 1,
  shadowIntensity = 0,
  shadowColor = "#000000",
}: Props) {
  const webglRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const macGroupRef = useRef<THREE.Group | null>(null);
  const lidGroupRef = useRef<THREE.Group | null>(null);
  const screenMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const lightHolderRef = useRef<THREE.Group | null>(null);
  const imageUrlRef = useRef<string | null>(imageUrl);
  const lastLoadedUrlRef = useRef<string | null>(null);
  const lastLoadedCropKeyRef = useRef<string | null>(null);
  const cropAreaRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const imageMaskConfigRef = useRef<ImageMaskConfigLike | null>(imageMaskConfig);
  const openingProgressRef = useRef<number>(openingProgress);
  const onRotationChangeRef = useRef(onRotationChange);
  const onMountRef = useRef(onMount);
  const onApiRef = useRef(onApi);
  const zoomRef = useRef(zoom);

  const camPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, CAM_RADIUS / zoom));
  const camTargetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, CAM_RADIUS / zoom));
  const velRef = useRef<{ dTheta: number; dPhi: number }>({ dTheta: 0, dPhi: 0 });
  const lastPxRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const [grabbing, setGrabbing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Sync refs
  useEffect(() => { onRotationChangeRef.current = onRotationChange; }, [onRotationChange]);
  useEffect(() => { onMountRef.current = onMount; }, [onMount]);
  useEffect(() => { onApiRef.current = onApi; }, [onApi]);
  useEffect(() => { imageUrlRef.current = imageUrl; }, [imageUrl]);
  useEffect(() => { openingProgressRef.current = openingProgress; }, [openingProgress]);
  useEffect(() => {
    imageMaskConfigRef.current = imageMaskConfig;
    lastLoadedUrlRef.current = null;
  }, [imageMaskConfig]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { cropAreaRef.current = cropArea ?? null; }, [cropArea]);

  // ── Lid + screen opacity ──────────────────────────────────────────────────
  const applyLid = useCallback(() => {
    const lid = lidGroupRef.current;
    const mat = screenMaterialRef.current;
    if (!lid || !mat) return;
    const t = Math.max(0, Math.min(1, openingProgressRef.current));
    lid.rotation.x = lerp(LID_CLOSED_X, LID_OPEN_X, t);
    mat.opacity = 0.96 * t;
  }, []);

  // ── Screen texture ────────────────────────────────────────────────────────
  const loadScreenTexture = useCallback((
    url: string,
    mat: THREE.MeshBasicMaterial,
    renderer: THREE.WebGLRenderer
  ) => {
    // Skip si ya cargamos esta URL con el mismo crop
    const cropKey = cropAreaRef.current ? JSON.stringify(cropAreaRef.current) : null;
    if (lastLoadedUrlRef.current === url && lastLoadedCropKeyRef.current === cropKey) return;
    lastLoadedUrlRef.current = url;
    lastLoadedCropKeyRef.current = cropKey;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const TEX_W = RENDER_W * 2;
      const TEX_H = RENDER_H * 2;
      // Aplica el crop antes del cover-fit
      const cropped = applyCropToImage(img, cropAreaRef.current);
      const cover = createCoverScreenCanvas(cropped, TEX_W, TEX_H, 0, imageMaskConfigRef.current);
      if (mat.map) mat.map.dispose();
      const tex = new THREE.CanvasTexture(cover);
      tex.flipY = false;
      tex.wrapS = THREE.RepeatWrapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      if (cover.width && cover.height) {
        tex.repeat.y = (cover.width / cover.height) / screenSize[0] * screenSize[1];
      }
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      mat.map = tex;
      mat.needsUpdate = true;
      lastLoadedUrlRef.current = url;
    };
    img.onerror = () => { lastLoadedUrlRef.current = url; };
    img.src = url;
  }, []);

  // ── Main Three.js setup ───────────────────────────────────────────────────
  useEffect(() => {
    const container = webglRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const radius = CAM_RADIUS / zoom;
    const initPos = anglesFromInitial(initialRotationX, initialRotationY, radius);
    camPosRef.current.copy(initPos);
    camTargetRef.current.copy(initPos);

    const camera = new THREE.PerspectiveCamera(CAM_FOV, RENDER_W / RENDER_H, 10, 1000);
    camera.position.copy(initPos);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // ── Lighting ──────────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 3.2));

    const lightHolder = new THREE.Group();
    scene.add(lightHolder);
    lightHolderRef.current = lightHolder;

    const mainLight = new THREE.PointLight(0xfff5e1, 0.8);
    mainLight.position.set(0, 5, 50);
    lightHolder.add(mainLight);

    const dl1 = new THREE.DirectionalLight(0xffffff, 2.6);
    dl1.position.set(4, 8, 7);
    scene.add(dl1);

    const dl2 = new THREE.DirectionalLight(0xaabbff, 0.8);
    dl2.position.set(-5, -2, 4);
    scene.add(dl2);

    const dl3 = new THREE.DirectionalLight(0xffffff, 1.3);
    dl3.position.set(0, -6, 6);
    scene.add(dl3);

    // ── Materials ─────────────────────────────────────────────────────────────
    const darkPlasticMaterial = new THREE.MeshStandardMaterial({
      color: 0x000000, roughness: 0.9, metalness: 0.9,
    });
    const cameraMaterial = new THREE.MeshBasicMaterial({ color: 0x333333 });
    const logoMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const baseMetalMaterial = new THREE.MeshStandardMaterial({
      color: 0xcecfd3, roughness: 0.25, metalness: 0.85,
    });
    const screenMaterial = new THREE.MeshBasicMaterial({
      map: null, transparent: true, opacity: 0, side: THREE.BackSide,
    });
    screenMaterialRef.current = screenMaterial;

    const textLoader = new THREE.TextureLoader();
    const keyboardMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true,
    });
    textLoader.load("/images/pages/keyboard-overlay.png", (tex) => {
      keyboardMaterial.alphaMap = tex;
      keyboardMaterial.needsUpdate = true;
    });

    // ── Renderer ──────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({
      antialias: true, alpha: true, preserveDrawingBuffer: true,
    });
    const DPR = Math.min(window.devicePixelRatio || 1, 3);
    renderer.setPixelRatio(DPR);
    renderer.setSize(RENDER_W, RENDER_H, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5;
    rendererRef.current = renderer;

    const canvas = renderer.domElement;
    // Simple absolute positioning — same as v2. The parent container uses
    // overflow:visible so rotated geometry is never clipped.
    canvas.style.cssText = `position:absolute;top:0;left:0;width:${LAPTOP_W}px;height:${LAPTOP_H}px;pointer-events:none`;
    container.appendChild(canvas);
    onMountRef.current?.(canvas);

    // ── Load GLB ──────────────────────────────────────────────────────────────
    loadLaptopGltf().then((gltf) => {
      const root = gltf.clone(true);
      root.position.z = -10;
      root.rotation.set(0, 0, initialRotationZ * (Math.PI / 180));
      scene.add(root);
      macGroupRef.current = root;

      const lidGroup = new THREE.Group();
      const bottomGroup = new THREE.Group();

      ;[...root.children].forEach((child) => {
        if (child.name === "_top") {
          lidGroup.add(child);
          ;[...child.children].forEach((obj) => {
            if (!(obj instanceof THREE.Mesh)) return;
            const m = obj as THREE.Mesh;
            if (m.name === "lid") m.material = baseMetalMaterial;
            else if (m.name === "logo") m.material = logoMaterial;
            else if (m.name === "screen-frame") m.material = darkPlasticMaterial;
            else if (m.name === "camera") m.material = cameraMaterial;
          });
        } else if (child.name === "_bottom") {
          bottomGroup.add(child);
          ;[...child.children].forEach((obj) => {
            if (!(obj instanceof THREE.Mesh)) return;
            const m = obj as THREE.Mesh;
            if (m.name === "base") m.material = baseMetalMaterial;
            else if (["legs", "keyboard", "inner"].includes(m.name))
              m.material = darkPlasticMaterial;
          });
        }
      });

      root.add(lidGroup);
      root.add(bottomGroup);
      lidGroupRef.current = lidGroup;

      const screenMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(screenSize[0], screenSize[1]),
        screenMaterial
      );
      screenMesh.position.set(0, 10.5, -0.11);
      screenMesh.rotation.set(Math.PI, 0, 0);
      lidGroup.add(screenMesh);

      const darkScreen = new THREE.Mesh(
        new THREE.PlaneGeometry(screenSize[0], screenSize[1]),
        darkPlasticMaterial
      );
      darkScreen.position.set(0, 10.5, -0.111);
      darkScreen.rotation.set(Math.PI, Math.PI, 0);
      lidGroup.add(darkScreen);

      const keyboardKeys = new THREE.Mesh(
        new THREE.PlaneGeometry(27.7, 11.6),
        keyboardMaterial
      );
      keyboardKeys.rotation.set(-0.5 * Math.PI, 0, 0);
      keyboardKeys.position.set(0, 0.045, 7.21);
      bottomGroup.add(keyboardKeys);

      if (imageUrlRef.current) {
        loadScreenTexture(imageUrlRef.current, screenMaterial, renderer);
      }
      applyLid();
      setLoaded(true);
    }).catch((err) => {
      console.error("Error al cargar el GLB del laptop:", err);
    });

    // ── Render loop with inertia ──────────────────────────────────────────────
    let raf = 0;
    const EPS = 1e-6;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const vel = velRef.current;

      if (Math.abs(vel.dTheta) > EPS || Math.abs(vel.dPhi) > EPS) {
        const sph = new THREE.Spherical().setFromVector3(camPosRef.current);
        sph.theta += vel.dTheta;
        sph.phi = Math.max(0.05, Math.min(Math.PI - 0.05, sph.phi + vel.dPhi));
        sph.radius = CAM_RADIUS / zoomRef.current;

        camPosRef.current.setFromSpherical(sph);
        camera.position.copy(camPosRef.current);
        camera.lookAt(0, 0, 0);

        vel.dTheta *= (1 - DAMPING_FACTOR);
        vel.dPhi *= (1 - DAMPING_FACTOR);

        if (Math.abs(vel.dTheta) < EPS) vel.dTheta = 0;
        if (Math.abs(vel.dPhi) < EPS) vel.dPhi = 0;
      }

      if (lightHolderRef.current) {
        lightHolderRef.current.quaternion.copy(camera.quaternion);
      }

      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      onApiRef.current?.(null);
      renderer.dispose();
      if (container.contains(canvas)) container.removeChild(canvas);
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      macGroupRef.current = null;
      lidGroupRef.current = null;
      screenMaterialRef.current = null;
      lightHolderRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync initialRotation props → camera ──────────────────────────────────
  useEffect(() => {
    const radius = CAM_RADIUS / zoom;
    const newPos = anglesFromInitial(initialRotationX, initialRotationY, radius);
    velRef.current = { dTheta: 0, dPhi: 0 };
    camPosRef.current.copy(newPos);
    camTargetRef.current.copy(newPos);
    const cam = cameraRef.current;
    if (cam) { cam.position.copy(newPos); cam.lookAt(0, 0, 0); }
  }, [initialRotationX, initialRotationY, zoom]);

  // ── Sync rotationZ → group ────────────────────────────────────────────────
  useEffect(() => {
    const group = macGroupRef.current;
    if (group) group.rotation.z = initialRotationZ * (Math.PI / 180);
  }, [initialRotationZ]);

  // ── Sync openingProgress → lid ────────────────────────────────────────────
  useEffect(() => {
    openingProgressRef.current = openingProgress;
    applyLid();
  }, [openingProgress, applyLid]);

  // ── Reload screen texture ─────────────────────────────────────────────────
  useEffect(() => {
    const mat = screenMaterialRef.current;
    const renderer = rendererRef.current;
    if (!mat || !renderer || !imageUrl) return;
    if (lastLoadedUrlRef.current === imageUrl) return;
    loadScreenTexture(imageUrl, mat, renderer);
  }, [imageUrl, loadScreenTexture]);

  // ── renderAt API ──────────────────────────────────────────────────────────
  useEffect(() => {
    const api: Laptop3DApi = {
      renderAt: (w, h) => {
        const renderer = rendererRef.current;
        const camera = cameraRef.current;
        const scene = sceneRef.current;
        if (!renderer || !camera || !scene) return;
        const oldAspect = camera.aspect;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
        renderer.render(scene, camera);
        camera.aspect = oldAspect;
        camera.updateProjectionMatrix();
        renderer.setSize(RENDER_W, RENDER_H, false);
      },
    };
    onApiRef.current?.(api);
    return () => onApiRef.current?.(null);
  }, []);

  // ── Pointer drag ──────────────────────────────────────────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    setGrabbing(true);
    lastPxRef.current = { x: e.clientX, y: e.clientY };
    velRef.current = { dTheta: 0, dPhi: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastPxRef.current.x;
    const dy = e.clientY - lastPxRef.current.y;
    lastPxRef.current = { x: e.clientX, y: e.clientY };
    velRef.current.dTheta -= dx * THETA_SPEED;
    velRef.current.dPhi -= dy * PHI_SPEED;
  }, []);

  const onPointerUp = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setGrabbing(false);
    const { rx, ry } = rxRyFromCamera(camPosRef.current);
    onRotationChangeRef.current?.(rx, ry);
  }, []);

  const t = Math.max(0, Math.min(1, shadowIntensity));
  const tEased = t * t;
  const computedBlur = tEased * 60;
  const computedOpacity = tEased * 0.7;
  const shadowRgba = shadowColor.startsWith("#")
    ? parseShadowColor(shadowColor, computedOpacity)
    : shadowColor;
  const hasShadow = t > 0.01;

  return (
    <div
      style={{
        display: "inline-block",
        transformOrigin: "top center",
        transform: `scale(${scale})`,
        width: LAPTOP_W,
        height: LAPTOP_H + (hasShadow ? computedBlur * 0.8 : 0),
        marginTop: "250px",
      }}
    >
      <div
        style={{
          position: "relative",
          width: LAPTOP_W,
          height: LAPTOP_H,
          overflow: "visible",
          willChange: "transform",
        }}
      >
        {/* Ground shadow ellipse */}
        {hasShadow && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              bottom: -(computedBlur * 0.5),
              left: `${10 + tEased * 5}%`,
              width: `${80 - tEased * 10}%`,
              height: Math.max(4, computedBlur * 0.55),
              borderRadius: "50%",
              background: shadowRgba,
              filter: `blur(${Math.max(2, computedBlur * 0.6)}px)`,
              zIndex: 0,
              pointerEvents: "none",
            }}
          />
        )}

        {/* WebGL canvas container — overflow:visible lets model exceed bounds */}
        <div
          ref={webglRef}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: LAPTOP_W,
            height: LAPTOP_H,
            overflow: "visible",
            pointerEvents: "none",
            zIndex: 2,
            filter: hasShadow
              ? `drop-shadow(0px ${(tEased * 22).toFixed(1)}px ${(tEased * 32).toFixed(1)}px ${shadowRgba})`
              : "none",
            transition: "filter 0.15s ease",
          }}
        />

        {/* Drag interaction layer */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 3,
            cursor: grabbing ? "grabbing" : "grab",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        />

        {!loaded && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ zIndex: 4 }}
          >
            <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}