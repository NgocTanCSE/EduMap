/**
 * Redirect: /map/survey-planner → /map?tool=survey-planner
 *
 * Survey Planner is now a tool tab on the unified Map Hub. This redirect page
 * preserves backward compatibility for existing links/bookmarks.
 */
import { redirect } from "next/navigation";

export default function SurveyPlannerRedirect() {
  redirect("/map?tool=survey-planner");
}
