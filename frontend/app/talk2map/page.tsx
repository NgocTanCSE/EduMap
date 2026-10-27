/**
 * Redirect: /talk2map → /map
 *
 * Talk2Map search is now integrated into the unified Map Hub (/map).
 * The map page has a search bar, voice search button, and NL search.
 * This redirect page preserves backward compatibility.
 */
import { redirect } from "next/navigation";

export default function Talk2MapRedirect() {
  redirect("/map");
}
