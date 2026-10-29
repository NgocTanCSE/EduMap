import { chromium } from 'playwright';
import fs from 'fs';

const out = '/tmp/fescreenshots';
fs.mkdirSync(out, { recursive: true });

const viewports = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 1024, height: 768 },
  desktop: { width: 1280, height: 900 },
};

function probe(page) {
  return page.evaluate(() => {
    const vp = {
      width: window.innerWidth,
      height: window.innerHeight,
    };
    const get = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        class: el.className.slice(0, 120),
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        left: Math.round(r.left),
        right: Math.round(r.right),
        width: Math.round(r.width),
        height: Math.round(r.height),
        overflow: getComputedStyle(el).overflow,
      };
    };
    const results = {
      viewport: vp,
      header: get('header'),
      sidebar: get('nav'),
      mapContainer: get('#map'),
      mapPanel: get('[data-map-panel]'),
      mapPanelResizer: get('[data-resizer]'),
      routingPanel: get('[data-routing-panel], .routing-panel'),
      routingBtn: get('[data-routing-btn]'),
      routeBtn: get('[data-route-btn]'),
    };
    // find the floating tool panel by data attribute or class
    const floating = document.querySelector('[data-float-panel], [class*="fixed"][class*="z-50"], [class*="z-50"][class*="fixed"]') ||
      document.querySelector('.fixed.z-50');
    results.floatingPanel = floating ? (() => {
      const r = floating.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), height: Math.round(r.height) };
    })() : null;
    // career tab bar
    results.careerTabBar = get('.border-b.border-border.bg-card');
    // detect elements that overflow the viewport
    const all = Array.from(document.querySelectorAll('*'));
    const overflows = [];
    for (const el of all) {
      const r = el.getBoundingClientRect();
      if (r.right > vp.width + 2) {
        overflows.push({ tag: el.tagName, cls: el.className.slice(0,60), right: Math.round(r.right), width: Math.round(r.width) });
      }
      if (overflows.length > 20) break;
    }
    results.overflowersRight = overflows.slice(0, 15);
    return results;
  });
}

const routes = [
  { path: '/map', name: 'map' },
  { path: '/career', name: 'career' },
];

(async () => {
  const browser = await chromium.launch({ headless: false });
  const summary = {};
  for (const { path, name } of routes) {
    summary[name] = {};
    for (const [size, vp] of Object.entries(viewports)) {
      const page = await browser.newPage({ viewport: vp });
      try {
        await page.goto(`http://localhost:3000${path}`, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
        await page.waitForTimeout(3500);
        const res = await probe(page);
        summary[name][size] = res;
        console.log(`${name}-${size}: viewport ${res.viewport.width}x${res.viewport.height}`);
      } catch (e) {
        console.log(`FAILED ${name}-${size}: ${e.message}`);
      }
      await page.close();
    }
  }
  await browser.close();
  fs.writeFileSync('/tmp/fescreenshots/probe.json', JSON.stringify(summary, null, 1));
  console.log('wrote probe.json');
})();
