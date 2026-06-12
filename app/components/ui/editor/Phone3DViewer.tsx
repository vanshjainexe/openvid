"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
    PHONE_W,
    PHONE_H,
    deviceConfigs,
    getDeviceFromModelUrl,
    createCoverScreenCanvas,
    applyCropToImage,
    loadGltfGroup,
    cloneGroup,
    type ImageMaskConfigLike,
    parseShadowColor,
} from "@/lib/phone3d.utils";

export interface Phone3DApi {
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
    onApi?: (api: Phone3DApi | null) => void;
    modelUrl?: string;
    scale?: number;
    zoom?: number;
    shadowIntensity?: number;
    shadowColor?: string;
}

// ─── Constantes y Helpers ─────────────────────────────────────────────────────
const DEFAULT_CAM_Z = 1.5;
const DEG = Math.PI / 180;

// Caché global para modelos GLTF específicos (evita múltiples descargas)
const specificGltfCache = new Map<string, Promise<THREE.Group>>();
function loadSpecificGltf(url: string): Promise<THREE.Group> {
    if (!specificGltfCache.has(url)) {
        specificGltfCache.set(
            url,
            new Promise((resolve, reject) => {
                new GLTFLoader().load(
                    url,
                    (gltf) => resolve(gltf.scene),
                    undefined,
                    reject
                );
            })
        );
    }
    return specificGltfCache.get(url)!;
}

function applyMetalMaterial(m: THREE.MeshStandardMaterial, matName: string): void {
    if (matName.includes("Body")) { m.color.set(0x787878); m.roughness = 0.18; m.metalness = 0.85; m.envMapIntensity = 1.4; }
    if (matName.includes("Bezel")) { m.color.set(0x909090); m.roughness = 0.12; m.metalness = 0.92; m.envMapIntensity = 1.6; }
    if (matName.includes("Buttons")) { m.color.set(0x999999); m.roughness = 0.15; m.metalness = 0.88; m.envMapIntensity = 1.5; }
    if (matName.includes("Lenses")) { m.color.set(0x060608); m.roughness = 0.04; m.metalness = 0.70; m.envMapIntensity = 2.0; }
}

function applyCameraPosition(
    camera: THREE.PerspectiveCamera,
    controls: OrbitControls,
    rx: number,
    ry: number,
    zoom: number
) {
    const radius = DEFAULT_CAM_Z / zoom;
    const phi = Math.PI / 2 - rx * DEG;
    const theta = ry * DEG;
    camera.position.setFromSphericalCoords(radius, phi, theta);
    controls.update();
}

// ─── Renderizador Interno Vanilla Three.js ────────────────────────────────────
interface VanillaRendererProps extends Omit<Props, "scale" | "shadowIntensity" | "shadowColor"> {
    onLoaded: () => void;
    onContextLost: () => void;
}

function VanillaPhoneRenderer({
    imageUrl,
    imageMaskConfig,
    cropArea,
    initialRotationX = 0,
    initialRotationY = 0,
    initialRotationZ = 0,
    onRotationChange,
    onMount,
    onApi,
    modelUrl,
    zoom = 1,
    onLoaded,
    onContextLost,
}: VanillaRendererProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const rootGroupRef = useRef<THREE.Group | null>(null);
    const screenMatRef = useRef<THREE.MeshBasicMaterial | null>(null);

    // Refs estables para evitar cargas innecesarias
    const lastLoadedUrlRef = useRef<string | null>(null);
    const lastLoadedCropKeyRef = useRef<string | null>(null);
    const onRotationChangeRef = useRef(onRotationChange);
    const screenAspectRef = useRef<number>(0.459); // Default fallback
    const flipYRef = useRef<boolean>(false);

    useEffect(() => {
        onRotationChangeRef.current = onRotationChange;
    }, [onRotationChange]);

    // ─── Lógica de Texturas (Independiente de la carga del modelo) ────────────
    const applyTexture = useCallback(() => {
        const mat = screenMatRef.current;
        const renderer = rendererRef.current;
        if (!mat || !renderer) return;

        const cropKey = cropArea ? JSON.stringify(cropArea) : null;

        if (!imageUrl) {
            if (mat.map) {
                mat.map.dispose();
                mat.map = null;
                mat.needsUpdate = true;
            }
            lastLoadedUrlRef.current = null;
            lastLoadedCropKeyRef.current = null;
            return;
        }

        if (lastLoadedUrlRef.current === imageUrl && lastLoadedCropKeyRef.current === cropKey) {
            return;
        }

        const device = getDeviceFromModelUrl(modelUrl);
        const deviceConfig = deviceConfigs[device];
        const isDefaultPhone = device === "phone";

        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            let TARGET_W = 2048;
            let TARGET_H = 0;
            let cornerRadius = 0;

            if (isDefaultPhone) {
                TARGET_W = PHONE_W * 4;
                TARGET_H = Math.round(TARGET_W / screenAspectRef.current);
            } else {
                TARGET_H = Math.round(TARGET_W / deviceConfig.aspectRatio);
                cornerRadius = Math.round(TARGET_W * deviceConfig.cornerRadiusFactor);
            }

            const cropped = applyCropToImage(img, cropArea);
            const cover = createCoverScreenCanvas(cropped, TARGET_W, TARGET_H, cornerRadius, imageMaskConfig);

            if (mat.map) {
                mat.map.dispose();
                mat.map = null;
            }

            const tex = new THREE.CanvasTexture(cover);
            tex.flipY = flipYRef.current;
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.generateMipmaps = true;
            tex.minFilter = THREE.LinearMipmapLinearFilter;
            tex.magFilter = THREE.LinearFilter;
            tex.wrapS = THREE.ClampToEdgeWrapping;
            tex.wrapT = THREE.ClampToEdgeWrapping;
            tex.anisotropy = renderer.capabilities.getMaxAnisotropy();

            mat.map = tex;
            mat.color.set(0xffffff);
            mat.needsUpdate = true;

            lastLoadedUrlRef.current = imageUrl;
            lastLoadedCropKeyRef.current = cropKey;
        };
        img.onerror = () => {
            if (mat.map) {
                mat.map.dispose();
                mat.map = null;
                mat.needsUpdate = true;
            }
            mat.color.set(0x111111);
            lastLoadedUrlRef.current = imageUrl;
            lastLoadedCropKeyRef.current = cropKey;
        };
        img.src = imageUrl;
    }, [imageUrl, imageMaskConfig, cropArea, modelUrl]);

    // Disparar textura al cambiar dependencias
    useEffect(() => {
        applyTexture();
    }, [applyTexture]);

    // ─── Inicialización de la Escena ──────────────────────────────────────────
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // 1. Setup Base
        const scene = new THREE.Scene();
        sceneRef.current = scene;

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

        const camera = new THREE.PerspectiveCamera(
            40,
            container.clientWidth / container.clientHeight,
            0.01,
            100
        );
        cameraRef.current = camera;

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableZoom = false;
        controls.enablePan = false;
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.addEventListener("end", () => {
            const ry = controls.getAzimuthalAngle() * (180 / Math.PI);
            const rx = (Math.PI / 2 - controls.getPolarAngle()) * (180 / Math.PI);
            onRotationChangeRef.current?.(rx, ry);
        });
        controlsRef.current = controls;

        applyCameraPosition(camera, controls, initialRotationX, initialRotationY, zoom);

        // 2. Luces (Equivalente exacto a SharedLights)
        const pmremGenerator = new THREE.PMREMGenerator(renderer);
        pmremGenerator.compileEquirectangularShader();
        scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
        scene.environmentIntensity = 1.6;

        scene.add(new THREE.AmbientLight(0xffffff, 0.3));

        const dl1 = new THREE.DirectionalLight(0xffffff, 0.6);
        dl1.position.set(3, 6, 5);
        scene.add(dl1);

        const dl2 = new THREE.DirectionalLight(0xc8d8ff, 0.25);
        dl2.position.set(-4, -2, 3);
        scene.add(dl2);

        const dl3 = new THREE.DirectionalLight(0xffffff, 0.35);
        dl3.position.set(0, -5, 5);
        scene.add(dl3);

        const rootGroup = new THREE.Group();
        rootGroup.rotation.z = initialRotationZ * DEG;
        scene.add(rootGroup);
        rootGroupRef.current = rootGroup;

        // 3. Lógica de Carga de Modelo (Dependiente de modelUrl)
        const device = getDeviceFromModelUrl(modelUrl);
        const isDefaultPhone = device === "phone";

        const finalizeSetup = () => {
            applyTexture();
            // Asegurar que Three.js pintó el canvas antes de ocultar el spinner
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    onLoaded();
                });
            });
        };

        if (isDefaultPhone) {
            flipYRef.current = false;
            loadGltfGroup().then((cached) => {
                const group = cloneGroup(cached);
                const camZ = DEFAULT_CAM_Z / zoom;
                const box = new THREE.Box3().setFromObject(group);
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());
                const halfH = camZ * Math.tan((40 / 2) * DEG);
                const sf = (halfH * 2 * 0.8) / size.y;

                group.scale.setScalar(sf);
                group.position.copy(center).negate().multiplyScalar(sf);

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
                            color: 0x111111,
                            side: THREE.FrontSide,
                            transparent: true,
                            depthTest: false,
                            depthWrite: false,
                        });
                        child.material = basicMat;
                        child.renderOrder = 10;
                        screenMatRef.current = basicMat;
                    } else if (mat.isMeshStandardMaterial) {
                        applyMetalMaterial(mat, matName);
                    }
                });

                rootGroup.add(group);
                finalizeSetup();
            });
        } else {
            flipYRef.current = true;
            loadSpecificGltf(modelUrl!).then((loadedScene) => {
                const group = loadedScene.clone(true);
                const camZ = DEFAULT_CAM_Z / zoom;
                const box = new THREE.Box3().setFromObject(group);
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());
                const halfH = camZ * Math.tan((40 / 2) * DEG);
                const sf = (halfH * 2 * 0.8) / size.y;

                group.scale.setScalar(sf);
                group.position.copy(center).negate().multiplyScalar(sf);

                const deviceConfig = deviceConfigs[device];
                const planeH = 4.3 * deviceConfig.screenHeightFactor;
                const planeW = planeH * deviceConfig.aspectRatio;

                const basicMat = new THREE.MeshBasicMaterial({
                    color: 0x111111,
                    side: THREE.FrontSide,
                    transparent: true,
                    depthTest: false,
                    depthWrite: false,
                });
                screenMatRef.current = basicMat;

                const plane = new THREE.Mesh(new THREE.PlaneGeometry(planeW, planeH), basicMat);
                plane.position.set(deviceConfig.screenOffset.x, deviceConfig.screenOffset.y, deviceConfig.screenOffset.z);
                plane.renderOrder = 10;
                group.add(plane);

                rootGroup.add(group);
                finalizeSetup();
            });
        }

        // 4. Render Loop
        let raf = 0;
        const tick = () => {
            raf = requestAnimationFrame(tick);
            controls.update();
            renderer.render(scene, camera);
        };
        tick();

        // 5. Eventos y Cleanup
        const resizeObserver = new ResizeObserver(() => {
            if (!container || !camera || !renderer) return;
            const w = container.clientWidth;
            const h = container.clientHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h, false);
        });
        resizeObserver.observe(container);

        const handleCtxLost = (e: Event) => {
            e.preventDefault();
            onContextLost();
        };
        renderer.domElement.addEventListener("webglcontextlost", handleCtxLost);

        return () => {
            cancelAnimationFrame(raf);
            resizeObserver.disconnect();
            renderer.domElement.removeEventListener("webglcontextlost", handleCtxLost);
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
    }, []); // Se ejecuta una vez por montaje (controlado por el prop `key` del padre)

    // ─── Sync Dinámico (Zoom, Rotaciones y API) ─────────────────────────────────
    useEffect(() => {
        if (cameraRef.current && controlsRef.current) {
            applyCameraPosition(cameraRef.current, controlsRef.current, initialRotationX, initialRotationY, zoom);
        }
    }, [initialRotationX, initialRotationY, zoom]);

    useEffect(() => {
        if (rootGroupRef.current) {
            rootGroupRef.current.rotation.z = initialRotationZ * DEG;
        }
    }, [initialRotationZ]);

    useEffect(() => {
        if (!onApi) return;
        const api: Phone3DApi = {
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
                renderer.setSize(containerRef.current?.clientWidth || PHONE_W, containerRef.current?.clientHeight || PHONE_H, false);
            },
        };
        onApi(api);
        return () => onApi(null);
    }, [onApi]);

    return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}

// ─── Componente Principal Público ─────────────────────────────────────────────
export function Phone3DViewer({
    imageUrl = null,
    imageMaskConfig = null,
    cropArea = null,
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
    const loadedRef = useRef(false);
    const [showShadow, setShowShadow] = useState(false);
    const [showSpinner, setShowSpinner] = useState(true);
    
    // Fuerza remounting (recreación del contexto WebGL) al perder contexto o cambiar dispositivo
    const [mountKey, setMountKey] = useState(0);

    const t = Math.max(0, Math.min(1, shadowIntensity));
    const tEased = t * t;
    const computedBlur = tEased * 60;
    const computedOpacity = tEased * 0.7;
    const shadowRgba = shadowColor.startsWith("#")
        ? parseShadowColor(shadowColor, computedOpacity)
        : shadowColor;
    
    const hasShadow = t > 0.01 && showShadow;

    const handleLoaded = useCallback(() => {
        if (loadedRef.current) return;
        loadedRef.current = true;
        setShowSpinner(false);
        setShowShadow(true);
    }, []);

    const handleContextLost = useCallback(() => {
        setMountKey((prev) => prev + 1);
        loadedRef.current = false;
        setShowSpinner(true);
        setShowShadow(false);
    }, []);

    // El `key` final que asegura resetear todo el canvas cuando cambia el dispositivo
    const finalMountKey = `${modelUrl ?? "default"}_${mountKey}`;

    return (
        <div
            style={{
                display: "inline-block",
                transformOrigin: "top center",
                transform: `scale(${scale})`,
                width: PHONE_W,
                height: PHONE_H + (hasShadow ? computedBlur * 0.8 : 0),
                marginTop: "220px",
            }}
        >
            <div style={{ position: "relative", width: PHONE_W, height: PHONE_H }}>
                
                {/* Sombra de Suelo (CSS Render) */}
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

                {/* Contenedor del Canvas con Hit-Area expandida para el Orbit */}
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
                        transition: showShadow ? "filter 0.3s ease" : "none",
                        pointerEvents: "auto",
                    }}
                    onPointerDown={() => setGrabbing(true)}
                    onPointerUp={() => setGrabbing(false)}
                    onPointerLeave={() => setGrabbing(false)}
                >
                    <VanillaPhoneRenderer
                        key={finalMountKey}
                        imageUrl={imageUrl}
                        imageMaskConfig={imageMaskConfig}
                        cropArea={cropArea}
                        initialRotationX={initialRotationX}
                        initialRotationY={initialRotationY}
                        initialRotationZ={initialRotationZ}
                        zoom={zoom}
                        modelUrl={modelUrl}
                        onRotationChange={onRotationChange}
                        onMount={onMount}
                        onApi={onApi}
                        onLoaded={handleLoaded}
                        onContextLost={handleContextLost}
                    />
                </div>

                {/* Spinner de Carga Inicial */}
                {showSpinner && (
                    <div
                        className="absolute inset-0 flex items-center justify-center pointer-events-none"
                        style={{ zIndex: 10 }}
                    >
                        <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                    </div>
                )}
            </div>
        </div>
    );
}