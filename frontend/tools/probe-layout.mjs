import { chromium } from 'playwright';
import fs from 'fs';

const out = '/tmp/fescreenshots';
fs.mkdirSync(out, { recursive: true });

const b64url = (s) => Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
const now = Math.floor(Date.now() / 1000);
const payload = b64url(JSON.stringify({
  sub: '1', email: 'dev@edumap.vn', role: 'admin',
  exp: now + 86400, iat: now, fullName: 'Dev User',
}));
const fakeToken = `${header}.${payload}.devsignature-fake`;

const viewports = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 1024, height: 768 },
  desktop: { width: 1280, height: 900 },
};

function probe(page) {
  return page.evaluate(() => {
    const w = window.innerWidth, h = window.innerHeight;
    const rect = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: +r.top.toFixed(0), bottom: +r.bottom.toFixed(0), left: +r.left.toFixed(0), right: +r.right.toFixed(0), width: +r.width.toFixed(0), height: +r.height.toFixed(0) };
    };
    const all = Array.from(document.querySelectorAll('*'));
    const overflows = [];
    for (const el of all) {
      const r = el.getBoundingClientRect();
      if (r.right > w + 2) overflows.push({ tag: el.tagName, cls: el.className.slice(0, 45), right: +r.right.toFixed(0) });
      if (r.bottom > h + 2) overflows.push({ tag: el.tagName, cls: el.className.slice(0, 45), bottom: +r.bottom.toFixed(0) });
    }
    return {
      viewport: { width: w, height: h },
      header: rect('header'),
      sidebar: rect('nav'),
      mapContainer: rect('#map'),
      mapPanelBox: rect('[data-map-panel]'),
      routeBtn: rect('[data-route-btn]'),
      routingPanel: rect('[data-routing-panel]'),
      floating: rect('.fixed.z-50'),
      careerTabBar: rect('.border-b.border-border.bg-card'),
      careerContent: rect('[data-career-content]'),
      overflows: overflows.slice(0, 20),
    };
  });
}

const routes = [
  { path: '/map?tool=data-hunter', name: 'map-dh' },
  { path: '/map?tool=climate', name: 'map-climate' },
  { path: '/map?tool=geo-vision', name: 'map-geo' },
  { path: '/career', name: 'career' },
  { path: '/ai-chat', name: 'ai-chat' },
  { path: '/dashboard', name: 'dashboard' },
  { path: '/impact-match', name: 'impact-match' },
];

(async () => {
  const browser = await chromium.launch({ headless: false });
  const summary = {};
  for (const { path, name } of routes) {
    summary[name] = {};
    for (const [size, vp] of Object.entries(viewports)) {
      const page = await browser.newPage({ viewport: vp });
      await page.addInitScript((token) => {
        window.localStorage.setItem('edumap-access-token', token);
        window.localStorage.setItem('edumap-refresh-token', token);
        window.localStorage.setItem('edumap-user-info', JSON.stringify({ id: '1', email: 'dev@edumap.vn', fullName: 'Dev User', role: 'admin' }));
      }, fakeToken);
      try {
        await page.goto(`http://localhost:3000${path}`, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
        await page.waitForTimeout(3500);
        const res = await probe(page);
        summary[name][size] = { ...res };
        console.log(`${name}-${size}: overflows=${res.overflows.length}`);
      } catch (e) {
        console.log(`FAILED ${name}-${size}: ${e.message}`);
      }
      await page.close();
    }
  }
  await browser.close();
  fs.writeFileSync('/tmp/fescreenshots/probe2.json', JSON.stringify(summary, null, 1));
  console.log('wrote probe2.json');
})();
