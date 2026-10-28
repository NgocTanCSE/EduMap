/**
 * Redirect: /talk2map → /map
 *
 * Talk2Map search is now integrated into the unified Map Hub (/map). Instead of a
 * hard redirect, we show a popup so the user stays on the current page (Image 13).
 */
"use client";

import { useState } from "react";
import { MapToolRedirectPopup } from "@/components/ui/MapToolRedirectPopup";

export default function Talk2MapRedirect() {
  const [popupOpen, setPopupOpen] = useState(true);

  return (
    <MapToolRedirectPopup
      open={popupOpen}
      onClose={() => setPopupOpen(false)}
      toolId=""
      toolLabel="Talk2Map"
      description="Nhập câu tiếng Việt tự nhiên, nhận kết quả trên bản đồ. Tích hợp trên Bản đồ EduMap."
    />
  );
}
