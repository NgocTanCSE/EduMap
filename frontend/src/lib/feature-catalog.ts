import type { ComponentType } from "react";
import { Atom, BarChart3, BookMarked, BookOpen, Bot, BrainCircuit, Briefcase, Building2, Calendar, ClipboardList, CloudOff, Compass, GraduationCap, HandHeart, HeartHandshake, Languages, Layers, LayoutDashboard, Leaf, Map, MapPinned, Medal, MessagesSquare, Network, Package, Plane, Radar, Rocket, Route, School, Sparkles, Store, Sun, Target, TrendingUp, Trophy, Users, Wallet, Wifi, } from "lucide-react";
export type FeatureGroupId = "core" | "ai" | "learn" | "career" | "community" | "market";
export type IconComponent = ComponentType<{
    className?: string;
}>;
export type Feature = {
    id: string;
    label: string;
    href: string;
    icon: IconComponent;
    description: string;
    group: FeatureGroupId;
    sidebar?: boolean;
    keywords?: string[];
};
export type FeatureGroup = {
    id: FeatureGroupId;
    label: string;
    description: string;
    icon: IconComponent;
};
export const FEATURE_GROUPS: FeatureGroup[] = [
    {
        id: "core",
        label: "Bản đồ & cá nhân",
        description: "Bản đồ giáo dục tương tác và bảng điều khiển cá nhân.",
        icon: Map,
    },
    {
        id: "learn",
        label: "Học tập",
        description: "Học bổng, học liệu, du học và phòng lab STEM.",
        icon: BookOpen,
    },
    {
        id: "career",
        label: "Hướng nghiệp",
        description: "Khám phá nghề nghiệp, việc làm và thực tập.",
        icon: Compass,
    },
    {
        id: "community",
        label: "Cộng đồng",
        description: "Cố vấn, sự kiện và các hoạt động đóng góp tại địa phương.",
        icon: Users,
    },
    {
        id: "ai",
        label: "Trợ lý AI",
        description: "Hỏi đáp có trích nguồn, dịch và đơn giản hoá văn bản.",
        icon: Sparkles,
    },
    {
        id: "market",
        label: "Đóng góp",
        description: "Quyên góp và ghép nhu cầu của tổ chức với nhà tài trợ.",
        icon: HandHeart,
    },
];
export const FEATURES: Feature[] = [
    {
        id: "map",
        label: "Bản đồ",
        href: "/map",
        icon: Map,
        description: "Bản đồ giáo dục tương tác: trường học, thư viện, Wifi. Gồm 9 công cụ: Data Hunter, Gap Predictor, Tối ưu nguồn lực, GeoVision AI, Kế hoạch khảo sát, Bảo vệ khí hậu, AI Agent, Trạm Wifi, Thử thách xanh.",
        group: "core",
        sidebar: true,
        keywords: ["bản đồ", "map", "gis", "poi", "data-hunter", "gap-predictor", "geo-vision", "survey-planner", "climate", "resource-optimizer", "ai-agent", "wifi", "green"],
    },
    {
        id: "dashboard",
        label: "Bảng điều khiển",
        href: "/dashboard",
        icon: LayoutDashboard,
        description: "Tiến độ học tập, chứng chỉ và hoạt động cá nhân của bạn.",
        group: "core",
        sidebar: true,
        keywords: ["dashboard", "hồ sơ", "tiến độ"],
    },
    {
        id: "features",
        label: "Tất cả tính năng",
        href: "/features",
        icon: Layers,
        description: "Danh mục đủ mọi tính năng, gom theo nhóm và tìm kiếm được.",
        group: "core",
        sidebar: false,
        keywords: ["danh mục", "tính năng", "features", "hub"],
    },
    {
        id: "ai-chat",
        label: "Trợ lý AI",
        href: "/ai-chat",
        icon: BrainCircuit,
        description: "Hỏi đáp học tập, học bổng và nghề nghiệp có trích nguồn.",
        group: "core",
        sidebar: true,
        keywords: ["chat", "rag", "trợ lý"],
    },
    {
        id: "ai-agent",
        label: "AI Agent bản đồ",
        href: "/map?tool=ai-agent",
        icon: Bot,
        description: "Đặt câu hỏi dạng GIS, xem từng bước AI gọi công cụ.",
        group: "ai",
        keywords: ["agent", "gis", "công cụ", "tool"],
    },
    {
        id: "language-bridge",
        label: "Language Bridge AI",
        href: "/language-bridge",
        icon: Languages,
        description: "Đơn giản hoá văn bản, dịch thuật và đọc thành tiếng.",
        group: "learn",
        sidebar: true,
        keywords: ["dịch", "translate", "tts", "đơn giản hoá"],
    },
    {
        id: "offline-tutor",
        label: "Trợ lý ngoại tuyến",
        href: "/offline-tutor",
        icon: CloudOff,
        description: "Học tiếp khi mất mạng nhờ mô hình chạy ngay trên máy.",
        group: "ai",
        sidebar: false,
        keywords: ["offline", "ngoại tuyến", "tutor"],
    },
    {
        id: "knowledge-graph",
        label: "Đồ thị tri thức AI",
        href: "/knowledge-graph",
        icon: Network,
        description: "Khám phá quan hệ giữa trường, học bổng, nghề và kỹ năng.",
        group: "ai",
        sidebar: false,
        keywords: ["knowledge graph", "quan hệ", "liên kết"],
    },
    {
        id: "library",
        label: "Thư viện",
        href: "/library",
        icon: BookMarked,
        description: "Tìm học liệu, sách, video và tài liệu mở.",
        group: "learn",
        sidebar: true,
        keywords: ["thư viện", "sách", "học liệu", "library"],
    },
    {
        id: "scholarships",
        label: "Học bổng",
        href: "/scholarships",
        icon: GraduationCap,
        description: "Học bổng trong nước và quốc tế kèm nguồn chính thức.",
        group: "learn",
        sidebar: true,
        keywords: ["học bổng", "scholarship", "du học"],
    },
    {
        id: "intl",
        label: "Du học & Trao đổi",
        href: "/intl",
        icon: Plane,
        description: "Chương trình trao đổi, du học và học kỳ quốc tế.",
        group: "learn",
        sidebar: true,
        keywords: ["du học", "trao đổi", "international"],
    },
    {
        id: "stem",
        label: "STEM Labs",
        href: "/map?tool=stem",
        icon: Atom,
        description: "Đặt phòng lab, thiết bị STEM và xem lịch còn trống.",
        group: "learn",
        sidebar: true,
        keywords: ["stem", "lab", "thiết bị", "phòng thí nghiệm"],
    },
    {
        id: "learning-spaces",
        label: "Không gian học tập",
        href: "/map?tool=learning-space",
        icon: School,
        description: "So sánh phòng tự học, thư viện và không gian yên tĩnh.",
        group: "learn",
        keywords: ["không gian", "tự học", "study space"],
    },
    {
        id: "career",
        label: "Nghề nghiệp",
        href: "/career",
        icon: Compass,
        description: "Khám phá ngành nghề, kỹ năng và mức lương tham khảo.",
        group: "career",
        sidebar: true,
        keywords: ["nghề nghiệp", "career", "ngành"],
    },
    {
        id: "career-roadmap",
        label: "Lộ trình nghề",
        href: "/career/roadmap",
        icon: Route,
        description: "Lộ trình từng bước từ sinh viên tới vị trí mong muốn.",
        group: "career",
        keywords: ["lộ trình", "roadmap", "kỹ năng"],
    },
    {
        id: "career-jobs",
        label: "Việc làm",
        href: "/career/jobs",
        icon: Briefcase,
        description: "Tin tuyển dụng mới, được thu thập và làm sạch hằng ngày.",
        group: "career",
        keywords: ["việc làm", "tuyển dụng", "job"],
    },
    {
        id: "career-predictive",
        label: "Dự báo nghề nghiệp",
        href: "/career/predictive",
        icon: TrendingUp,
        description: "Xu hướng nhu cầu nhân lực theo dữ liệu thị trường.",
        group: "career",
        keywords: ["dự báo", "predict", "xu hướng"],
    },
    {
        id: "internships",
        label: "Thực tập",
        href: "/internships",
        icon: Building2,
        description: "Vị trí thực tập tại doanh nghiệp và tổ chức giáo dục.",
        group: "career",
        sidebar: true,
        keywords: ["thực tập", "internship"],
    },
    {
        id: "opportunities",
        label: "Cơ hội",
        href: "/opportunities",
        icon: Rocket,
        description: "Cuộc thi, chương trình tài trợ và hoạt động ngoại khoá.",
        group: "career",
        keywords: ["cơ hội", "cuộc thi", "opportunity"],
    },
    {
        id: "opportunity-radar",
        label: "Opportunity Radar",
        href: "/opportunities/radar",
        icon: Radar,
        description: "AI quét và xếp hạng cơ hội phù hợp với hồ sơ của bạn.",
        group: "career",
        keywords: ["radar", "gợi ý", "phù hợp"],
    },
    {
        id: "analytics",
        label: "Xu hướng thị trường",
        href: "/analytics/trends",
        icon: BarChart3,
        description: "Thống kê kỹ năng, ngành nghề và nhu cầu tuyển dụng.",
        group: "career",
        keywords: ["phân tích", "thống kê", "analytics", "xu hướng"],
    },
    {
        id: "mentor",
        label: "Cố vấn",
        href: "/mentor",
        icon: Users,
        description: "Kết nối với cố vấn theo ngành học và mục tiêu nghề nghiệp.",
        group: "community",
        sidebar: true,
        keywords: ["cố vấn", "mentor", "hướng dẫn"],
    },
    {
        id: "community",
        label: "Cộng đồng",
        href: "/community",
        icon: MessagesSquare,
        description: "Hỏi đáp, chia sẻ và kết nối với cộng đồng EduMap.",
        group: "community",
        sidebar: false,
        keywords: ["cộng đồng", "chia sẻ", "hỏi đáp"],
    },
    {
        id: "hs-connection",
        label: "Kết nối THPT",
        href: "/hs-connection",
        icon: Network,
        description: "Cầu nối giữa học sinh THPT và trường đại học, doanh nghiệp.",
        group: "community",
        sidebar: false,
        keywords: ["thpt", "kết nối", "trường"],
    },
    {
        id: "events",
        label: "Sự kiện",
        href: "/events",
        icon: Calendar,
        description: "Hội thảo, ngày hội tuyển sinh và workshop kỹ năng.",
        group: "community",
        sidebar: true,
        keywords: ["sự kiện", "event", "workshop"],
    },
    {
        id: "hackathon",
        label: "Hackathon",
        href: "/hackathon",
        icon: Trophy,
        description: "Cuộc thi lập trình, thể lệ và đội thi đang mở.",
        group: "community",
        sidebar: false,
        keywords: ["hackathon", "cuộc thi", "lập trình"],
    },
    {
        id: "leaderboard",
        label: "Bảng xếp hạng",
        href: "/leaderboard",
        icon: Medal,
        description: "Điểm đóng góp và thứ hạng của thành viên tích cực.",
        group: "community",
        sidebar: false,
        keywords: ["xếp hạng", "leaderboard", "điểm"],
    },
    {
        id: "green",
        label: "Thử thách xanh",
        href: "/map?tool=green",
        icon: Leaf,
        description: "Hoạt động sống xanh, chứng kiến và minh chứng tại TP. Hồ Chí Minh.",
        group: "community",
        sidebar: true,
        keywords: ["xanh", "môi trường", "green", "carbon"],
    },
    {
        id: "summer",
        label: "Mùa hè xanh",
        href: "/map?tool=summer",
        icon: Sun,
        description: "Chiến dịch hè, hoạt động tình nguyện theo mùa.",
        group: "community",
        sidebar: true,
        keywords: ["mùa hè", "summer", "chiến dịch"],
    },
    {
        id: "wifi",
        label: "Trạm Wifi",
        href: "/map?tool=wifi",
        icon: Wifi,
        description: "Danh sách trạm Wifi giáo dục và tốc độ kết nối thực tế.",
        group: "community",
        sidebar: true,
        keywords: ["wifi", "internet", "tốc độ"],
    },
    {
        id: "surveys",
        label: "Khảo sát",
        href: "/surveys",
        icon: ClipboardList,
        description: "Trả lời khảo sát ngắn để nhận gợi ý phù hợp hơn.",
        group: "community",
        keywords: ["khảo sát", "survey", "biểu mẫu"],
    },
    {
        id: "volunteer",
        label: "Tình nguyện",
        href: "/volunteer",
        icon: HeartHandshake,
        description: "Chiến dịch tình nguyện và hoạt động vì cộng đồng.",
        group: "community",
        keywords: ["tình nguyện", "volunteer", "cộng đồng"],
    },
    {
        id: "marketplace",
        label: "Chợ trao đổi",
        href: "/map?tool=market",
        icon: Store,
        description: "Mua bán, trao đổi sách và thiết bị học tập.",
        group: "market",
        sidebar: false,
        keywords: ["chợ", "marketplace", "sách", "thiết bị"],
    },
    {
        id: "donate",
        label: "Quyên góp",
        href: "/map?tool=donate",
        icon: Wallet,
        description: "Chiến dịch gây quỹ đã kiểm chứng cho học sinh khó khăn.",
        group: "market",
        sidebar: true,
        keywords: ["quyên góp", "donate", "gây quỹ"],
    },
    {
        id: "impact-match",
        label: "ImpactMatch",
        href: "/impact-match",
        icon: Target,
        description: "Ghép nhu cầu của tổ chức với nhà tài trợ phù hợp.",
        group: "market",
        sidebar: true,
        keywords: ["impact", "tài trợ", "ghép"],
    },
    {
        id: "resource-exchange",
        label: "Resource Exchange AI",
        href: "/resource-exchange",
        icon: Package,
        description: "Ghép sách, thiết bị và giờ tình nguyện đang dư với nhu cầu.",
        group: "market",
        sidebar: false,
        keywords: ["trao đổi", "nguồn lực", "exchange"],
    },
    {
        id: "impact-measurement",
        label: "Đo lường Tác động AI",
        href: "/dashboard/impact",
        icon: MapPinned,
        description: "Đo thay đổi khả năng tiếp cận trước và sau khi triển khai.",
        group: "market",
        sidebar: false,
        keywords: ["tác động", "impact", "đo lường"],
    },
];
export const SIDEBAR_FEATURES = FEATURES.filter((feature) => feature.sidebar);
export const SIDEBAR_GROUPS = FEATURE_GROUPS.map((group) => ({
    ...group,
    items: SIDEBAR_FEATURES.filter((feature) => feature.group === group.id),
})).filter((group) => group.items.length > 0);
export function normalizeSearch(value: string): string {
    return (value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase()
        .trim();
}
export function matchesFeature(feature: Feature, query: string): boolean {
    const needle = normalizeSearch(query);
    if (!needle)
        return true;
    const haystack = normalizeSearch([feature.label, feature.description, feature.href, ...(feature.keywords || [])].join(" "));
    return needle.split(/\s+/).every((token) => haystack.includes(token));
}
