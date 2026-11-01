#!/usr/bin/env node
/**
 * strip-stale-sources.js — remove build-crashing leftovers in the Docker build.
 *
 * WHY THIS EXISTS
 * ---------------
 * The Hugging Face Space repo only ever *receives* files. Deployments that
 * upload the folder (instead of mirroring it) never delete anything, so the
 * Space keeps components/pages that were removed from git months ago. Next.js
 * type-checks **every** file matched by `tsconfig.json`'s
 * `include: ["**\/*.ts", "**\/*.tsx"]`, even files nothing imports. One orphan
 * that references a dependency we no longer ship (e.g.
 * `components/AgentationToolbar.tsx` → `import('agentation')`) fails the whole
 * production build with "Compiled successfully … Type error: Cannot find
 * module 'agentation'".
 *
 * Every path below is NOT tracked by git in this repository, so deleting it is
 * always correct. On a clean checkout this script does nothing (all deletes are
 * guarded by `fs.existsSync`).
 *
 * Runs automatically via `npm run prebuild` (npm runs `prebuild` before
 * `build`), so it also executes inside the HF Docker image build.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

/** Files that only exist on the HF Space, superseded or deleted locally. */
const STALE_FILES = [
  // ── Map Hub: old standalone tool pages (now panels inside /map) ──────────
  "app/map/data-hunter/DataHunterMap.tsx",
  "app/map/gap-predictor/GapPredictorMap.tsx",
  "app/map/geo-vision/GeoVisionMap.tsx",
  "app/map/resource-optimizer/ResourceMap.tsx",
  "app/map/survey-planner/SurveyPlannerMap.tsx",
  "components/climate-guardian/ClimateGuardianMap.tsx",

  // ── Pages that were merged into hubs / removed ───────────────────────────
  "app/certificates/page.tsx",
  "app/dashboard/saved/page.tsx",
  "app/marketplace/books/page.tsx",
  "app/notifications/page.tsx",
  "app/storage/page.tsx",
  "app/moderator/page.tsx",
  "app/mobile-unit/page.tsx",
  "app/career/quiz/page.tsx",

  // ── BFF routes that no longer have a backend counterpart ─────────────────
  "api/payment/process/route.ts",
  "app/api/community/moderation/route.ts",
  "app/api/community/moderation/comments/route.ts",
  "app/api/community/moderation/comments/[id]/route.ts",
  "app/api/community/moderation/posts/route.ts",
  "app/api/community/moderation/posts/[id]/route.ts",
  "app/api/gamification/pending-activities/route.ts",
  "app/api/mentoring/mentors/[id]/recommend/route.ts",
  "app/api/mobile-config/units/route.ts",
  "app/api/mobile-config/units/[id]/schedule/route.ts",
  "app/api/mobile-units/route.ts",
  "app/api/mobile-units/[id]/schedule/route.ts",
  "app/api/summer-campaigns/route.ts",
  "app/api/summer-campaigns/[id]/daily-report/route.ts",
  "app/api/summer-campaigns/[id]/register/route.ts",

  // ── The file that broke the 2026-11-01 build (imports removed pkg) ───────
  "components/AgentationToolbar.tsx",

  // ── Old shell components replaced by AppLayout / Sidebar ─────────────────
  "components/Header.tsx",
  "components/Footer.tsx",
  "components/MobileNav.tsx",
  "components/TopBar.tsx",
  "lib/theme.ts",

  // ── Unused services / helpers (no importers in the tracked tree) ─────────
  "src/lib/plain-text.ts",
  "src/services/admin.service.ts",
  "src/services/analytics.service.ts",
  "src/services/dashboard.service.ts",
  "src/services/gamification.service.ts",
  "src/services/mobile-unit.service.ts",
  "src/services/moderator.service.ts",
  "src/services/notification.service.ts",

  // ── Config/cache conflicts ───────────────────────────────────────────────
  // Two Next configs: only `next.config.js` is authoritative (see its header).
  "next.config.mjs",
  // Stale incremental cache from a previous build of a different tree.
  "tsconfig.tsbuildinfo",

  // ── PWA / build artifacts left behind by an older `next build` ───────────
  "public/sw.js",
  "public/sw.js.map",
  "public/workbox-4a6e5f9b.js",
  "public/workbox-4a6e5f9b.js.map",
  "public/swe-worker-5c72df51bb1f6ee0.js",
  "public/swe-worker-5c72df51bb1f6ee0.js.map",
  "public/edumap.db.bak-realdata",

  // ── Legacy mock harness (already excluded from tsconfig) ─────────────────
  "test-app/__tests__/mock-handlers.test.js",
  "test-app/mock-handlers.ts",
  "test-app/mock-middleware.ts",
  "test-app/mock-server.js",
  "test-app/package.json",
  "test-app/tsconfig.json",
  "test-app/mock-data/ai-chat.ts",
  "test-app/mock-data/auth.ts",
  "test-app/mock-data/career.ts",
  "test-app/mock-data/gamification.ts",
  "test-app/mock-data/library.ts",
  "test-app/mock-data/schools.ts",
  "test-results/.last-run.json",

  // ── Leftover Docker metadata from the abandoned per-service builds ───────
  "Dockerfile.hf",
];

/** Whole directories that only exist on the Space (removed from git). */
const STALE_DIRS = ["test-app", "test-results"];

let removed = 0;

for (const rel of STALE_FILES) {
  const abs = path.join(ROOT, rel);
  try {
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      fs.unlinkSync(abs);
      removed += 1;
    }
  } catch (err) {
    console.warn(`[strip-stale] could not remove ${rel}: ${err.message}`);
  }
}

for (const rel of STALE_DIRS) {
  const abs = path.join(ROOT, rel);
  try {
    if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
      fs.rmSync(abs, { recursive: true, force: true });
      removed += 1;
    }
  } catch (err) {
    console.warn(`[strip-stale] could not remove dir ${rel}: ${err.message}`);
  }
}

// Empty parent dirs left behind (e.g. `app/map/geo-vision/`) would otherwise
// produce an empty route that fails `next build`'s page collection.
const EMPTY_PARENTS = [
  "app/map/data-hunter",
  "app/map/gap-predictor",
  "app/map/geo-vision",
  "app/map/resource-optimizer",
  "app/map/survey-planner",
  "components/climate-guardian",
  "app/api/community",
  "app/api/mobile-config",
  "app/api/mobile-units",
  "app/api/summer-campaigns",
  "app/api/mentoring",
  "app/api/gamification",
  "api",
];

function pruneIfEmpty(rel) {
  const abs = path.join(ROOT, rel);
  try {
    if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
      if (fs.readdirSync(abs).length === 0) {
        fs.rmdirSync(abs);
        removed += 1;
        return true;
      }
    }
  } catch {
    /* ignore */
  }
  return false;
}

for (const rel of EMPTY_PARENTS) pruneIfEmpty(rel);

if (removed > 0) {
  console.log(`[strip-stale] removed ${removed} stale path(s) before build`);
} else {
  console.log("[strip-stale] tree is clean — nothing to remove");
}
