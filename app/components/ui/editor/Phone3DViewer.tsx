"use client";

/**
 * Phone3DViewer — R3F + drei + OrbitControls edition
 *
 * Key architectural fixes in this version:
 *
 *  A. rootRef / cameraRef are now created INSIDE each scene component
 *     (not passed down from Phone3DViewer). This means every Canvas remount
 *     gets completely fresh refs — no stale WebGL objects from a previous
 *     context leak through.
 *
 *  B. Canvas key=modelUrl forces a full remount on device switch, which is
 *     the cleanest way to get a fresh WebGL context. Combined with (A), this
 *     eliminates the white-flash-then-disappear bug on first load.
 *
 *  C. Scale factor calculation uses the camera frustum correctly.
 *
 *  D. Orbit initial position is applied via Promise.resolve() microtask
 *     after root.add(group) — OrbitControls is mounted by R3F by then.
 */

import { Canvas, useThree } from "@react-three/fiber";
import {
  PerspectiveCamera,
  useGLTF,
  Environment,
  OrbitControls,
} from "@react-three/drei";
import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  PHONE_W,
  PHONE_H,
  deviceConfigs,
  getDeviceFromModelUrl,
  createCoverScreenCanvas,
  loadGltfGroup,
  cloneGroup,
  type ImageMaskConfigLike,
} from "@/lib/phone3d.utils";

export interface Phone3DApi {
  renderAt: (width: number, height: number) => void;
}

interface Props {
  imageUrl?: string | null;
  imageMaskConfig?: ImageMaskConfigLike | null;
  initialRotationX?: number;
  initialRotationY?: number;
  initialRotationZ?: number;
  onRotationChange?: (rx: number, ry: number) => void;
  onMount?: (canvas: HTMLCanvasElement) => void;
  onApi?: (api: Phone3DApi | null) => void;
  modelUrl?: string;
  scale?: number;
  zoom?: number;
  shadowIntensity?: number;
  shadowColor?: string;
}

const DEFAULT_CAM_Z = 1.5;

function parseShadowColor(hex: string, opacity: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.length === 3 ? h[0] + h[0] : h.slice(0, 2), 16);
  const g = parseInt(h.length === 3 ? h[1] + h[1] : h.slice(2, 4), 16);
  const b = parseInt(h.length === 3 ? h[2] + h[2] : h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${opacity.toFixed(3)})`;
}

function SharedLights() {
  return (
    <>
      <Environment preset="city" background={false} />
      <ambientLight intensity={0.3} />
      <directionalLight position={[3, 6, 5]} intensity={0.6} />
      <directionalLight position={[-4, -2, 3]} intensity={0.25} color="#c8d8ff" />
      <directionalLight position={[0, -5, 5]} intensity={0.35} />
    </>
  );
}

function applyMetalMaterial(m: THREE.MeshStandardMaterial, matName: string): void {
  if (matName.includes("Body")) { m.color.set(0x787878); m.roughness = 0.18; m.metalness = 0.85; m.envMapIntensity = 1.4; }
  if (matName.includes("Bezel")) { m.color.set(0x909090); m.roughness = 0.12; m.metalness = 0.92; m.envMapIntensity = 1.6; }
  if (matName.includes("Buttons")) { m.color.set(0x999999); m.roughness = 0.15; m.metalness = 0.88; m.envMapIntensity = 1.5; }
  if (matName.includes("Lenses")) { m.color.set(0x060608); m.roughness = 0.04; m.metalness = 0.70; m.envMapIntensity = 2.0; }
}

interface SceneProps {
  imageUrl: string | null;
  imageMaskConfig: ImageMaskConfigLike | null;
  initialRotationX: number;
  initialRotationY: number;
  initialRotationZ: number;
  zoom: number;
  onRotationChange?: (rx: number, ry: number) => void;
  onApi?: (api: Phone3DApi | null) => void;
  modelUrl?: string;
}

// ─── GltfModelScene — iphone 15 / samsung / iphone-13 ────────────────────────
function GltfModelScene({
  imageUrl,
  imageMaskConfig,
  initialRotationX,
  initialRotationY,
  initialRotationZ,
  zoom,
  onRotationChange,
  onApi,
  modelUrl,
}: SceneProps) {
  const rootRef = useRef<THREE.Group>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orbitRef = useRef<any>(null);
  const screenMatRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const lastLoadedUrlRef = useRef<string | null>(null);
  const setupDoneRef = useRef(false);

  const { gl, scene, camera } = useThree();
  const device = getDeviceFromModelUrl(modelUrl);
  const deviceConfig = deviceConfigs[device];
  const gltf = useGLTF(modelUrl!) as { scene: THREE.Group };

  // Stable refs so callbacks always see current values
  const imageUrlRef = useRef(imageUrl);
  const imageMaskConfigRef = useRef(imageMaskConfig);
  useEffect(() => { imageUrlRef.current = imageUrl; }, [imageUrl]);
  useEffect(() => { imageMaskConfigRef.current = imageMaskConfig; }, [imageMaskConfig]);

  const applyTexture = useCallback((mat: THREE.MeshBasicMaterial, url: string) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const TARGET_W = 2048;
      const TARGET_H = Math.round(TARGET_W / deviceConfig.aspectRatio);
      const cornerRadius = Math.round(TARGET_W * deviceConfig.cornerRadiusFactor);
      const cover = createCoverScreenCanvas(img, TARGET_W, TARGET_H, cornerRadius, imageMaskConfigRef.current);
      if (mat.map) { mat.map.dispose(); mat.map = null; }
      const tex = new THREE.CanvasTexture(cover);
      tex.flipY = true;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.anisotropy = gl.capabilities.getMaxAnisotropy();
      mat.map = tex;
      mat.color.set(0xffffff);
      mat.needsUpdate = true;
      lastLoadedUrlRef.current = url;
    };
    img.src = url;
  }, [deviceConfig, gl]);

  // One-time setup per Canvas mount
  useEffect(() => {
    if (setupDoneRef.current) return;
    setupDoneRef.current = true;

    const root = rootRef.current;
    if (!root) return;

    const group = gltf.scene.clone(true);
    const camZ = DEFAULT_CAM_Z / zoom;
    const box = new THREE.Box3().setFromObject(group);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const halfH = camZ * Math.tan((40 / 2) * (Math.PI / 180));
    const sf = (halfH * 2 * 0.8) / size.y;
    group.scale.setScalar(sf);
    group.position.copy(center).negate().multiplyScalar(sf);
    group.rotation.z = initialRotationZ * (Math.PI / 180);

    const planeH = 4.3 * deviceConfig.screenHeightFactor;
    const planeW = planeH * deviceConfig.aspectRatio;
    const mat = new THREE.MeshBasicMaterial({
      color: 0x111111, side: THREE.FrontSide,
      transparent: true, depthTest: false, depthWrite: false,
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(planeW, planeH), mat);
    plane.position.set(deviceConfig.screenOffset.x, deviceConfig.screenOffset.y, deviceConfig.screenOffset.z);
    plane.renderOrder = 10;
    group.add(plane);
    screenMatRef.current = mat;
    root.add(group);

    if (imageUrlRef.current) {
      applyTexture(mat, imageUrlRef.current);
    }

    // Microtask: OrbitControls is guaranteed mounted by R3F before this runs
    Promise.resolve().then(() => {
      const orbit = orbitRef.current;
      if (!orbit) return;
      orbit.object.position.setFromSphericalCoords(
        DEFAULT_CAM_Z / zoom,
        Math.PI / 2 - initialRotationX * (Math.PI / 180),
        initialRotationY * (Math.PI / 180),
      );
      orbit.update();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Texture sync on prop change
  useEffect(() => {
    const mat = screenMatRef.current;
    if (!mat) return;
    if (!imageUrl) {
      if (mat.map) { mat.map.dispose(); mat.map = null; mat.needsUpdate = true; }
      lastLoadedUrlRef.current = null;
      return;
    }
    if (lastLoadedUrlRef.current === imageUrl) return;
    applyTexture(mat, imageUrl);
  }, [imageUrl, imageMaskConfig, applyTexture]);

  // Orbit sync on prop change
  useEffect(() => {
    const orbit = orbitRef.current;
    if (!orbit) return;
    orbit.object.position.setFromSphericalCoords(
      DEFAULT_CAM_Z / zoom,
      Math.PI / 2 - initialRotationX * (Math.PI / 180),
      initialRotationY * (Math.PI / 180),
    );
    orbit.update();
  }, [initialRotationX, initialRotationY, zoom]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || root.children.length === 0) return;
    (root.children[0] as THREE.Group).rotation.z = initialRotationZ * (Math.PI / 180);
  }, [initialRotationZ]);

  useEffect(() => {
    const api: Phone3DApi = {
      renderAt: (width, height) => {
        const cam = camera as THREE.PerspectiveCamera;
        const oldAspect = cam.aspect;
        gl.setSize(width, height, false);
        cam.aspect = width / height;
        cam.updateProjectionMatrix();
        gl.clear();
        gl.render(scene, cam);
        gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3));
        gl.setSize(PHONE_W, PHONE_H, false);
        cam.aspect = oldAspect;
        cam.updateProjectionMatrix();
      },
    };
    onApi?.(api);
    return () => onApi?.(null);
  }, [onApi, gl, scene, camera]);

  return (
    <>
      <PerspectiveCamera makeDefault fov={40} near={0.01} far={100} position={[0, 0, DEFAULT_CAM_Z / zoom]} />
      <OrbitControls
        ref={orbitRef}
        enableZoom={false}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        onEnd={() => {
          const orbit = orbitRef.current;
          if (!orbit || !onRotationChange) return;
          onRotationChange(
            (Math.PI / 2 - orbit.getPolarAngle()) * (180 / Math.PI),
            orbit.getAzimuthalAngle() * (180 / Math.PI),
          );
        }}
      />
      <SharedLights />
      <group ref={rootRef} dispose={null} />
    </>
  );
}

// ─── DefaultPhoneModelScene — JSON phone ──────────────────────────────────────
function DefaultPhoneModelScene({
  imageUrl,
  imageMaskConfig,
  initialRotationX,
  initialRotationY,
  initialRotationZ,
  zoom,
  onRotationChange,
  onApi,
}: Omit<SceneProps, "modelUrl">) {
  const rootRef = useRef<THREE.Group>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orbitRef = useRef<any>(null);
  const screenMatRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const screenAspectRef = useRef<number>(0.459);
  const lastLoadedUrlRef = useRef<string | null>(null);
  const setupDoneRef = useRef(false);

  const { gl, scene, camera } = useThree();

  const imageUrlRef = useRef(imageUrl);
  const imageMaskConfigRef = useRef(imageMaskConfig);
  useEffect(() => { imageUrlRef.current = imageUrl; }, [imageUrl]);
  useEffect(() => { imageMaskConfigRef.current = imageMaskConfig; }, [imageMaskConfig]);

  const applyTexture = useCallback((mat: THREE.MeshBasicMaterial, url: string) => {
    const aspect = screenAspectRef.current;
    const TARGET_W = PHONE_W * 4;
    const TARGET_H = Math.round(TARGET_W / aspect);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const cover = createCoverScreenCanvas(img, TARGET_W, TARGET_H, 0, imageMaskConfigRef.current);
      if (mat.map) { mat.map.dispose(); mat.map = null; }
      const tex = new THREE.CanvasTexture(cover);
      tex.flipY = false;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.anisotropy = gl.capabilities.getMaxAnisotropy();
      mat.map = tex;
      mat.color.set(0xffffff);
      mat.needsUpdate = true;
      lastLoadedUrlRef.current = url;
    };
    img.src = url;
  }, [gl]);

  useEffect(() => {
    if (setupDoneRef.current) return;
    setupDoneRef.current = true;

    loadGltfGroup().then((cached) => {
      const root = rootRef.current;
      if (!root || root.children.length > 0) return;

      const group = cloneGroup(cached);
      const camZ = DEFAULT_CAM_Z / zoom;
      const box = new THREE.Box3().setFromObject(group);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const halfH = camZ * Math.tan((40 / 2) * (Math.PI / 180));
      const sf = (halfH * 2 * 0.8) / size.y;
      group.scale.setScalar(sf);
      group.position.copy(center).negate().multiplyScalar(sf);
      group.rotation.z = initialRotationZ * (Math.PI / 180);

      group.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        const mat = Array.isArray(child.material) ? child.material[0] : child.material;
        const matName = (mat as THREE.Material)?.name ?? "";
        const isScreen = matName === "Screen.editable" || child.name === "Screen";

        if (isScreen) {
          const meshBox = new THREE.Box3().setFromObject(child);
          const meshSize = meshBox.getSize(new THREE.Vector3());
          if (meshSize.x > 0 && meshSize.y > 0) screenAspectRef.current = meshSize.x / meshSize.y;
          const basicMat = new THREE.MeshBasicMaterial({
            color: 0x111111, side: THREE.FrontSide,
            transparent: true, depthTest: false, depthWrite: false,
          });
          child.material = basicMat;
          child.renderOrder = 10;
          screenMatRef.current = basicMat;
        } else if (!Array.isArray(child.material)) {
          const m = child.material as THREE.MeshStandardMaterial;
          if (m.isMeshStandardMaterial) applyMetalMaterial(m, matName);
        }
      });

      root.add(group);

      if (imageUrlRef.current && screenMatRef.current) {
        applyTexture(screenMatRef.current, imageUrlRef.current);
      }

      Promise.resolve().then(() => {
        const orbit = orbitRef.current;
        if (!orbit) return;
        orbit.object.position.setFromSphericalCoords(
          DEFAULT_CAM_Z / zoom,
          Math.PI / 2 - initialRotationX * (Math.PI / 180),
          initialRotationY * (Math.PI / 180),
        );
        orbit.update();
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const mat = screenMatRef.current;
    if (!mat) return;
    if (!imageUrl) {
      if (mat.map) { mat.map.dispose(); mat.map = null; mat.needsUpdate = true; }
      lastLoadedUrlRef.current = null;
      return;
    }
    if (lastLoadedUrlRef.current === imageUrl) return;
    applyTexture(mat, imageUrl);
  }, [imageUrl, imageMaskConfig, applyTexture]);

  useEffect(() => {
    const orbit = orbitRef.current;
    if (!orbit) return;
    orbit.object.position.setFromSphericalCoords(
      DEFAULT_CAM_Z / zoom,
      Math.PI / 2 - initialRotationX * (Math.PI / 180),
      initialRotationY * (Math.PI / 180),
    );
    orbit.update();
  }, [initialRotationX, initialRotationY, zoom]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || root.children.length === 0) return;
    (root.children[0] as THREE.Group).rotation.z = initialRotationZ * (Math.PI / 180);
  }, [initialRotationZ]);

  useEffect(() => {
    const api: Phone3DApi = {
      renderAt: (width, height) => {
        const cam = camera as THREE.PerspectiveCamera;
        const oldAspect = cam.aspect;
        gl.setSize(width, height, false);
        cam.aspect = width / height;
        cam.updateProjectionMatrix();
        gl.clear();
        gl.render(scene, cam);
        gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3));
        gl.setSize(PHONE_W, PHONE_H, false);
        cam.aspect = oldAspect;
        cam.updateProjectionMatrix();
      },
    };
    onApi?.(api);
    return () => onApi?.(null);
  }, [onApi, gl, scene, camera]);

  return (
    <>
      <PerspectiveCamera makeDefault fov={40} near={0.01} far={100} position={[0, 0, DEFAULT_CAM_Z / zoom]} />
      <OrbitControls
        ref={orbitRef}
        enableZoom={false}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        onEnd={() => {
          const orbit = orbitRef.current;
          if (!orbit || !onRotationChange) return;
          onRotationChange(
            (Math.PI / 2 - orbit.getPolarAngle()) * (180 / Math.PI),
            orbit.getAzimuthalAngle() * (180 / Math.PI),
          );
        }}
      />
      <SharedLights />
      <group ref={rootRef} dispose={null} />
    </>
  );
}

// ─── Phone3DViewer (public) ───────────────────────────────────────────────────
export function Phone3DViewer({
  imageUrl = null,
  imageMaskConfig = null,
  initialRotationX = 0,
  initialRotationY = 0,
  initialRotationZ = 0,
  onRotationChange,
  onMount,
  onApi,
  modelUrl,
  scale = 1,
  zoom = 1,
  shadowIntensity = 0,
  shadowColor = "#000000",
}: Props) {
  const [grabbing, setGrabbing] = useState(false);

  const device = getDeviceFromModelUrl(modelUrl);
  const isDefaultPhone = device === "phone";

  const t = Math.max(0, Math.min(1, shadowIntensity));
  const tEased = t * t;
  const computedBlur = tEased * 60;
  const computedOpacity = tEased * 0.7;
  const shadowRgba = shadowColor.startsWith("#")
    ? parseShadowColor(shadowColor, computedOpacity)
    : shadowColor;
  const hasShadow = t > 0.01;

  const sceneProps: SceneProps = {
    imageUrl,
    imageMaskConfig,
    initialRotationX,
    initialRotationY,
    initialRotationZ,
    zoom,
    onRotationChange,
    onApi,
    modelUrl,
  };

  return (
    <div
      style={{
        display: "inline-block",
        transformOrigin: "top center",
        transform: `scale(${scale})`,
        width: PHONE_W,
        height: PHONE_H + (hasShadow ? computedBlur * 0.8 : 0),
        marginTop: "150px",
        marginLeft: "150px"
      }}
    >
      <div style={{ position: "relative", width: PHONE_W, height: PHONE_H }}>

        {hasShadow && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              bottom: -(computedBlur * 0.5),
              left: `${20 + tEased * 5}%`,
              width: `${60 - tEased * 10}%`,
              height: Math.max(4, computedBlur * 0.55),
              borderRadius: "50%",
              background: shadowRgba,
              filter: `blur(${Math.max(2, computedBlur * 0.6)}px)`,
              zIndex: 0,
              pointerEvents: "none",
            }}
          />
        )}

        {/* Canvas wrapper — inset negativo para que OrbitControls no clipee */}
        <div
          style={{
            position: "absolute",
            inset: "-200px",
            zIndex: 2,
            overflow: "visible",
            cursor: grabbing ? "grabbing" : "grab",
            filter: hasShadow
              ? `drop-shadow(0px ${(tEased * 22).toFixed(1)}px ${(tEased * 32).toFixed(1)}px ${shadowRgba})`
              : "none",
            transition: "filter 0.15s ease",
            pointerEvents: "auto",
          }}
          onPointerDown={() => setGrabbing(true)}
          onPointerUp={() => setGrabbing(false)}
          onPointerLeave={() => setGrabbing(false)}
        >
          <Canvas
            key={modelUrl ?? "default"}
            // ← Tamaño explícito: evita que R3F lea dimensiones del div con inset negativo
            style={{
              width: "100%",
              height: "100%",
              overflow: "visible",
              display: "block",        // ← elimina el inline-block gap
            }}
            gl={{
              antialias: true,
              alpha: true,
              preserveDrawingBuffer: true,
              powerPreference: "high-performance",
            }}
            dpr={4}
            onCreated={({ gl, scene: s }) => {
              gl.outputColorSpace = THREE.SRGBColorSpace;
              gl.toneMapping = THREE.NeutralToneMapping;
              gl.toneMappingExposure = 1.0;
              s.environmentIntensity = 1.6;
              onMount?.(gl.domElement);
            }}
          >
            {isDefaultPhone
              ? <DefaultPhoneModelScene {...sceneProps} />
              : <GltfModelScene        {...sceneProps} />
            }
          </Canvas>
        </div>

      </div>
    </div>
  );
}