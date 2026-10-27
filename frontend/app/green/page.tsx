/**
 * Redirect: /green → /map?tool=green
 *
 * Green challenges display is now a tool tab on the unified Map Hub (/map).
 * This redirect page preserves backward compatibility for existing links/bookmarks.
 */
import { redirect } from "next/navigation";

export default function GreenRedirect() {
  redirect("/map?tool=green");
}
