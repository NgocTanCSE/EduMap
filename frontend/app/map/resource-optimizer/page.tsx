/**
 * Redirect: /map/resource-optimizer → /map?tool=resource-optimizer
 *
 * Resource Optimizer is now a tool tab on the unified Map Hub. This redirect
 * page preserves backward compatibility for existing links/bookmarks.
 */
import { redirect } from "next/navigation";

export default function ResourceOptimizerRedirect() {
  redirect("/map?tool=resource-optimizer");
}
