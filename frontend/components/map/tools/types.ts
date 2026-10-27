/**
 * Shared types for the unified Map Hub tool system.
 *
 * Every map-based analysis tool (Data Hunter, Gap Predictor, Resource
 * Optimizer, GeoVision, Survey Planner, Climate Guardian) is expressed as a
 * pair: a **Panel** (left-sidebar controls + data fetching) and an **Overlay**
 * (react-leaflet layers rendered inside the shared InteractiveMap).
 *
 * The unified `/map` page manages which tool is "active" and coordinates the
 * data flow: Panel.onResult → page-level state → Overlay props.
 */
import type { ComponentType } from "react";

/** Map bounds captured from the shared InteractiveMap viewport. */
export interface MapViewport {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/** Props passed to every tool's left-panel control component. */
export interface ToolPanelProps {
  /** Current map viewport (may be null until the map reports bounds). */
  viewport: MapViewport | null;
  /** Most recent result for this tool (preserved when switching away / back). */
  result: any;
  /** Push a new result so the Overlay can re-render. */
  onResult: (result: any) => void;
  /** Current loading / error state, controlled by the panel itself. */
  loading: boolean;
  setLoading: (l: boolean) => void;
  error: string | null;
  setError: (e: string | null) => void;
  /** Whether this tool's panel is currently the active tab. */
  active: boolean;
  /** Auth status (mirrors useRequireAuth so panels can decide to render). */
  user: any;
}

/** Props passed to every tool's map overlay renderer. */
export interface ToolOverlayProps {
  /** Result data produced by the panel (same object passed via onResult). */
  result: any;
  /** Current map viewport. */
  viewport: MapViewport | null;
  /** Base POI list (for context layers). */
  points: any[];
  /** Whether the panel is currently loading (shows a spinner overlay). */
  loading: boolean;
  /** Callback when a map feature is clicked (e.g. to show details). */
  onFeatureSelect?: (feature: any) => void;
}

/** A single map analysis tool registered in the Map Hub. */
export interface MapTool {
  id: string;
  /** Short label shown on the tab bar. */
  label: string;
  /** Longer label for the panel header. */
  longLabel: string;
  icon: ComponentType<{ className?: string }>;
  description: string;
  /** Short description for empty states / tooltips. */
  longDescription: string;
  /** Whether the tool requires authentication. */
  authRequired: boolean;
  /** Whether to hide the base POI markers when this tool is active. */
  hideBaseLayers: boolean;
  /** Default viewport to use when the tool activates (if no viewport yet). */
  defaultCenter?: { lat: number; lng: number };
  /** The control panel component. */
  Panel: ComponentType<ToolPanelProps>;
  /** The map overlay component (renders react-leaflet layers). */
  Overlay: ComponentType<ToolOverlayProps>;
}
