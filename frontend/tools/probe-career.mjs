import { chromium } from 'playwright';
const b64url = (s) => Buffer.from(s).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const now = Math.floor(Date.now()/1000);
const tok = `${b64url(JSON.stringify({alg:'HS256',typ:'JWT'}))}.${b64url(JSON.stringify({sub:'1',email:'dev@edumap.vn',role:'admin',exp:now+86400,iat:now}))}.x`;

(async () => {
  const browser = await chromium.launch({ headless: true });
  for (const [label, vp] of [['desktop',[1280,900]],['mobile',[390,844]]]) {
    const page = await browser.newPage({ viewport: { width: vp[0], height: vp[1] } });
    await page.addInitScript((t) => {
      localStorage.setItem('edumap-access-token', t);
      localStorage.setItem('edumap-refresh-token', t);
      localStorage.setItem('edumap-user-info', JSON.stringify({id:'1',email:'dev@edumap.vn',fullName:'Dev',role:'admin'}));
    }, tok);
    await page.goto('http://localhost:3000/career', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(()=>{});
    await page.waitForTimeout(3000);
    const res = await page.evaluate(() => {
      const w = window.innerWidth, h = window.innerHeight;
      const allRects = (sel) => {
        const out = [];
        for (const el of document.querySelectorAll(sel)) {
          const r = el.getBoundingClientRect();
          out.push({ tag: el.tagName, cls: String(el.className||'').slice(0,55), top:+r.top.toFixed(0), bottom:+r.bottom.toFixed(0), w:+r.width.toFixed(0), h:+r.height.toFixed(0) });
        }
        return out;
      };
      // career tab buttons — they are <button> with role/tab or the border-b bg-card
      return {
        vp:{w,h}, url:window.location.href,
        bodyText: (document.body.innerText||'').slice(0,120).replace(/\n/g,' '),
        tabBar: allRects('.border-b.border-border.bg-card'),
        tabButtons: allRects('.border-b.border-border.bg-card button, .border-b.border-border button'),
        tabButtonsAll: allRects('button[class*="border"], button[aria-pressed="true"]'),
      };
    });
    console.log(`\n=== career / ${label} vp ${res.vp.w}x${res.vp.h} url=${res.url.replace('http://localhost:3000','')} ===`);
    console.log(' bodyText:', res.bodyText);
    console.log(' tabBar:', JSON.stringify(res.tabBar));
    console.log(' tabButtons:', JSON.stringify(res.tabButtons));
    console.log(' tabButtonsAll:', JSON.stringify(res.tabButtonsAll.slice(0,10)));
    await page.close();
  }
  await browser.close();
})();
