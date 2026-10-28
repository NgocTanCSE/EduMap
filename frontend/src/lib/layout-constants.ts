/**
 * Layout spacing constants — single source of truth cho sidebar width
 * và các giá trị positioning dùng trong cả AppLayout Sidebar và Map Hub.
 *
 * Trước đây Sidebar dùng 240px trong khi Map page dùng 272px → nút
 * "Mở bảng bản đồ" bị lệch 32px. Constants này đồng bộ cả hai.
 */

export const SIDEBAR_EXPANDED_WIDTH = 240;
export const SIDEBAR_COLLAPSED_WIDTH = 56;

/** Ghi đè CSS custom property để các component fixed-position (như nút
 *  "Mở bảng bản đồ" trên Map Hub) luôn đồng bộ với sidebar thực tế. */
export function setSidebarWidthVar(width: number) {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--sidebar-width", `${width}px`);
}

export function getSidebarWidthVar(): number {
  if (typeof document === "undefined") return SIDEBAR_EXPANDED_WIDTH;
  const val = getComputedStyle(document.documentElement).getPropertyValue("--sidebar-width").trim();
  const parsed = parseFloat(val);
  return Number.isFinite(parsed) ? parsed : SIDEBAR_EXPANDED_WIDTH;
}
