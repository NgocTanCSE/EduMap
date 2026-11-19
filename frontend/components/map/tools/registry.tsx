"use client";
import type { MapTool } from "./types";
import dynamic from "next/dynamic";
import { Target, Flame, ThermometerSun, Camera, CloudRain, Wifi, Leaf, Bot, BookOpen, Atom, Sun, Heart, ShoppingCart, } from "lucide-react";
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
        tier: "analysis",
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
        tier: "analysis",
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
        tier: "analysis",
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
        tier: "analysis",
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
        tier: "analysis",
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
        tier: "core",
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
        tier: "analysis",
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
        tier: "core",
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
        tier: "core",
    },
    {
        id: "learning-space",
        label: "Nơi học",
        longLabel: "AI gợi ý nơi học",
        icon: BookOpen,
        description: "Tìm không gian học tập phù hợp và giải thích bằng AI.",
        longDescription: "Gợi ý nơi học theo khoảng cách, WiFi, độ yên tĩnh và giờ mở cửa, kèm lý do do AI giải thích.",
        authRequired: false,
        hideBaseLayers: false,
        tier: "core",
    },
    {
        id: "stem",
        label: "STEM Lab",
        longLabel: "Phòng Lab STEM",
        icon: Atom,
        description: "Tìm phòng lab STEM và đặt thiết bị ngay trên bản đồ.",
        longDescription: "Hiển thị phòng lab STEM đối tác, danh sách thiết bị và đặt lịch sử dụng ngay trong panel bản đồ.",
        authRequired: false,
        hideBaseLayers: false,
        tier: "analysis",
    },
    {
        id: "summer",
        label: "Mùa hè",
        longLabel: "Chiến dịch mùa hè",
        icon: Sun,
        description: "Chiến dịch tình nguyện mùa hè và đăng ký tham gia trên bản đồ.",
        longDescription: "Xem chiến dịch Mùa hè xanh theo địa bàn, báo cáo hoạt động hằng ngày và đăng ký tham gia ngay trong panel bản đồ.",
        authRequired: false,
        hideBaseLayers: false,
        tier: "analysis",
    },
    {
        id: "donate",
        label: "Quyên góp",
        longLabel: "Chiến dịch quyên góp",
        icon: Heart,
        description: "Chiến dịch quyên góp và ủng hộ ngay trên bản đồ.",
        longDescription: "Xem tiến độ các chiến dịch quyên góp theo địa điểm và ủng hộ trực tiếp trong panel bản đồ.",
        authRequired: false,
        hideBaseLayers: false,
        tier: "core",
    },
    {
        id: "market",
        label: "Chợ chia sẻ",
        longLabel: "Chợ chia sẻ & trao đổi",
        icon: ShoppingCart,
        description: "Tài liệu, sách và học cụ cộng đồng đang được chia sẻ trên bản đồ.",
        longDescription: "Xem sách, học cụ được cộng đồng chia sẻ theo vị trí, gửi yêu cầu mượn hoặc đăng tài liệu mới ngay trong panel bản đồ.",
        authRequired: false,
        hideBaseLayers: false,
        tier: "core",
    },
];
const DataHunterPanel = dynamic(() => import("./DataHunterTool").then((m) => m.DataHunterPanel), { ssr: false });
const GapPredictorPanel = dynamic(() => import("./GapPredictorTool").then((m) => m.GapPredictorPanel), { ssr: false });
const ResourceOptimizerPanel = dynamic(() => import("./ResourceOptimizerTool").then((m) => m.ResourceOptimizerPanel), { ssr: false });
const GeoVisionPanel = dynamic(() => import("./GeoVisionTool").then((m) => m.GeoVisionPanel), { ssr: false });
const SurveyPlannerPanel = dynamic(() => import("./SurveyPlannerTool").then((m) => m.SurveyPlannerPanel), { ssr: false });
const ClimateGuardianPanel = dynamic(() => import("./ClimateGuardianTool").then((m) => m.ClimateGuardianPanel), { ssr: false });
const AiAgentPanel = dynamic(() => import("./AiAgentTool").then((m) => m.AiAgentPanel), { ssr: false });
const WifiPanel = dynamic(() => import("./WifiTool").then((m) => m.WifiPanel), { ssr: false });
const GreenPanel = dynamic(() => import("./GreenTool").then((m) => m.GreenPanel), { ssr: false });
const LearningSpacePanel = dynamic(() => import("./LearningSpaceTool").then((m) => m.LearningSpacePanel), { ssr: false });
const StemPanel = dynamic(() => import("./StemTool").then((m) => m.StemPanel), { ssr: false });
const SummerPanel = dynamic(() => import("./SummerTool").then((m) => m.SummerPanel), { ssr: false });
const DonatePanel = dynamic(() => import("./DonateTool").then((m) => m.DonatePanel), { ssr: false });
const MarketPanel = dynamic(() => import("./MarketTool").then((m) => m.MarketPanel), { ssr: false });
const DataHunterOverlay = dynamic(() => import("./DataHunterTool").then((m) => m.DataHunterOverlay), { ssr: false });
const GapPredictorOverlay = dynamic(() => import("./GapPredictorTool").then((m) => m.GapPredictorOverlay), { ssr: false });
const ResourceOptimizerOverlay = dynamic(() => import("./ResourceOptimizerTool").then((m) => m.ResourceOptimizerOverlay), { ssr: false });
const GeoVisionOverlay = dynamic(() => import("./GeoVisionTool").then((m) => m.GeoVisionOverlay), { ssr: false });
const SurveyPlannerOverlay = dynamic(() => import("./SurveyPlannerTool").then((m) => m.SurveyPlannerOverlay), { ssr: false });
const ClimateGuardianOverlay = dynamic(() => import("./ClimateGuardianTool").then((m) => m.ClimateGuardianOverlay), { ssr: false });
const AiAgentOverlay = dynamic(() => import("./AiAgentTool").then((m) => m.AiAgentOverlay), { ssr: false });
const WifiOverlay = dynamic(() => import("./WifiTool").then((m) => m.WifiOverlay), { ssr: false });
const GreenOverlay = dynamic(() => import("./GreenTool").then((m) => m.GreenOverlay), { ssr: false });
const LearningSpaceOverlay = dynamic(() => import("./LearningSpaceTool").then((m) => m.LearningSpaceOverlay), { ssr: false });
const StemOverlay = dynamic(() => import("./StemTool").then((m) => m.StemOverlay), { ssr: false });
const SummerOverlay = dynamic(() => import("./SummerTool").then((m) => m.SummerOverlay), { ssr: false });
const DonateOverlay = dynamic(() => import("./DonateTool").then((m) => m.DonateOverlay), { ssr: false });
const MarketOverlay = dynamic(() => import("./MarketTool").then((m) => m.MarketOverlay), { ssr: false });
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
        ...TOOL_META[7], Panel: WifiPanel, Overlay: WifiOverlay,
    },
    {
        ...TOOL_META[8], Panel: GreenPanel, Overlay: GreenOverlay,
    },
    {
        ...TOOL_META[9], Panel: LearningSpacePanel, Overlay: LearningSpaceOverlay,
    },
    {
        ...TOOL_META[10], Panel: StemPanel, Overlay: StemOverlay,
    },
    {
        ...TOOL_META[11], Panel: SummerPanel, Overlay: SummerOverlay,
    },
    {
        ...TOOL_META[12], Panel: DonatePanel, Overlay: DonateOverlay,
    },
    {
        ...TOOL_META[13], Panel: MarketPanel, Overlay: MarketOverlay,
    },
];
export const MAP_TOOL_BY_ID: Record<string, MapTool> = Object.fromEntries(MAP_TOOLS.map((t) => [t.id, t]));
export function getMapTool(id: string | null): MapTool | undefined {
    if (!id)
        return undefined;
    return MAP_TOOL_BY_ID[id];
}
