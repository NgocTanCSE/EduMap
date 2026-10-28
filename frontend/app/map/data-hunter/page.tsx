/**
 * Redirect: /map/data-hunter → /map?tool=data-hunter
 *
 * Data Hunter is now a tool tab on the unified Map Hub. Instead of a hard
 * redirect, we show a popup so the user stays on the current page (Image 13).
 */
"use client";

import { useState } from "react";
import { MapToolRedirectPopup } from "@/components/ui/MapToolRedirectPopup";

export default function DataHunterRedirect() {
  const [popupOpen, setPopupOpen] = useState(true);

  return (
    <MapToolRedirectPopup
      open={popupOpen}
      onClose={() => setPopupOpen(false)}
      toolId="data-hunter"
      toolLabel="Truy đuổi dữ liệu"
      description="Tìm khoảng trống giáo dục bằng phân tích lưới ô dữ liệu. Tích hợp trên Bản đồ EduMap."
    />
  );
}
