"use client";
import type { MapTool } from "./types";
import dynamic from "next/dynamic";
import { CloudRain, Wifi, Leaf, BookOpen, Atom, Sun, Heart, ShoppingCart, Target, Flame, Banknote, Camera, } from "lucide-react";

const VISIBLE_TOOL_META: Omit<MapTool, "Panel" | "Overlay">[] = [
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

export const ARCHIVED_TOOL_META: Omit<MapTool, "Panel" | "Overlay">[] = [
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
        icon: Banknote,
        description: "Đề xuất phân bổ nguồn lực để khai thác hiệu quả các cơ sở giáo dục.",
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
        longDescription: "Dò tìm trường học/cơ sở học tập chưa được đưa vào bản đồ bằng AI nhận dạng ảnh vệ tinh.",
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
];

const ClimateGuardianPanel = dynamic(() => import("./ClimateGuardianTool").then((m) => m.ClimateGuardianPanel), { ssr: false });
const WifiPanel = dynamic(() => import("./WifiTool").then((m) => m.WifiPanel), { ssr: false });
const GreenPanel = dynamic(() => import("./GreenTool").then((m) => m.GreenPanel), { ssr: false });
const LearningSpacePanel = dynamic(() => import("./LearningSpaceTool").then((m) => m.LearningSpacePanel), { ssr: false });
const StemPanel = dynamic(() => import("./StemTool").then((m) => m.StemPanel), { ssr: false });
const SummerPanel = dynamic(() => import("./SummerTool").then((m) => m.SummerPanel), { ssr: false });
const DonatePanel = dynamic(() => import("./DonateTool").then((m) => m.DonatePanel), { ssr: false });
const MarketPanel = dynamic(() => import("./MarketTool").then((m) => m.MarketPanel), { ssr: false });
const ClimateGuardianOverlay = dynamic(() => import("./ClimateGuardianTool").then((m) => m.ClimateGuardianOverlay), { ssr: false });
const WifiOverlay = dynamic(() => import("./WifiTool").then((m) => m.WifiOverlay), { ssr: false });
const GreenOverlay = dynamic(() => import("./GreenTool").then((m) => m.GreenOverlay), { ssr: false });
const LearningSpaceOverlay = dynamic(() => import("./LearningSpaceTool").then((m) => m.LearningSpaceOverlay), { ssr: false });
const StemOverlay = dynamic(() => import("./StemTool").then((m) => m.StemOverlay), { ssr: false });
const SummerOverlay = dynamic(() => import("./SummerTool").then((m) => m.SummerOverlay), { ssr: false });
const DonateOverlay = dynamic(() => import("./DonateTool").then((m) => m.DonateOverlay), { ssr: false });
const MarketOverlay = dynamic(() => import("./MarketTool").then((m) => m.MarketOverlay), { ssr: false });

const TOOL_PARTS: Record<string, Pick<MapTool, "Panel" | "Overlay">> = {
    "climate": { Panel: ClimateGuardianPanel, Overlay: ClimateGuardianOverlay },
    "wifi": { Panel: WifiPanel, Overlay: WifiOverlay },
    "green": { Panel: GreenPanel, Overlay: GreenOverlay },
    "learning-space": { Panel: LearningSpacePanel, Overlay: LearningSpaceOverlay },
    "stem": { Panel: StemPanel, Overlay: StemOverlay },
    "summer": { Panel: SummerPanel, Overlay: SummerOverlay },
    "donate": { Panel: DonatePanel, Overlay: DonateOverlay },
    "market": { Panel: MarketPanel, Overlay: MarketOverlay },
};

export const MAP_TOOLS: MapTool[] = VISIBLE_TOOL_META.map((meta) => ({ ...meta, ...TOOL_PARTS[meta.id] }));
export const MAP_TOOL_BY_ID: Record<string, MapTool> = Object.fromEntries(MAP_TOOLS.map((t) => [t.id, t]));
export const ARCHIVED_MAP_TOOLS: Omit<MapTool, "Panel" | "Overlay">[] = ARCHIVED_TOOL_META;
export const ARCHIVED_TOOL_IDS: string[] = ARCHIVED_TOOL_META.map((t) => t.id);
export function isArchivedTool(id: string | null): boolean {
    if (!id)
        return false;
    return ARCHIVED_TOOL_IDS.includes(id);
}
export function getMapTool(id: string | null): MapTool | undefined {
    if (!id)
        return undefined;
    return MAP_TOOL_BY_ID[id];
}
