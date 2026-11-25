import type { ComponentType } from "react";
import { Atom, BarChart3, BookMarked, BookOpen, BrainCircuit, Briefcase, Building2, Calendar, ClipboardList, CloudOff, CloudRain, Compass, GraduationCap, HandHeart, HeartHandshake, Languages, Layers, LayoutDashboard, Leaf, Map, MapPinned, Medal, MessagesSquare, Network, Package, Plane, Radar, Rocket, Route, School, Sparkles, Store, Sun, Target, TrendingUp, Trophy, Users, Wallet, Wifi, } from "lucide-react";
export type FeatureGroupId = "personal" | "map" | "learn" | "career" | "community" | "ai" | "contribute";
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
    keywords?: string[];
};
export type FeatureGroup = {
    id: FeatureGroupId;
    label: string;
    description: string;
    icon: IconComponent;
    hubHref: string;
};
export const FEATURE_GROUPS: FeatureGroup[] = [
    {
        id: "personal",
        label: "Bảng điều khiển",
        description: "Tiến độ học tập, chứng chỉ và hoạt động cá nhân của bạn.",
        icon: LayoutDashboard,
        hubHref: "/dashboard",
    },
    {
        id: "map",
        label: "Bản đồ",
        description: "Bản đồ giáo dục tương tác: trường học, thư viện, Wifi và các công cụ phân tích.",
        icon: Map,
        hubHref: "/map",
    },
    {
        id: "learn",
        label: "Học tập",
        description: "Học bổng, du học và học liệu.",
        icon: BookOpen,
        hubHref: "/scholarships",
    },
    {
        id: "career",
        label: "Hướng nghiệp",
        description: "Khám phá nghề nghiệp, việc làm, thực tập và cơ hội.",
        icon: Compass,
        hubHref: "/career",
    },
    {
        id: "community",
        label: "Cộng đồng",
        description: "Cố vấn, sự kiện, cuộc thi và hoạt động vì cộng đồng.",
        icon: Users,
        hubHref: "/community",
    },
    {
        id: "ai",
        label: "Trợ lý AI",
        description: "Hỏi đáp có trích nguồn, dịch và trợ lý ngoại tuyến.",
        icon: Sparkles,
        hubHref: "/ai-chat",
    },
    {
        id: "contribute",
        label: "Đóng góp",
        description: "Ghép nhu cầu, nguồn lực và đo lường tác động xã hội.",
        icon: HandHeart,
        hubHref: "/impact-match",
    },
];
export const FEATURES: Feature[] = [
    {
        id: "dashboard",
        label: "Bảng điều khiển",
        href: "/dashboard",
        icon: LayoutDashboard,
        description: "Tiến độ học tập, chứng chỉ và hoạt động cá nhân của bạn.",
        group: "personal",
        keywords: ["dashboard", "hồ sơ", "tiến độ", "cá nhân"],
    },
    {
        id: "features",
        label: "Tất cả tính năng",
        href: "/features",
        icon: Layers,
        description: "Danh mục đủ mọi tính năng, gom theo nhóm và tìm kiếm được.",
        group: "personal",
        keywords: ["danh mục", "tính năng", "features", "hub"],
    },
    {
        id: "map",
        label: "Bản đồ",
        href: "/map",
        icon: Map,
        description: "Bản đồ giáo dục tương tác kèm công cụ phân tích và tiện ích tại chỗ.",
        group: "map",
        keywords: ["bản đồ", "map", "gis", "poi", "climate", "wifi", "green", "stem", "nhà trường"],
    },
    {
        id: "green",
        label: "Thử thách xanh",
        href: "/map?tool=green",
        icon: Leaf,
        description: "Hoạt động sống xanh, chứng kiến và minh chứng tại TP. Hồ Chí Minh.",
        group: "map",
        keywords: ["xanh", "môi trường", "green", "carbon"],
    },
    {
        id: "summer",
        label: "Mùa hè xanh",
        href: "/map?tool=summer",
        icon: Sun,
        description: "Chiến dịch hè, hoạt động tình nguyện theo mùa.",
        group: "map",
        keywords: ["mùa hè", "summer", "chiến dịch"],
    },
    {
        id: "wifi",
        label: "Trạm Wifi",
        href: "/map?tool=wifi",
        icon: Wifi,
        description: "Danh sách trạm Wifi giáo dục và tốc độ kết nối thực tế.",
        group: "map",
        keywords: ["wifi", "internet", "tốc độ"],
    },
    {
        id: "stem",
        label: "STEM Labs",
        href: "/map?tool=stem",
        icon: Atom,
        description: "Đặt phòng lab, thiết bị STEM và xem lịch còn trống.",
        group: "map",
        keywords: ["stem", "lab", "thiết bị", "phòng thí nghiệm"],
    },
    {
        id: "learning-spaces",
        label: "Không gian học tập",
        href: "/map?tool=learning-space",
        icon: School,
        description: "So sánh phòng tự học, thư viện và không gian yên tĩnh.",
        group: "map",
        keywords: ["không gian", "tự học", "study space"],
    },
    {
        id: "donate",
        label: "Quyên góp",
        href: "/map?tool=donate",
        icon: Wallet,
        description: "Chiến dịch gây quỹ đã kiểm chứng cho học sinh khó khăn.",
        group: "map",
        keywords: ["quyên góp", "donate", "gây quỹ"],
    },
    {
        id: "marketplace",
        label: "Chợ trao đổi",
        href: "/map?tool=market",
        icon: Store,
        description: "Mua bán, trao đổi sách và thiết bị học tập.",
        group: "map",
        keywords: ["chợ", "marketplace", "sách", "thiết bị"],
    },
    {
        id: "climate",
        label: "Bảo vệ khí hậu",
        href: "/map?tool=climate",
        icon: CloudRain,
        description: "Đánh giá rủi ro khí hậu và đề xuất tuyến đường an toàn.",
        group: "map",
        keywords: ["khí hậu", "lũ lụt", "an toàn", "climate"],
    },
    {
        id: "scholarships",
        label: "Học bổng",
        href: "/scholarships",
        icon: GraduationCap,
        description: "Học bổng trong nước và quốc tế kèm nguồn chính thức.",
        group: "learn",
        keywords: ["học bổng", "scholarship", "du học"],
    },
    {
        id: "intl",
        label: "Du học & Trao đổi",
        href: "/intl",
        icon: Plane,
        description: "Chương trình trao đổi, du học và học kỳ quốc tế.",
        group: "learn",
        keywords: ["du học", "trao đổi", "international"],
    },
    {
        id: "library",
        label: "Thư viện",
        href: "/library",
        icon: BookMarked,
        description: "Tìm học liệu, sách, video và tài liệu mở.",
        group: "learn",
        keywords: ["thư viện", "sách", "học liệu", "library"],
    },
    {
        id: "career",
        label: "Nghề nghiệp",
        href: "/career",
        icon: Compass,
        description: "Khám phá ngành nghề, kỹ năng, việc làm, thực tập và cơ hội.",
        group: "career",
        keywords: ["nghề nghiệp", "career", "ngành", "việc làm", "thực tập"],
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
        id: "career-roadmap",
        label: "Lộ trình",
        href: "/career/roadmap",
        icon: Route,
        description: "Lộ trình từng bước từ sinh viên tới vị trí mong muốn.",
        group: "career",
        keywords: ["lộ trình", "roadmap", "kỹ năng"],
    },
    {
        id: "career-predictive",
        label: "Dự báo AI",
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
        label: "Thống kê",
        href: "/analytics/trends",
        icon: BarChart3,
        description: "Thống kê kỹ năng, ngành nghề và nhu cầu tuyển dụng.",
        group: "career",
        keywords: ["phân tích", "thống kê", "analytics", "xu hướng"],
    },
    {
        id: "community",
        label: "Cộng đồng",
        href: "/community",
        icon: MessagesSquare,
        description: "Cố vấn, sự kiện, cuộc thi và hoạt động vì cộng đồng.",
        group: "community",
        keywords: ["cộng đồng", "chia sẻ", "hỏi đáp"],
    },
    {
        id: "mentor",
        label: "Cố vấn",
        href: "/mentor",
        icon: Users,
        description: "Kết nối với cố vấn theo ngành học và mục tiêu nghề nghiệp.",
        group: "community",
        keywords: ["cố vấn", "mentor", "hướng dẫn"],
    },
    {
        id: "events",
        label: "Sự kiện",
        href: "/events",
        icon: Calendar,
        description: "Hội thảo, ngày hội tuyển sinh và workshop kỹ năng.",
        group: "community",
        keywords: ["sự kiện", "event", "workshop"],
    },
    {
        id: "hackathon",
        label: "Hackathon",
        href: "/hackathon",
        icon: Trophy,
        description: "Cuộc thi lập trình, thể lệ và đội thi đang mở.",
        group: "community",
        keywords: ["hackathon", "cuộc thi", "lập trình"],
    },
    {
        id: "leaderboard",
        label: "Bảng xếp hạng",
        href: "/leaderboard",
        icon: Medal,
        description: "Điểm đóng góp và thứ hạng của thành viên tích cực.",
        group: "community",
        keywords: ["xếp hạng", "leaderboard", "điểm"],
    },
    {
        id: "hs-connection",
        label: "Kết nối THPT",
        href: "/hs-connection",
        icon: Network,
        description: "Cầu nối giữa học sinh THPT và trường đại học, doanh nghiệp.",
        group: "community",
        keywords: ["thpt", "kết nối", "trường"],
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
        id: "surveys",
        label: "Khảo sát",
        href: "/surveys",
        icon: ClipboardList,
        description: "Trả lời khảo sát ngắn để nhận gợi ý phù hợp hơn.",
        group: "community",
        keywords: ["khảo sát", "survey", "biểu mẫu"],
    },
    {
        id: "ai-chat",
        label: "Hỏi đáp AI",
        href: "/ai-chat",
        icon: BrainCircuit,
        description: "Hỏi đáp học tập, học bổng và nghề nghiệp có trích nguồn.",
        group: "ai",
        keywords: ["chat", "rag", "trợ lý"],
    },
    {
        id: "language-bridge",
        label: "Language Bridge AI",
        href: "/language-bridge",
        icon: Languages,
        description: "Đơn giản hoá văn bản, dịch thuật và đọc thành tiếng.",
        group: "ai",
        keywords: ["dịch", "translate", "tts", "đơn giản hoá"],
    },
    {
        id: "offline-tutor",
        label: "Trợ lý ngoại tuyến",
        href: "/offline-tutor",
        icon: CloudOff,
        description: "Học tiếp khi mất mạng nhờ mô hình chạy ngay trên máy.",
        group: "ai",
        keywords: ["offline", "ngoại tuyến", "tutor"],
    },
    {
        id: "knowledge-graph",
        label: "Đồ thị tri thức AI",
        href: "/knowledge-graph",
        icon: Network,
        description: "Khám phá quan hệ giữa trường, học bổng, nghề và kỹ năng.",
        group: "ai",
        keywords: ["knowledge graph", "quan hệ", "liên kết"],
    },
    {
        id: "impact-match",
        label: "ImpactMatch",
        href: "/impact-match",
        icon: Target,
        description: "Ghép nhu cầu của tổ chức với nhà tài trợ phù hợp.",
        group: "contribute",
        keywords: ["impact", "tài trợ", "ghép"],
    },
    {
        id: "resource-exchange",
        label: "Resource Exchange AI",
        href: "/resource-exchange",
        icon: Package,
        description: "Ghép sách, thiết bị và giờ tình nguyện đang dư với nhu cầu.",
        group: "contribute",
        keywords: ["trao đổi", "nguồn lực", "exchange"],
    },
    {
        id: "impact-measurement",
        label: "Đo lường Tác động AI",
        href: "/impact",
        icon: MapPinned,
        description: "Đo thay đổi khả năng tiếp cận trước và sau khi triển khai.",
        group: "contribute",
        keywords: ["tác động", "impact", "đo lường"],
    },
];
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
export function featuresForGroup(group: FeatureGroupId): Feature[] {
    const items = FEATURES.filter((feature) => feature.group === group);
    const meta = FEATURE_GROUPS.find((g) => g.id === group);
    if (!meta)
        return items;
    const hubPath = meta.hubHref.split("?")[0];
    const hub = items.find((feature) => feature.href.split("?")[0] === hubPath);
    if (!hub)
        return items;
    return [hub, ...items.filter((feature) => feature.id !== hub.id)];
}
export function groupById(id: FeatureGroupId) {
    return FEATURE_GROUPS.find((group) => group.id === id);
}
export function groupForPath(pathname: string): FeatureGroup | undefined {
    const path = (pathname || "").split("?")[0].replace(/\/$/, "") || "/";
    const match = FEATURES
        .filter((feature) => feature.id !== "features")
        .map((feature) => ({ feature, path: feature.href.split("?")[0].replace(/\/$/, "") }))
        .filter(({ path: p }) => path === p || path.startsWith(p + "/"))
        .sort((a, b) => b.path.length - a.path.length)[0];
    if (!match)
        return undefined;
    return groupById(match.feature.group);
}
