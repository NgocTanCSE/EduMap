import { GraduationCap, BookOpen, Atom, Leaf, ShoppingCart, Heart, Wifi, Home as HomeIcon, MapPin, Shield, Target, Construction, type LucideIcon, } from "lucide-react";
export type PinShape = "poi" | "featured" | "analysis";
export type PinSize = "sm" | "md" | "lg";
export type BadgeType = "verified" | "new" | "progress" | "amount" | "none";
export interface PinBadge {
    type: BadgeType;
    value?: number | string;
}
export interface PinThemeDef {
    color: string;
    icon: LucideIcon;
    shape: PinShape;
    size: PinSize;
    badgeSlot?: boolean;
}
export const PIN_THEMES: Record<string, PinThemeDef> = {
    stem: { color: "text-destructive", icon: Atom, shape: "featured", size: "md", badgeSlot: true },
    green: { color: "text-green-600", icon: Leaf, shape: "featured", size: "md", badgeSlot: true },
    summer: { color: "text-orange-500", icon: GraduationCap, shape: "featured", size: "md", badgeSlot: true },
    wifi: { color: "text-amber-400", icon: Wifi, shape: "featured", size: "md", badgeSlot: true },
    market: { color: "text-primary", icon: ShoppingCart, shape: "featured", size: "md", badgeSlot: true },
    donate: { color: "text-red-500", icon: Heart, shape: "featured", size: "md", badgeSlot: true },
    university: { color: "text-accent", icon: GraduationCap, shape: "poi", size: "md" },
    school: { color: "text-accent", icon: GraduationCap, shape: "poi", size: "md" },
    library: { color: "text-primary", icon: BookOpen, shape: "poi", size: "md" },
    bookstore: { color: "text-destructive", icon: BookOpen, shape: "poi", size: "md" },
    lab: { color: "text-primary", icon: Atom, shape: "poi", size: "md" },
    stem_poi: { color: "text-destructive", icon: Atom, shape: "poi", size: "md" },
    green_poi: { color: "text-green-600", icon: Leaf, shape: "poi", size: "md" },
    park: { color: "text-green-600", icon: Leaf, shape: "poi", size: "md" },
    cafe: { color: "text-orange-500", icon: HomeIcon, shape: "poi", size: "md" },
    restaurant: { color: "text-primary", icon: HomeIcon, shape: "poi", size: "md" },
    market_poi: { color: "text-primary", icon: ShoppingCart, shape: "poi", size: "md" },
    convenience: { color: "text-amber-400", icon: ShoppingCart, shape: "poi", size: "md" },
    survey: { color: "text-purple-500", icon: Target, shape: "analysis", size: "md", badgeSlot: true },
    route_origin: { color: "text-blue-500", icon: MapPin, shape: "analysis", size: "md" },
    route_dest: { color: "text-red-500", icon: MapPin, shape: "analysis", size: "md" },
    hazard: { color: "text-destructive", icon: Shield, shape: "analysis", size: "md", badgeSlot: true },
    gap: { color: "text-muted-foreground", icon: Construction, shape: "analysis", size: "md" },
    _default: { color: "text-muted-foreground", icon: MapPin, shape: "poi", size: "md" },
};
export function getPinTheme(category: string): PinThemeDef {
    const key = (category || "_default").toLowerCase();
    return PIN_THEMES[key] || PIN_THEMES["_default"];
}
export interface PinLegendItem {
    category: string;
    label: string;
    icon: LucideIcon;
    color: string;
    shape: PinShape;
}
export const PIN_LEGEND: PinLegendItem[] = [
    { category: "stem", label: "Phòng thí nghiệm STEM", icon: Atom, color: "text-destructive", shape: "featured" },
    { category: "green", label: "Thử thách sống xanh", icon: Leaf, color: "text-green-600", shape: "featured" },
    { category: "summer", label: "Chiến dịch mùa hè", icon: GraduationCap, color: "text-orange-500", shape: "featured" },
    { category: "wifi", label: "Trạm Wifi", icon: Wifi, color: "text-amber-400", shape: "featured" },
    { category: "donate", label: "Quyên góp", icon: Heart, color: "text-red-500", shape: "featured" },
    { category: "market", label: "Chợ & trao đổi", icon: ShoppingCart, color: "text-primary", shape: "featured" },
];
export const POI_LEGEND: PinLegendItem[] = [
    { category: "university", label: "Đại học", icon: GraduationCap, color: "text-accent", shape: "poi" },
    { category: "school", label: "Trường học", icon: GraduationCap, color: "text-accent", shape: "poi" },
    { category: "library", label: "Thư viện", icon: BookOpen, color: "text-primary", shape: "poi" },
    { category: "lab", label: "Lab", icon: Atom, color: "text-primary", shape: "poi" },
    { category: "green_poi", label: "Không gian xanh", icon: Leaf, color: "text-green-600", shape: "poi" },
    { category: "cafe", label: "Cà phê", icon: HomeIcon, color: "text-orange-500", shape: "poi" },
    { category: "restaurant", label: "Nhà hàng", icon: HomeIcon, color: "text-primary", shape: "poi" },
    { category: "market_poi", label: "Chợ", icon: ShoppingCart, color: "text-primary", shape: "poi" },
    { category: "convenience", label: "Tiện dịch vụ", icon: ShoppingCart, color: "text-amber-400", shape: "poi" },
    { category: "park", label: "Công viên", icon: Leaf, color: "text-green-600", shape: "poi" },
];
export const ANALYSIS_LEGEND: PinLegendItem[] = [
    { category: "survey", label: "Điểm khảo sát", icon: Target, color: "text-purple-500", shape: "analysis" },
    { category: "route_origin", label: "Điểm xuất phát", icon: MapPin, color: "text-blue-500", shape: "analysis" },
    { category: "route_dest", label: "Điểm đến", icon: MapPin, color: "text-red-500", shape: "analysis" },
    { category: "hazard", label: "Vùng nguy hiểm", icon: Shield, color: "text-destructive", shape: "analysis" },
    { category: "gap", label: "Khoảng trống", icon: Construction, color: "text-muted-foreground", shape: "analysis" },
];
