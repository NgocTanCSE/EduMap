/**
 * Redirect: /map/survey-planner → /map?tool=survey-planner
 *
 * Survey Planner is now a tool tab on the unified Map Hub. Instead of a hard
 * redirect, we show a popup so the user stays on the current page (Image 13).
 */
"use client";

import { useState } from "react";
import { MapToolRedirectPopup } from "@/components/ui/MapToolRedirectPopup";

export default function SurveyPlannerRedirect() {
  const [popupOpen, setPopupOpen] = useState(true);

  return (
    <MapToolRedirectPopup
      open={popupOpen}
      onClose={() => setPopupOpen(false)}
      toolId="survey-planner"
      toolLabel="Kế hoạch khảo sát AI"
      description="Chọn điểm khảo sát tối đa hoá thông tin thu được. Tích hợp trên Bản đồ EduMap."
    />
  );
}
