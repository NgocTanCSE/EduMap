/**
 * Redirect: /map/gap-predictor → /map?tool=gap-predictor
 *
 * Gap Predictor is now a tool tab on the unified Map Hub. Instead of a hard
 * redirect, we show a popup so the user stays on the current page (Image 13).
 */
"use client";

import { useState } from "react";
import { MapToolRedirectPopup } from "@/components/ui/MapToolRedirectPopup";

export default function GapPredictorRedirect() {
  const [popupOpen, setPopupOpen] = useState(true);

  return (
    <MapToolRedirectPopup
      open={popupOpen}
      onClose={() => setPopupOpen(false)}
      toolId="gap-predictor"
      toolLabel="Dự báo khoảng trống"
      description="Dự báo Holt's Linear + DBSCAN, bản đồ rủi ro và xu hướng. Tích hợp trên Bản đồ EduMap."
    />
  );
}
