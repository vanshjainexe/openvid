export type MockupCategory = "browser" | "mobile" | "ide" | "all";

// Available configurations for each mockup
export interface MockupFeatures {
    hasDarkMode: boolean;
    hasFrameColor: boolean;  // Header/frame color
    hasUrl: boolean;
    hasHeaderScale: boolean; // Proportional header scale
    hasHeaderOpacity: boolean; // Header/frame opacity
    hasCornerRadius: boolean;
}

// Current mockup configuration
export interface MockupConfig {
    darkMode: boolean;
    frameColor: string;      // Header/frame color
    url: string;
    headerScale: number;     // Header scale (50-150, where 100 is normal)
    headerOpacity: number;   // Header opacity (0-100)
    cornerRadius: number;
}

// Mockup definition
export interface Mockup {
    id: string;
    name: string;
    category: Exclude<MockupCategory, "all">;
    preview: React.ReactNode;
    features?: MockupFeatures; // Optional - uses DEFAULT if not defined
    defaultConfig?: Partial<MockupConfig>;
}

// Mockup system state
export interface MockupState {
    enabled: boolean;
    selectedMockupId: string;
    config: MockupConfig;
}

// Props for rendering a mockup on the canvas
export interface MockupRenderProps {
    children: React.ReactNode;
    config: MockupConfig;
    className?: string;
}

// Default configuration
export const DEFAULT_MOCKUP_CONFIG: MockupConfig = {
    darkMode: false,
    frameColor: "#f6f6f6",
    url: "https://openvid.dev",
    headerScale: 60,        // 100% = normal size
    headerOpacity: 100,     // 100% = fully opaque
    cornerRadius: 12,
};

// Default features (no features enabled)
export const DEFAULT_MOCKUP_FEATURES: MockupFeatures = {
    hasDarkMode: false,
    hasFrameColor: false,
    hasUrl: false,
    hasHeaderScale: false,
    hasCornerRadius: false,
    hasHeaderOpacity: false,
};

// Helper to get mockup features with fallback to default
export function getMockupFeatures(mockup: Mockup | undefined): MockupFeatures {
    return mockup?.features ?? DEFAULT_MOCKUP_FEATURES;
}

// Helper to get the initial config for a mockup
export function getMockupDefaultConfig(mockup: Mockup | undefined): MockupConfig {
    return {
        ...DEFAULT_MOCKUP_CONFIG,
        ...(mockup?.defaultConfig ?? {}),
    };
}
