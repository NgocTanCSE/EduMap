/**
 * Redirect: /green → /map?tool=green
 *
 * Green challenges display is now a tool tab on the unified Map Hub (/map). Instead of a
 * hard redirect, we show a popup so the user stays on the current page (Image 13).
 */
"use client";

import { useState } from "react";
import { MapToolRedirectPopup } from "@/components/ui/MapToolRedirectPopup";

export default function GreenRedirect() {
  const [popupOpen, setPopupOpen] = useState(true);

  return (
    <MapToolRedirectPopup
      open={popupOpen}
      onClose={() => setPopupOpen(false)}
      toolId="green"
      toolLabel="Thử thách xanh"
      description="Hoạt động sống xanh, minh chứng và điểm thưởng. Tích hợp trên Bản đồ EduMap."
    />
  );
}
