/**
 * Tool Registry — defines all map tools and lazily loads their panels/overlays.
 *
 * The tool metadata (id, label, icon, etc.) is declared statically so the
 * tab bar can render without loading Leaflet. The Panel and Overlay components
 * are loaded via next/dynamic with ssr:false to prevent leaflet/leaflet.heat
 * from running during SSR/prerendering (they access `window` at import time).
 *
 * Previously a standalone page at `/map/<tool-id>`; now each tool is a tab on
 * the unified Map Hub (`/map?tool=<id>`).
 */
"use client";

import type { MapTool } from "./types";
import dynamic from "next/dynamic";
import {
  Target, Flame, ThermometerSun, Camera, CloudRain,
  Wifi, Leaf, Bot, Mic,
} from "lucide-react";

// ── Tool metadata (no leaflet imports — safe during SSR) ───────────────────

const TOOL_META: Omit<MapTool, "Panel" | "Overlay">[] = [
  {
    id: "data-hunter",
    label: "Truy đuổi dữ liệu",
    longLabel: "Truy đuổi dữ liệu",
    icon: Target,
    description: "Tìm khoảng trống giáo dục bằng phân tích lưới ô dữ liệu.",
    longDescription: "Phân tích lưới ô để tìm khu vực chưa có cơ sở giáo dục.",
    authRequired: true,
    hideBaseLayers: true,
  },
  {
    id: "gap-predictor",
    label: "Dự báo khoảng trống",
    longLabel: "Dự báo khoảng trống",
    icon: Flame,
    description: "Dự báo vùng thiếu giáo dục trong tương lai bằng mô hình AI.",
    longDescription: "Sử dụng mô hình dự báo của ai-service để dự báo khu vực thiếu giáo dục.",
    authRequired: false,
    hideBaseLayers: false,
  },
  {
    id: "resource-optimizer",
    label: "Tối ưu nguồn lực",
    longLabel: "Tối ưu nguồn lực",
    icon: ThermometerSun,
    description: "Đề xuất phân bổ nguồn lực để khai thác hiệu quả các cơ sự giáo dục.",
    longDescription: "Tính toán kế hoạch đầu tư tối ưu dựa trên ngân sách và nhu cầu thực tế.",
    authRequired: false,
    hideBaseLayers: false,
  },
  {
    id: "geo-vision",
    label: "GeoVision AI",
    longLabel: "GeoVision AI",
    icon: Camera,
    description: "Phát hiện cơ sở giáo dục mới từ ảnh vệ tinh qua AI.",
    longDescription: "Dò tìm trường học/chợ học chưa được đưa vào bản đồ bằng AI nhận dạng ảnh vệ tinh.",
    authRequired: false,
    hideBaseLayers: false,
  },
  {
    id: "survey-planner",
    label: "Kế hoạch khảo sát",
    longLabel: "Kế hoạch khảo sát",
    icon: Target,
    description: "Lên lộ trình khảo sát hiệu quả nhất cho đội ngũ thực địa.",
    longDescription: "Tính toán điểm khảo sát tiếp cận thông tin mới nhất dựa trên thời gian và khoảng cách.",
    authRequired: false,
    hideBaseLayers: false,
  },
  {
    id: "climate",
    label: "Bảo vệ khí hậu",
    longLabel: "Bảo vệ khí hậu",
    icon: CloudRain,
    description: "Đánh giá rủi ro khí hậu và đề xuất tuyến đường an toàn.",
    longDescription: "Phân tích rủi ro lũ lụt, thời tiết và tiếp cận giao thông để đưa ra gợi ý an toàn.",
    authRequired: false,
    hideBaseLayers: false,
  },
  {
    id: "ai-agent",
    label: "AI Agent",
    longLabel: "AI Agent bản đồ",
    icon: Bot,
    description: "Chat tự nhiên → truy vấn GIS qua AI agent.",
    longDescription: "Nhập câu hỏi bằng ngôn ngữ tự nhiên, AI chuyển thành truy vấn bản đồ và hiển thị kết quả.",
    authRequired: false,
    hideBaseLayers: false,
  },
  {
    id: "voice-search",
    label: "Giọng nói",
    longLabel: "Tìm bằng giọng nói",
    icon: Mic,
    description: "Tìm địa điểm trên bản đồ bằng giọng nói.",
    longDescription: "Sử dụng Web Speech API tìm kiếm bản đồ, phân loại intent tự động.",
    authRequired: false,
    hideBaseLayers: false,
  },
  {
    id: "wifi",
    label: "Wifi",
    longLabel: "Trạm Wifi",
    icon: Wifi,
    description: "Hiển thị trạm Wifi trên bản đồ.",
    longDescription: "Hiển thị trạm Wifi miễn phí/trả tiền với phân màu tốc độ.",
    authRequired: false,
    hideBaseLayers: false,
  },
  {
    id: "green",
    label: "Xanh",
    longLabel: "Thử thách xanh",
    icon: Leaf,
    description: "Hiển thị thử thách sống xanh trên bản đồ.",
    longDescription: "Hiển thị các thử thách xanh và hoạt động sinh thái trên bản đồ.",
    authRequired: false,
    hideBaseLayers: false,
  },
];

// ── Dynamic Panel / Overlay components (ssr:false — leaflet stays off the server) ─

const DataHunterPanel = dynamic(() => import("./DataHunterTool").then((m) => m.DataHunterPanel), { ssr: false });
const GapPredictorPanel = dynamic(() => import("./GapPredictorTool").then((m) => m.GapPredictorPanel), { ssr: false });
const ResourceOptimizerPanel = dynamic(() => import("./ResourceOptimizerTool").then((m) => m.ResourceOptimizerPanel), { ssr: false });
const GeoVisionPanel = dynamic(() => import("./GeoVisionTool").then((m) => m.GeoVisionPanel), { ssr: false });
const SurveyPlannerPanel = dynamic(() => import("./SurveyPlannerTool").then((m) => m.SurveyPlannerPanel), { ssr: false });
const ClimateGuardianPanel = dynamic(() => import("./ClimateGuardianTool").then((m) => m.ClimateGuardianPanel), { ssr: false });

const AiAgentPanel = dynamic(() => import("./AiAgentTool").then((m) => m.AiAgentPanel), { ssr: false });
const VoiceSearchPanel = dynamic(() => import("./VoiceSearchTool").then((m) => m.VoiceSearchPanel), { ssr: false });
const WifiPanel = dynamic(() => import("./WifiTool").then((m) => m.WifiPanel), { ssr: false });
const GreenPanel = dynamic(() => import("./GreenTool").then((m) => m.GreenPanel), { ssr: false });

const DataHunterOverlay = dynamic(() => import("./DataHunterTool").then((m) => m.DataHunterOverlay), { ssr: false });
const GapPredictorOverlay = dynamic(() => import("./GapPredictorTool").then((m) => m.GapPredictorOverlay), { ssr: false });
const ResourceOptimizerOverlay = dynamic(() => import("./ResourceOptimizerTool").then((m) => m.ResourceOptimizerOverlay), { ssr: false });
const GeoVisionOverlay = dynamic(() => import("./GeoVisionTool").then((m) => m.GeoVisionOverlay), { ssr: false });
const SurveyPlannerOverlay = dynamic(() => import("./SurveyPlannerTool").then((m) => m.SurveyPlannerOverlay), { ssr: false });
const ClimateGuardianOverlay = dynamic(() => import("./ClimateGuardianTool").then((m) => m.ClimateGuardianOverlay), { ssr: false });

const AiAgentOverlay = dynamic(() => import("./AiAgentTool").then((m) => m.AiAgentOverlay), { ssr: false });
const VoiceSearchOverlay = dynamic(() => import("./VoiceSearchTool").then((m) => m.VoiceSearchOverlay), { ssr: false });
const WifiOverlay = dynamic(() => import("./WifiTool").then((m) => m.WifiOverlay), { ssr: false });
const GreenOverlay = dynamic(() => import("./GreenTool").then((m) => m.GreenOverlay), { ssr: false });

// ── Assemble MapTool objects ───────────────────────────────────────────────

export const MAP_TOOLS: MapTool[] = [
  {
    ...TOOL_META[0], Panel: DataHunterPanel, Overlay: DataHunterOverlay,
  },
  {
    ...TOOL_META[1], Panel: GapPredictorPanel, Overlay: GapPredictorOverlay,
  },
  {
    ...TOOL_META[2], Panel: ResourceOptimizerPanel, Overlay: ResourceOptimizerOverlay,
  },
  {
    ...TOOL_META[3], Panel: GeoVisionPanel, Overlay: GeoVisionOverlay,
  },
  {
    ...TOOL_META[4], Panel: SurveyPlannerPanel, Overlay: SurveyPlannerOverlay,
  },
  {
    ...TOOL_META[5], Panel: ClimateGuardianPanel, Overlay: ClimateGuardianOverlay,
  },
  {
    ...TOOL_META[6], Panel: AiAgentPanel, Overlay: AiAgentOverlay,
  },
  {
    ...TOOL_META[7], Panel: VoiceSearchPanel, Overlay: VoiceSearchOverlay,
  },
  {
    ...TOOL_META[8], Panel: WifiPanel, Overlay: WifiOverlay,
  },
  {
    ...TOOL_META[9], Panel: GreenPanel, Overlay: GreenOverlay,
  },
];

export const MAP_TOOL_BY_ID: Record<string, MapTool> = Object.fromEntries(
  MAP_TOOLS.map((t) => [t.id, t])
);

export function getMapTool(id: string | null): MapTool | undefined {
  if (!id) return undefined;
  return MAP_TOOL_BY_ID[id];
}
