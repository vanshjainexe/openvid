"use client";

import { AuthProvider } from "@/app/contexts/useAuth";
import RecordingOverlay from "../../components/ui/RecordingOverlay";
import { Mockup3dProvider } from "@/app/contexts/Mockup3dContext";
import { RecordingProvider } from "@/app/contexts/RecordingContext";

export default function EditorLayout({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <RecordingProvider>
                <Mockup3dProvider>
                    <div className="min-h-screen bg-neutral-950">
                        {children}
                    </div>
                </Mockup3dProvider>
                <RecordingOverlay />
            </RecordingProvider>
        </AuthProvider>
    );
}
