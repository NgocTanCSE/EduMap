/**
 * Plain-text rendering helpers.
 *
 * EduMap renders chat/tutor replies in plain-text bubbles
 * (`whitespace-pre-wrap`) — there is no markdown renderer anywhere in the app.
 * Models (DeepSeek/Gemini/Cloudflare) still emit `**bold**`, `# heading`,
 * ``` fences and `---` rules, which used to reach the UI as literal `***`
 * noise. The ai-service already strips these server-side
 * (`services/llm_service.py::_strip_markdown`); this is the client-side
 * safety net for cached/streamed payloads and for older browser tabs.
 */

const MD_FENCE = /```[a-zA-Z0-9_+.-]*\n?/g;
const MD_INLINE_CODE = /`([^`\n]+)`/g;
const MD_HEADING = /^\s{0,3}#{1,6}\s*/gm;
const MD_HR = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/gm;
const MD_LINK = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;
const MD_BOLD = /(\*\*\*|\*\*|__)(?=\S)([\s\S]+?)(?<=\S)\1/g;
const MD_STRIKE = /~~([\s\S]+?)~~/g;
const MD_ITALIC_STAR = /(?<![\w*])\*(?=\S)([^*\n]+?)(?<=\S)\*(?![\w*])/g;
const MD_ITALIC_UNDERSCORE = /(?<![\w_])_(?=\S)([^_\n]+?)(?<=\S)_(?![\w_])/g;
const MD_BULLET = /^(\s*)[*+-]\s+/gm;

/**
 * Flatten markdown markers into readable plain text.
 *
 * Structure is preserved: headings lose their `#`, bullet lists become `•`,
 * links become `label (url)`, code keeps its content without the fences.
 * Plain Vietnamese text passes through untouched, and the function is
 * idempotent.
 */
export function stripMarkdown(input?: string | null): string {
  if (!input) return '';

  let out = input.replace(/\r\n/g, '\n');

  out = out.replace(MD_FENCE, '');
  out = out.replace(MD_INLINE_CODE, '$1');
  out = out.replace(MD_HEADING, '');
  out = out.replace(MD_HR, '');
  out = out.replace(MD_LINK, (_match, label: string, url: string) => `${label} (${url})`);
  out = out.replace(MD_BOLD, '$2');
  out = out.replace(MD_STRIKE, '$1');
  out = out.replace(MD_ITALIC_STAR, '$1');
  out = out.replace(MD_ITALIC_UNDERSCORE, '$1');
  out = out.replace(MD_BULLET, (_match, indent: string) => `${indent}• `);
  out = out.replace(/\n{3,}/g, '\n\n');

  return out.trim();
}
