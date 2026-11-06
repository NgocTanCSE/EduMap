#!/usr/bin/env node


const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");


const STALE_FILES = [

  "app/map/data-hunter/DataHunterMap.tsx",
  "app/map/gap-predictor/GapPredictorMap.tsx",
  "app/map/geo-vision/GeoVisionMap.tsx",
  "app/map/resource-optimizer/ResourceMap.tsx",
  "app/map/survey-planner/SurveyPlannerMap.tsx",
  "components/climate-guardian/ClimateGuardianMap.tsx",


  "app/certificates/page.tsx",
  "app/dashboard/saved/page.tsx",
  "app/marketplace/books/page.tsx",
  "app/notifications/page.tsx",
  "app/storage/page.tsx",
  "app/moderator/page.tsx",
  "app/mobile-unit/page.tsx",
  "app/career/quiz/page.tsx",


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


  "components/AgentationToolbar.tsx",


  "components/Header.tsx",
  "components/Footer.tsx",
  "components/MobileNav.tsx",
  "components/TopBar.tsx",
  "lib/theme.ts",


  "src/lib/plain-text.ts",
  "src/services/admin.service.ts",
  "src/services/analytics.service.ts",
  "src/services/dashboard.service.ts",
  "src/services/gamification.service.ts",
  "src/services/mobile-unit.service.ts",
  "src/services/moderator.service.ts",
  "src/services/notification.service.ts",



  "next.config.mjs",

  "tsconfig.tsbuildinfo",


  "public/sw.js",
  "public/sw.js.map",
  "public/workbox-4a6e5f9b.js",
  "public/workbox-4a6e5f9b.js.map",
  "public/swe-worker-5c72df51bb1f6ee0.js",
  "public/swe-worker-5c72df51bb1f6ee0.js.map",
  "public/edumap.db.bak-realdata",


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


  "Dockerfile.hf",
];


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

  }
  return false;
}

for (const rel of EMPTY_PARENTS) pruneIfEmpty(rel);

if (removed > 0) {
  console.log(`[strip-stale] removed ${removed} stale path(s) before build`);
} else {
  console.log("[strip-stale] tree is clean — nothing to remove");
}
