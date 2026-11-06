import type { ComponentType } from "react";
export interface MapViewport {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
}
export interface ToolPanelProps {
    viewport: MapViewport | null;
    result: any;
    onResult: (result: any) => void;
    loading: boolean;
    setLoading: (l: boolean) => void;
    error: string | null;
    setError: (e: string | null) => void;
    active: boolean;
    user: any;
}
export interface ToolOverlayProps {
    result: any;
    viewport: MapViewport | null;
    points: any[];
    loading: boolean;
    onFeatureSelect?: (feature: any) => void;
}
export interface MapTool {
    id: string;
    label: string;
    longLabel: string;
    icon: ComponentType<{
        className?: string;
    }>;
    description: string;
    longDescription: string;
    authRequired: boolean;
    hideBaseLayers: boolean;
    defaultCenter?: {
        lat: number;
        lng: number;
    };
    Panel: ComponentType<ToolPanelProps>;
    Overlay: ComponentType<ToolOverlayProps>;
}
