/**
 * Redirect: /map/geo-vision → /map?tool=geo-vision
 *
 * GeoVision AI is now a tool tab on the unified Map Hub. Instead of a hard
 * redirect, we show a popup so the user stays on the current page (Image 13).
 */
"use client";

import { useState } from "react";
import { MapToolRedirectPopup } from "@/components/ui/MapToolRedirectPopup";

export default function GeoVisionRedirect() {
  const [popupOpen, setPopupOpen] = useState(true);

  return (
    <MapToolRedirectPopup
      open={popupOpen}
      onClose={() => setPopupOpen(false)}
      toolId="geo-vision"
      toolLabel="GeoVision AI"
      description="Phát hiện cơ sở giáo dục mới từ ảnh vệ tinh qua AI. Tích hợp trên Bản đồ EduMap."
    />
  );
}
