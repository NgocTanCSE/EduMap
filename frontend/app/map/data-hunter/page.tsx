/**
 * Redirect: /map/data-hunter → /map?tool=data-hunter
 *
 * Data Hunter is now a tool tab on the unified Map Hub. This redirect page
 * preserves backward compatibility for existing links/bookmarks.
 */
import { redirect } from "next/navigation";

export default function DataHunterRedirect() {
  redirect("/map?tool=data-hunter");
}
