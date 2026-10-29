import { chromium } from 'playwright';

const HF = 'https://tancse2005-edumap.hf.space';
const viewports = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 1024, height: 768 },
  desktop: { width: 1280, height: 900 },
};

function probe() {
  return this.evaluate(() => {
    const w = window.innerWidth, h = window.innerHeight;
    const rect = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: +r.top.toFixed(0), bottom: +r.bottom.toFixed(0), left: +r.left.toFixed(0), right: +r.right.toFixed(0), width: +r.width.toFixed(0), height: +r.height.toFixed(0) };
    };
    const overflows = [];
    const all = Array.from(document.querySelectorAll('*'));
    for (const el of all) {
      const r = el.getBoundingClientRect();
      if (r.right > w + 2) overflows.push({ tag: el.tagName, cls: el.className.slice(0, 45), right: +r.right.toFixed(0) });
      if (r.bottom > h + 2) overflows.push({ tag: el.tagName, cls: el.className.slice(0, 45), bottom: +r.bottom.toFixed(0) });
    }
    return {
      viewport: { width: w, height: h },
      url: window.location.href,
      title: document.title,
      bodyText: (document.body.innerText || '').slice(0, 160).replace(/\n/g, ' '),
      header: rect('header'),
      sidebar: rect('nav'),
      mapContainer: rect('#map'),
      floating: rect('.fixed.z-50'),
      overflows: overflows.slice(0, 12),
    };
  });
}

const routes = ['/map', '/career', '/ai-chat', '/impact-match'];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('console', m => console.log('PAGE:', m.text()));
  for (const route of routes) {
    for (const [size, vp] of Object.entries(viewports)) {
      await page.setViewportSize(vp);
      try {
        await page.goto(HF + route, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
        await page.waitForTimeout(Math.random() * 1500 + 2500);
        const res = await probe.call(page);
        console.log(`\n=== ${route} / ${size} vp ${vp.width}x${vp.height} ===`);
        console.log(' url:', res.url);
        console.log(' title:', res.title);
        console.log(' body:', res.bodyText);
        console.log(' header:', JSON.stringify(res.header));
        console.log(' sidebar:', JSON.stringify(res.sidebar));
        console.log(' map:', JSON.stringify(res.mapContainer));
        console.log(' floating:', JSON.stringify(res.floating));
        if (res.overflows.length) console.log(' OVERFLOWS:', JSON.stringify(res.overflows));
      } catch (e) {
        console.log(`${route}/${size} FAILED: ${e.message}`);
      }
    }
  }
  await browser.close();
})();
