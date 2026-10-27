/**
 * Redirect: /wifi → /map?tool=wifi
 *
 * Wifi hotspot display is now a tool tab on the unified Map Hub (/map).
 * This redirect page preserves backward compatibility for existing links/bookmarks.
 */
import { redirect } from "next/navigation";

export default function WifiRedirect() {
  redirect("/map?tool=wifi");
}
