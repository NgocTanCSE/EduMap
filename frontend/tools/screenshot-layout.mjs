import { chromium } from 'playwright';
import fs from 'fs';

const out = '/tmp/fescreenshots';
fs.mkdirSync(out, { recursive: true });

const viewports = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 1024, height: 768 },
  desktop: { width: 1280, height: 900 },
};

const routes = [
  { path: '/map', name: 'map' },
  { path: '/career', name: 'career' },
  { path: '/dashboard', name: 'dashboard' },
  { path: '/ai-chat', name: 'ai-chat' },
  { path: '/impact-match', name: 'impact-match' },
  { path: '/features', name: 'features' },
];

(async () => {
  const browser = await chromium.launch({ headless: false });

  for (const { path, name } of routes) {
    for (const [size, vp] of Object.entries(viewports)) {
      const page = await browser.newPage({ viewport: vp });
      page.on('console', (msg) => {
        if (msg.type() === 'error' && !String(msg.text()).includes('ResizeObserver')) {
          console.log(`[${name}-${size} console] ${msg.text()}`);
        }
      });
      try {
        await page.goto(`http://localhost:3000${path}`, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
        await page.waitForTimeout(4000);
        await page.screenshot({ path: `${out}/${name}-${size}.png`, fullPage: true });
        console.log(`captured ${name}-${size}`);
      } catch (e) {
        console.log(`FAILED ${name}-${size}: ${e.message}`);
      }
      await page.close();
    }
  }
  await browser.close();
})();
