export const SIDEBAR_EXPANDED_WIDTH = 240;
export const SIDEBAR_COLLAPSED_WIDTH = 56;
export function setSidebarWidthVar(width: number) {
    if (typeof document === "undefined")
        return;
    document.documentElement.style.setProperty("--sidebar-width", `${width}px`);
}
export function getSidebarWidthVar(): number {
    if (typeof document === "undefined")
        return SIDEBAR_EXPANDED_WIDTH;
    const val = getComputedStyle(document.documentElement).getPropertyValue("--sidebar-width").trim();
    const parsed = parseFloat(val);
    return Number.isFinite(parsed) ? parsed : SIDEBAR_EXPANDED_WIDTH;
}
