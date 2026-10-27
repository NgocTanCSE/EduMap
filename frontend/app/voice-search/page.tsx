/**
 * Redirect: /voice-search → /map?tool=voice-search
 *
 * Voice Search is now a tool tab on the unified Map Hub (/map).
 * This redirect page preserves backward compatibility for existing links/bookmarks.
 */
import { redirect } from "next/navigation";

export default function VoiceSearchRedirect() {
  redirect("/map?tool=voice-search");
}
