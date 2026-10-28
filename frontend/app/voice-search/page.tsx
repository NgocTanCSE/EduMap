/**
 * Redirect: /voice-search → /map?tool=voice-search
 *
 * Voice Search is now a tool tab on the unified Map Hub (/map). Instead of a
 * hard redirect, we show a popup so the user stays on the current page (Image 13).
 */
"use client";

import { useState } from "react";
import { MapToolRedirectPopup } from "@/components/ui/MapToolRedirectPopup";

export default function VoiceSearchRedirect() {
  const [popupOpen, setPopupOpen] = useState(true);

  return (
    <MapToolRedirectPopup
      open={popupOpen}
      onClose={() => setPopupOpen(false)}
      toolId="voice-search"
      toolLabel="Tìm bằng giọng nói"
      description="Nói câu tìm kiếm, EduMap chuyển thành truy vấn bản đồ. Tích hợp trên Bản đồ EduMap."
    />
  );
}
