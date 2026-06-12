"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
    createCoverScreenCanvas,
    applyCropToImage,
    parseShadowColor,
    type ImageMaskConfigLike,
    PHONE_W,
    PHONE_H,
} from "@/lib/phone3d.utils";

export interface IPhone13ProMax3DApi {
    renderAt: (width: number, height: number) => void;
}

interface Props {
    imageUrl?: string | null;
    imageMaskConfig?: ImageMaskConfigLike | null;
    cropArea?: { x: number; y: number; width: number; height: number } | null;
    initialRotationX?: number;
    initialRotationY?: number;
    initialRotationZ?: number;
    onRotationChange?: (rx: number, ry: number) => void;
    onMount?: (canvas: HTMLCanvasElement) => void;
    onApi?: (api: IPhone13ProMax3DApi | null) => void;
    scale?: number;
    zoom?: number;
    shadowIntensity?: number;
    shadowColor?: string;
}

// ─── Dimensiones de textura ───────────────────────────────────────────────────
const TEX_W = 1284 * 2;
const TEX_H = 2778 * 2;

// ─── Caché global del GLB ─────────────────────────────────────────────────────
let gltfCachePromise: Promise<THREE.Group> | null = null;
function loadIPhoneGltf(): Promise<THREE.Group> {
    if (!gltfCachePromise) {
        gltfCachePromise = new Promise<THREE.Group>((resolve, reject) =>
            new GLTFLoader().load(
                "/models/apple_iphone_13_pro_max.glb",
                (gltf) => resolve(gltf.scene as THREE.Group),
                undefined,
                reject
            )
        );
    }
    return gltfCachePromise;
}

// ─── Helpers matemáticos ──────────────────────────────────────────────────────
const DEG = Math.PI / 180;
function applyCameraPosition(
    camera: THREE.PerspectiveCamera,
    controls: OrbitControls,
    rx: number,
    ry: number,
    zoom: number
) {
    const radius = 1.5 / zoom;
    const phi = Math.PI / 2 - rx * DEG;
    const theta = ry * DEG;
    camera.position.setFromSphericalCoords(radius, phi, theta);
    controls.update();
}

export function IPhone13ProMax3DViewer({
    imageUrl = null,
    imageMaskConfig = null,
    cropArea = null,
    initialRotationX = -58.23,
    initialRotationY = -29.82,
    initialRotationZ = 0,
    onRotationChange,
    onMount,
    onApi,
    scale = 1,
    zoom = 1,
    shadowIntensity = 0,
    shadowColor = "#000000",
}: Props) {
    // Referencias DOM y Three.js
    const containerRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const modelRootRef = useRef<THREE.Group | null>(null);
    const wallpaperMatRef = useRef<THREE.MeshStandardMaterial | null>(null);

    // Referencias para evitar recargas innecesarias
    const lastLoadedImageUrlRef = useRef<string | null>(null);
    const lastLoadedMaskKeyRef = useRef<string | null>(null);
    const lastLoadedCropKeyRef = useRef<string | null>(null);
    const onRotationChangeRef = useRef(onRotationChange);

    // Estados de la UI
    const [loaded, setLoaded] = useState(false);
    const [contextLost, setContextLost] = useState(false);
    const [grabbing, setGrabbing] = useState(false);

    // Sincronizar referencias inmutables
    useEffect(() => {
        onRotationChangeRef.current = onRotationChange;
    }, [onRotationChange]);

    // ─── Inicialización principal de Three.js ───────────────────────────────────
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // Escena
        const scene = new THREE.Scene();
        sceneRef.current = scene;

        // Renderizador
        const renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            preserveDrawingBuffer: true,
            powerPreference: "high-performance",
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3));
        renderer.setSize(container.clientWidth, container.clientHeight, false);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.NeutralToneMapping;
        renderer.toneMappingExposure = 1.0;
        container.appendChild(renderer.domElement);
        rendererRef.current = renderer;
        onMount?.(renderer.domElement);

        // Cámara
        const camera = new THREE.PerspectiveCamera(
            40,
            container.clientWidth / container.clientHeight,
            0.01,
            100
        );
        cameraRef.current = camera;

        // Controles Orbitales (Sustituto puro de @react-three/drei OrbitControls)
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableZoom = false;
        controls.enablePan = false;
        controls.enableDamping = true;
        controls.dampingFactor = 0.08; // Misma inercia fluida que R3F
        controls.addEventListener("end", () => {
            const ry = controls.getAzimuthalAngle() * (180 / Math.PI);
            const rx = (Math.PI / 2 - controls.getPolarAngle()) * (180 / Math.PI);
            onRotationChangeRef.current?.(rx, ry);
        });
        controlsRef.current = controls;

        // Posición inicial
        applyCameraPosition(camera, controls, initialRotationX, initialRotationY, zoom);

        // Iluminación (Replicando `<Environment preset="apartment" />` + luces directas)
        const pmremGenerator = new THREE.PMREMGenerator(renderer);
        pmremGenerator.compileEquirectangularShader();
        scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
        scene.environmentIntensity = 1.3;
        scene.add(new THREE.AmbientLight(0xffffff, 0.3));

        const dl1 = new THREE.DirectionalLight(0xffffff, 0.9);
        dl1.position.set(3, 6, 5);
        scene.add(dl1);

        const dl2 = new THREE.DirectionalLight(0xc8d8ff, 0.5);
        dl2.position.set(-4, -2, 3);
        scene.add(dl2);

        const dl3 = new THREE.DirectionalLight(0xffffff, 0.5);
        dl3.position.set(0, -5, 5);
        scene.add(dl3);

        // Jerarquía del modelo
        const rootGroup = new THREE.Group();
        rootGroup.rotation.z = initialRotationZ * DEG;
        scene.add(rootGroup);
        modelRootRef.current = rootGroup;

        // Cargar GLB
        loadIPhoneGltf()
            .then((gltfScene) => {
                const phone = gltfScene.clone(true);
                // El R3F tenía scale={0.01} -> inner scale={100} y rotation-y={Math.PI}
                // Eso equivale netamente a rotarlo en Y 180 grados sin alterar escala
                phone.rotation.y = Math.PI;

                phone.traverse((child) => {
                    if (!(child instanceof THREE.Mesh)) return;

                    child.castShadow = true;
                    child.receiveShadow = true;

                    const material = child.material;

                    const mats = Array.isArray(material) ? material : [material];

                    for (const mat of mats) {
                        if (!(mat instanceof THREE.MeshStandardMaterial)) continue;

                        // Reduce reflejos globales
                        mat.envMapIntensity = 0.15;
                    }

                    // Imagen de pantalla
                    if (child.name.includes("Wallpaper")) {
                        const mat = child.material as THREE.MeshStandardMaterial;
                        wallpaperMatRef.current = mat;

                        mat.envMapIntensity = 0;
                        mat.roughness = 1;
                        mat.metalness = 0;
                        mat.needsUpdate = true;
                    }

                    // Vidrio / capa superior de la pantalla
                    if (
                        child.name.includes("Screen_Glass") ||
                        child.name.includes("Glass") ||
                        child.name.includes("Display") ||
                        child.name.includes("FrontGlass")
                    ) {
                        const mat = child.material as THREE.MeshStandardMaterial;

                        mat.envMapIntensity = 0;
                        mat.roughness = 1;
                        mat.metalness = 0;
                        mat.opacity = 1;
                        mat.transparent = false;
                        mat.needsUpdate = true;
                    }
                });

                rootGroup.add(phone);

                // Simular un pequeño retardo para asegurar que los shaders compilaron
                requestAnimationFrame(() => requestAnimationFrame(() => setLoaded(true)));
            })
            .catch(console.error);

        // Loop de renderizado
        let raf = 0;
        const tick = () => {
            raf = requestAnimationFrame(tick);
            controls.update(); // Necesario para el damping
            renderer.render(scene, camera);
        };
        tick();

        // Eventos DOM (Resize y Context WebGL)
        const resizeObserver = new ResizeObserver(() => {
            if (!container || !camera || !renderer) return;
            const w = container.clientWidth;
            const h = container.clientHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h, false);
        });
        resizeObserver.observe(container);

        const handleContextLost = (e: Event) => {
            e.preventDefault();
            setContextLost(true);
            setLoaded(false);
        };
        const handleContextRestored = () => setContextLost(false);

        renderer.domElement.addEventListener("webglcontextlost", handleContextLost);
        renderer.domElement.addEventListener("webglcontextrestored", handleContextRestored);

        // Limpieza al desmontar
        return () => {
            cancelAnimationFrame(raf);
            resizeObserver.disconnect();
            renderer.domElement.removeEventListener("webglcontextlost", handleContextLost);
            renderer.domElement.removeEventListener("webglcontextrestored", handleContextRestored);
            pmremGenerator.dispose();

            scene.traverse((obj) => {
                if (obj instanceof THREE.Mesh) {
                    obj.geometry.dispose();
                    if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
                    else obj.material.dispose();
                }
            });

            renderer.dispose();
            if (container.contains(renderer.domElement)) {
                container.removeChild(renderer.domElement);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ─── API y Sync de Props Externas ───────────────────────────────────────────

    useEffect(() => {
        if (!onApi) return;
        const api: IPhone13ProMax3DApi = {
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

                // Restaurar estado
                camera.aspect = oldAspect;
                camera.updateProjectionMatrix();
                renderer.setSize(containerRef.current?.clientWidth || PHONE_W, containerRef.current?.clientHeight || PHONE_H, false);
            },
        };
        onApi(api);
        return () => onApi(null);
    }, [onApi]);

    useEffect(() => {
        if (cameraRef.current && controlsRef.current) {
            applyCameraPosition(cameraRef.current, controlsRef.current, initialRotationX, initialRotationY, zoom);
        }
    }, [initialRotationX, initialRotationY, zoom]);

    useEffect(() => {
        if (modelRootRef.current) {
            modelRootRef.current.rotation.z = initialRotationZ * DEG;
        }
    }, [initialRotationZ]);

    // ─── Actualización de Textura de Pantalla ───────────────────────────────────
    useEffect(() => {
        const mat = wallpaperMatRef.current;
        if (!mat) return;

        const maskKey = imageMaskConfig ? JSON.stringify(imageMaskConfig) : null;
        const cropKey = cropArea ? JSON.stringify(cropArea) : null;

        if (!imageUrl) {
            if (mat.map) {
                mat.map.dispose();
                mat.map = null;
                mat.needsUpdate = true;
            }
            lastLoadedImageUrlRef.current = null;
            lastLoadedMaskKeyRef.current = null;
            return;
        }

        if (
            lastLoadedImageUrlRef.current === imageUrl &&
            lastLoadedMaskKeyRef.current === maskKey &&
            lastLoadedCropKeyRef.current === cropKey
        ) {
            return;
        }

        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const cropped = applyCropToImage(img, cropArea);
            const cover = createCoverScreenCanvas(cropped, TEX_W, TEX_H, 0, imageMaskConfig);

            if (mat.map) {
                mat.map.dispose();
                mat.map = null;
            }

            const tex = new THREE.CanvasTexture(cover);
            tex.flipY = true; // Se mantiene la inversión Y originaria del R3F
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.generateMipmaps = true;
            tex.minFilter = THREE.LinearMipmapLinearFilter;
            tex.magFilter = THREE.LinearFilter;
            tex.wrapS = THREE.ClampToEdgeWrapping;
            tex.wrapT = THREE.ClampToEdgeWrapping;

            mat.map = tex;
            mat.needsUpdate = true;

            lastLoadedImageUrlRef.current = imageUrl;
            lastLoadedMaskKeyRef.current = maskKey;
            lastLoadedCropKeyRef.current = cropKey;
        };
        img.src = imageUrl;
    }, [imageUrl, imageMaskConfig, cropArea, loaded]);

    // ─── Sombras y Renderizado HTML ─────────────────────────────────────────────

    const t = Math.max(0, Math.min(1, shadowIntensity));
    const tEased = t * t;
    const computedBlur = tEased * 60;
    const computedOpacity = tEased * 0.7;

    const shadowRgba = shadowColor.startsWith("#")
        ? parseShadowColor(shadowColor, computedOpacity)
        : shadowColor;

    const hasShadow = t > 0.01 && loaded;

    return (
        <div
            style={{
                display: "inline-block",
                transformOrigin: "top center",
                transform: `scale(${scale})`,
                width: 480,
                height: 1000 + (hasShadow ? computedBlur * 0.8 : 0),
                marginTop: "20px",
            }}
        >
            <div style={{ position: "relative", width: 480, height: 1000 }}>
                {/* Sombra de suelo - Aparece sólo tras la carga */}
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

                {/* Capa de interacción y WebGL */}
                <div
                    style={{
                        position: "absolute",
                        inset: "-200px", // Aumenta el área del WebGL y la zona de drag (880x1400 px)
                        zIndex: 2,
                        overflow: "visible",
                        cursor: grabbing ? "grabbing" : "grab",
                        filter: hasShadow
                            ? `drop-shadow(0px ${(tEased * 22).toFixed(1)}px ${(tEased * 32).toFixed(1)}px ${shadowRgba})`
                            : "none",
                        transition: loaded ? "filter 0.15s ease" : "none",
                        pointerEvents: "auto",
                    }}
                    onPointerDown={() => setGrabbing(true)}
                    onPointerUp={() => setGrabbing(false)}
                    onPointerLeave={() => setGrabbing(false)}
                >
                    {/* Contenedor Vanilla Three.js */}
                    <div
                        ref={containerRef}
                        style={{
                            width: "100%",
                            height: "100%",
                            opacity: loaded && !contextLost ? 1 : 0,
                            transition: "opacity 0.25s ease",
                        }}
                    />
                </div>

                {/* Pantallas de Carga y Context Lost */}
                {contextLost && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20" style={{ zIndex: 4 }}>
                        <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                    </div>
                )}

                {!loaded && !contextLost && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 4 }}>
                        <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                    </div>
                )}
            </div>
        </div>
    );
}