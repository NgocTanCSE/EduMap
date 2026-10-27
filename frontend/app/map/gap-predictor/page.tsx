/**
 * Redirect: /map/gap-predictor → /map?tool=gap-predictor
 *
 * Gap Predictor is now a tool tab on the unified Map Hub. This redirect page
 * preserves backward compatibility for existing links/bookmarks.
 */
import { redirect } from "next/navigation";

export default function GapPredictorRedirect() {
  redirect("/map?tool=gap-predictor");
}
