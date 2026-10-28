/**
 * Redirect: /climate-guardian → /map?tool=climate
 *
 * Climate Guardian is now a tool tab on the unified Map Hub. Instead of a
 * hard redirect, we show a popup so the user stays on the current page and
 * can choose to open the map tool (Image 13 — no separate site redirect).
 */
"use client";

import { useState } from "react";
import { MapToolRedirectPopup } from "@/components/ui/MapToolRedirectPopup";

export default function ClimateGuardianRedirect() {
  const [popupOpen, setPopupOpen] = useState(true);

  return (
    <MapToolRedirectPopup
      open={popupOpen}
      onClose={() => setPopupOpen(false)}
      toolId="climate"
      toolLabel="AI Bảo Vệ Khí Hậu"
      description="Bản đồ rủi ro lũ lũng + nơi học an toàn, tích hợp trên Bản đồ EduMap."
    />
  );
}
