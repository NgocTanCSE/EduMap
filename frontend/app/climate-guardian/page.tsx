/**
 * Redirect: /climate-guardian → /map?tool=climate
 *
 * Climate Guardian is now a tool tab on the unified Map Hub. This redirect
 * page preserves backward compatibility for existing links/bookmarks.
 */
import { redirect } from "next/navigation";

export default function ClimateGuardianRedirect() {
  redirect("/map?tool=climate");
}
