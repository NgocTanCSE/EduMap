/**
 * Redirect: /ai-agent → /map?tool=ai-agent
 *
 * AI Agent bản đồ is now a tool tab on the unified Map Hub (/map).
 * This redirect page preserves backward compatibility for existing links/bookmarks.
 */
import { redirect } from "next/navigation";

export default function AIAgentRedirect() {
  redirect("/map?tool=ai-agent");
}
