"use client";

/**
 * IPhone13ProMax3DViewer (R3F + drei — OrbitControls edition)
 *
 * Sombra: mismo sistema que Laptop3DViewer
 * - Una sola prop `shadowIntensity` (0–1)
 * - Curva cuadratica interna (t^2): arranque suave, maximo dramatico
 * - Elipse de suelo + drop-shadow en contorno del modelo
 */

import { Canvas } from "@react-three/fiber";
import {
    PerspectiveCamera,
    useGLTF,
    Environment,
    OrbitControls,
} from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
    createCoverScreenCanvas,
    type ImageMaskConfigLike,
} from "@/lib/phone3d.utils";

export interface IPhone13ProMax3DApi {
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
    onApi?: (api: IPhone13ProMax3DApi | null) => void;
    scale?: number;
    zoom?: number;
    /**
     * Intensidad de la sombra de 0 a 1.
     * 0 = sin sombra, 1 = sombra maxima.
     * Curva cuadratica interna (t^2) para crecimiento gradual en todo el rango.
     * Default: 0 (sin sombra)
     */
    shadowIntensity?: number;
    /**
     * Color base de la sombra en hex o rgb. Default: "#000000"
     * La opacidad se controla automaticamente con shadowIntensity.
     */
    shadowColor?: string;
}

// ─── Textura de pantalla ─────────────────────────────────────────────────────
const TEX_W = 1284 * 2;
const TEX_H = 2778 * 2;

useGLTF.preload("/models/apple_iphone_13_pro_max.glb");

// ─── Tipos del GLB ──────────────────────────────────────────────────────────
interface GLTFNodes {
    Frame_Frame_0: THREE.Mesh;
    Frame_Frame2_0: THREE.Mesh;
    Frame_Port_0: THREE.Mesh;
    Frame_Antenna_0: THREE.Mesh;
    Frame_Mic_0: THREE.Mesh;
    Body_Mic_0: THREE.Mesh;
    Body_Bezel_0: THREE.Mesh;
    Body_Body_0: THREE.Mesh;
    Body_Wallpaper_0: THREE.Mesh;
    Body_Camera_Glass_0: THREE.Mesh;
    Body_Lens_0: THREE.Mesh;
    Body_Material_0: THREE.Mesh;
    Camera_Body_0: THREE.Mesh;
    Camera_Glass_0: THREE.Mesh;
    Camera_Camera_Frame001_0: THREE.Mesh;
    Camera_Mic_0: THREE.Mesh;
    Body001_Screen_Glass_0: THREE.Mesh;
    Button_Frame_0: THREE.Mesh;
    Circle003_Frame_0: THREE.Mesh;
    Apple_Logo_Logo_0: THREE.Mesh;
    Camera001_Body_0: THREE.Mesh;
    Camera001_Gray_Glass_0: THREE.Mesh;
    Camera001_Flash_0: THREE.Mesh;
    Camera001_Port_0: THREE.Mesh;
    Camera001_Camera_Frame_0: THREE.Mesh;
    Camera001_Camera_Glass_0: THREE.Mesh;
    Camera001_Lens_0: THREE.Mesh;
    Camera001_Black_Glass_0: THREE.Mesh;
    Camera003_Material002_0: THREE.Mesh;
}

interface GLTFMaterials {
    Frame: THREE.Material;
    Frame2: THREE.Material;
    Port: THREE.Material;
    Antenna: THREE.Material;
    material: THREE.Material;
    Bezel: THREE.Material;
    Body: THREE.Material;
    Wallpaper: THREE.Material;
    Camera_Glass: THREE.Material;
    Lens: THREE.Material;
    Material: THREE.Material;
    Glass: THREE.Material;
    "Camera_Frame.001": THREE.Material;
    Screen_Glass: THREE.Material;
    Logo: THREE.Material;
    Gray_Glass: THREE.Material;
    Flash: THREE.Material;
    Camera_Frame: THREE.Material;
    Black_Glass: THREE.Material;
    "Material.002": THREE.Material;
}

// ─── Escena 3D ──────────────────────────────────────────────────────────────
function ModelScene({
    imageUrl,
    imageMaskConfig,
    initialRotationX,
    initialRotationY,
    onRotationChange,
    rootRef,
    cameraRef,
    zoom,
    onApi,
}: {
    imageUrl: string | null;
    imageMaskConfig: ImageMaskConfigLike | null;
    initialRotationX: number;
    initialRotationY: number;
    onRotationChange?: (rx: number, ry: number) => void;
    rootRef: React.MutableRefObject<THREE.Group | null>;
    cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>;
    zoom: number;
    onApi?: (api: IPhone13ProMax3DApi | null) => void;
}) {
    const gltf = useGLTF("/models/apple_iphone_13_pro_max.glb") as unknown as {
        nodes: GLTFNodes;
        materials: GLTFMaterials;
    };
    const { nodes, materials } = gltf;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orbitRef = useRef<any>(null);
    const lastLoadedImageUrlRef = useRef<string | null>(null);
    const wallpaperMatRef = useRef<THREE.MeshStandardMaterial | null>(null);

    useEffect(() => {
        const api: IPhone13ProMax3DApi = {
            renderAt: (w, h) => { void w; void h; },
        };
        onApi?.(api);
        return () => onApi?.(null);
    }, [onApi]);

    useEffect(() => {
        if (materials.Wallpaper) {
            wallpaperMatRef.current = materials.Wallpaper as THREE.MeshStandardMaterial;
        }
    }, [materials.Wallpaper]);

    useEffect(() => {
        const mat = wallpaperMatRef.current;
        if (!mat) return;

        if (!imageUrl) {
            if (mat.map) { mat.map.dispose(); mat.map = null; mat.needsUpdate = true; }
            lastLoadedImageUrlRef.current = null;
            return;
        }
        if (lastLoadedImageUrlRef.current === imageUrl) return;

        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const cover = createCoverScreenCanvas(img, TEX_W, TEX_H, 0, imageMaskConfig);
            if (mat.map) { mat.map.dispose(); mat.map = null; }

            const tex = new THREE.CanvasTexture(cover);
            tex.flipY = true;
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.generateMipmaps = true;
            tex.minFilter = THREE.LinearMipmapLinearFilter;
            tex.magFilter = THREE.LinearFilter;
            tex.wrapS = THREE.ClampToEdgeWrapping;
            tex.wrapT = THREE.ClampToEdgeWrapping;
            mat.map = tex;
            mat.needsUpdate = true;
            lastLoadedImageUrlRef.current = imageUrl;
        };
        img.src = imageUrl;
    }, [imageUrl, imageMaskConfig]);

    useEffect(() => {
        // Microtask delay para asegurar que OrbitControls ya está montado
        const id = setTimeout(() => {
            const orbit = orbitRef.current;
            if (!orbit) return;
            const DEG = Math.PI / 180;
            const radius = 1.5 / zoom;
            const phi = Math.PI / 2 - initialRotationX * DEG;
            const theta = initialRotationY * DEG;
            orbit.object.position.setFromSphericalCoords(radius, phi, theta);
            orbit.update();
        }, 0);
        return () => clearTimeout(id);
    }, []);

    return (
        <>
            <PerspectiveCamera
                ref={cameraRef}
                makeDefault
                fov={40}
                near={0.01}
                far={100}
                position={[0, 0, 1.5 / zoom]}
            />

            <OrbitControls
                ref={orbitRef}
                enableZoom={false}
                enablePan={false}
                enableDamping
                dampingFactor={0.08}
                onEnd={() => {
                    const orbit = orbitRef.current;
                    if (!orbit || !onRotationChange) return;
                    const ry = orbit.getAzimuthalAngle() * (180 / Math.PI);
                    const rx = (Math.PI / 2 - orbit.getPolarAngle()) * (180 / Math.PI);
                    onRotationChange(rx, ry);
                }}
            />

            <Environment preset="city" background={false} />

            <ambientLight intensity={0.3} />
            <directionalLight position={[3, 6, 5]} intensity={0.6} />
            <directionalLight position={[-4, -2, 3]} intensity={0.25} color="#c8d8ff" />
            <directionalLight position={[0, -5, 5]} intensity={0.35} />

            <group ref={rootRef} rotation={[0, Math.PI, 0]} scale={0.01} dispose={null}>
                <group scale={100}>
                    <mesh castShadow receiveShadow geometry={nodes.Frame_Frame_0.geometry} material={materials.Frame} />
                    <mesh castShadow receiveShadow geometry={nodes.Frame_Frame2_0.geometry} material={materials.Frame2} />
                    <mesh castShadow receiveShadow geometry={nodes.Frame_Port_0.geometry} material={materials.Port} />
                    <mesh castShadow receiveShadow geometry={nodes.Frame_Antenna_0.geometry} material={materials.Antenna} />
                    <mesh castShadow receiveShadow geometry={nodes.Frame_Mic_0.geometry} material={materials.material} />
                    <mesh castShadow receiveShadow geometry={nodes.Body_Mic_0.geometry} material={materials.material} />
                    <mesh castShadow receiveShadow geometry={nodes.Body_Bezel_0.geometry} material={materials.Bezel} />
                    <mesh castShadow receiveShadow geometry={nodes.Body_Body_0.geometry} material={materials.Body} />
                    <mesh castShadow receiveShadow geometry={nodes.Body_Wallpaper_0.geometry} material={materials.Wallpaper} />
                    <mesh castShadow receiveShadow geometry={nodes.Body_Camera_Glass_0.geometry} material={materials.Camera_Glass} />
                    <mesh castShadow receiveShadow geometry={nodes.Body_Lens_0.geometry} material={materials.Lens} />
                    <mesh castShadow receiveShadow geometry={nodes.Body_Material_0.geometry} material={materials.Material} />
                    <mesh castShadow receiveShadow geometry={nodes.Camera_Body_0.geometry} material={materials.Body} />
                    <mesh castShadow receiveShadow geometry={nodes.Camera_Glass_0.geometry} material={materials.Glass} />
                    <mesh castShadow receiveShadow geometry={nodes.Camera_Camera_Frame001_0.geometry} material={materials["Camera_Frame.001"]} />
                    <mesh castShadow receiveShadow geometry={nodes.Camera_Mic_0.geometry} material={materials.material} />
                    <mesh castShadow receiveShadow geometry={nodes.Body001_Screen_Glass_0.geometry} material={materials.Screen_Glass} />
                    <mesh castShadow receiveShadow geometry={nodes.Button_Frame_0.geometry} material={materials.Frame} />
                    <mesh castShadow receiveShadow geometry={nodes.Circle003_Frame_0.geometry} material={materials.Frame} />
                    <mesh castShadow receiveShadow geometry={nodes.Apple_Logo_Logo_0.geometry} material={materials.Logo} />
                    <mesh castShadow receiveShadow geometry={nodes.Camera001_Body_0.geometry} material={materials.Body} />
                    <mesh castShadow receiveShadow geometry={nodes.Camera001_Gray_Glass_0.geometry} material={materials.Gray_Glass} />
                    <mesh castShadow receiveShadow geometry={nodes.Camera001_Flash_0.geometry} material={materials.Flash} />
                    <mesh castShadow receiveShadow geometry={nodes.Camera001_Port_0.geometry} material={materials.Port} />
                    <mesh castShadow receiveShadow geometry={nodes.Camera001_Camera_Frame_0.geometry} material={materials.Camera_Frame} />
                    <mesh castShadow receiveShadow geometry={nodes.Camera001_Camera_Glass_0.geometry} material={materials.Camera_Glass} />
                    <mesh castShadow receiveShadow geometry={nodes.Camera001_Lens_0.geometry} material={materials.Lens} />
                    <mesh castShadow receiveShadow geometry={nodes.Camera001_Black_Glass_0.geometry} material={materials.Black_Glass} />
                    <mesh castShadow receiveShadow geometry={nodes.Camera003_Material002_0.geometry} material={materials["Material.002"]} />
                </group>
            </group>
        </>
    );
}

// ─── Componente público ──────────────────────────────────────────────────────
export function IPhone13ProMax3DViewer({
    imageUrl = null,
    imageMaskConfig = null,
    initialRotationX = -58.23,
    initialRotationY = -29.82,
    initialRotationZ: _initialRotationZ = 0,
    onRotationChange,
    onMount,
    onApi,
    scale = 1,
    zoom = 1,
    shadowIntensity = 0,
    shadowColor = "#000000",
}: Props) {
    const rootRef = useRef<THREE.Group | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const [grabbing, setGrabbing] = useState(false);

    // ── Curva cuadratica: mismo sistema que Laptop3DViewer ───────────────────
    // t^2 da arranque suave (0→0.04 al 20%) y maximo dramatico (1→1 al 100%)
    const t = Math.max(0, Math.min(1, shadowIntensity));
    const tEased = t * t;
    const computedBlur = tEased * 60;   // 0–60 px
    const computedOpacity = tEased * 0.7;  // 0–0.7

    const parseShadowColor = (hex: string, opacity: number): string => {
        const h = hex.replace("#", "");
        const r = parseInt(h.length === 3 ? h[0] + h[0] : h.slice(0, 2), 16);
        const g = parseInt(h.length === 3 ? h[1] + h[1] : h.slice(2, 4), 16);
        const b = parseInt(h.length === 3 ? h[2] + h[2] : h.slice(4, 6), 16);
        return `rgba(${r},${g},${b},${opacity.toFixed(3)})`;
    };
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
                width: 480,
                height: 1000 + (hasShadow ? computedBlur * 0.8 : 0),
       
            }}
        >
            <div style={{ position: "relative", width: 480, height: 1000 }}>
                {/* Sombra de suelo: elipse difusa con curva t^2 */}
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

                {/*
                  Canvas wrapper con inset negativo para que OrbitControls
                  no clipee el modelo cuando se rota al maximo.
                  drop-shadow sigue el contorno real del iPhone (igual que Laptop3DViewer).
                */}
                <div
                    style={{
                        position: "absolute",
                        inset: "-200px",
                        zIndex: 2,
                        overflow: "visible",
                        cursor: grabbing ? "grabbing" : "grab",
                        // drop-shadow en contorno del modelo con curva t^2
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
                        style={{ width: "100%", height: "100%", overflow: "visible" }}
                        gl={{
                            antialias: true,
                            alpha: true,
                            preserveDrawingBuffer: true,
                            powerPreference: "high-performance",
                        }}
                        dpr={4}
                        onCreated={({ gl, scene }) => {
                            gl.outputColorSpace = THREE.SRGBColorSpace;
                            gl.toneMapping = THREE.NeutralToneMapping;
                            gl.toneMappingExposure = 1.0;
                            scene.environmentIntensity = 1.6;
                            onMount?.(gl.domElement);
                        }}
                    >
                        <ModelScene
                            imageUrl={imageUrl}
                            imageMaskConfig={imageMaskConfig}
                            initialRotationX={initialRotationX}
                            initialRotationY={initialRotationY}
                            onRotationChange={onRotationChange}
                            rootRef={rootRef}
                            cameraRef={cameraRef}
                            zoom={zoom}
                            onApi={onApi}
                        />
                    </Canvas>
                </div>
            </div>
        </div>
    );
}