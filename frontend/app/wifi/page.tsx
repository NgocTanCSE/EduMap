/**
 * Redirect: /wifi → /map?tool=wifi
 *
 * Wifi hotspot display is now a tool tab on the unified Map Hub (/map). Instead of a
 * hard redirect, we show a popup so the user stays on the current page (Image 13).
 */
"use client";

import { useState } from "react";
import { MapToolRedirectPopup } from "@/components/ui/MapToolRedirectPopup";

export default function WifiRedirect() {
  const [popupOpen, setPopupOpen] = useState(true);

  return (
    <MapToolRedirectPopup
      open={popupOpen}
      onClose={() => setPopupOpen(false)}
      toolId="wifi"
      toolLabel="Trạm Wifi"
      description="Bản đồ điểm Wifi miễn phí và đo tốc độ thực tế. Tích hợp trên Bản đồ EduMap."
    />
  );
}
