/**
 * Redirect: /map/geo-vision → /map?tool=geo-vision
 *
 * GeoVision AI is now a tool tab on the unified Map Hub. This redirect page
 * preserves backward compatibility for existing links/bookmarks.
 */
import { redirect } from "next/navigation";

export default function GeoVisionRedirect() {
  redirect("/map?tool=geo-vision");
}
