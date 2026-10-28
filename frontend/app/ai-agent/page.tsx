/**
 * Redirect: /ai-agent → /map?tool=ai-agent
 *
 * AI Agent bản đồ is now a tool tab on the unified Map Hub (/map). Instead of a
 * hard redirect, we show a popup so the user stays on the current page (Image 13).
 */
"use client";

import { useState } from "react";
import { MapToolRedirectPopup } from "@/components/ui/MapToolRedirectPopup";

export default function AIAgentRedirect() {
  const [popupOpen, setPopupOpen] = useState(true);

  return (
    <MapToolRedirectPopup
      open={popupOpen}
      onClose={() => setPopupOpen(false)}
      toolId="ai-agent"
      toolLabel="AI Agent bản đồ"
      description="Đặt câu hỏi dạng GIS, xem từng bước AI gọi công cụ. Tích hợp trên Bản đồ EduMap."
    />
  );
}
