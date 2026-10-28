/**
 * Redirect: /map/resource-optimizer → /map?tool=resource-optimizer
 *
 * Resource Optimizer is now a tool tab on the unified Map Hub. Instead of a
 * hard redirect, we show a popup so the user stays on the current page (Image 13).
 */
"use client";

import { useState } from "react";
import { MapToolRedirectPopup } from "@/components/ui/MapToolRedirectPopup";

export default function ResourceOptimizerRedirect() {
  const [popupOpen, setPopupOpen] = useState(true);

  return (
    <MapToolRedirectPopup
      open={popupOpen}
      onClose={() => setPopupOpen(false)}
      toolId="resource-optimizer"
      toolLabel="Tối ưu nguồn lực"
      description="Đề xuất phân bổ nguồn lực để khai thác hiệu quả các cơ sở giáo dục. Tích hợp trên Bản đồ EduMap."
    />
  );
}
