import { chromium } from 'playwright';

const b64url = (s) => Buffer.from(s).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const now = Math.floor(Date.now()/1000);
const tok = `${b64url(JSON.stringify({alg:'HS256',typ:'JWT'}))}.${b64url(JSON.stringify({sub:'1',email:'dev@edumap.vn',role:'admin',exp:now+86400,iat:now}))}.x`;

const routes = [
  { path: '/career', name: 'career' },
  { path: '/dashboard', name: 'dashboard' },
  { path: '/impact-match', name: 'impact-match' },
  { path: '/map?tool=data-hunter', name: 'map' },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  for (const { path, name } of routes) {
    for (const [label, vp] of [['desktop',[1280,900]],['mobile',[390,844]]]) {
      const page = await browser.newPage({ viewport: { width: vp[0], height: vp[1] } });
      await page.addInitScript((t) => {
        localStorage.setItem('edumap-access-token', t);
        localStorage.setItem('edumap-refresh-token', t);
        localStorage.setItem('edumap-user-info', JSON.stringify({id:'1',email:'dev@edumap.vn',fullName:'Dev',role:'admin'}));
      }, tok);
      try {
        await page.goto('http://localhost:3000' + path, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(()=>{});
        await page.waitForTimeout(label === 'mobile' ? 3000 : 2500);
        const res = await page.evaluate(() => {
          const w = window.innerWidth, h = window.innerHeight;
          const g = (sel) => { const e = document.querySelector(sel); if(!e) return null; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return {top:+r.top.toFixed(0),bottom:+r.bottom.toFixed(0),left:+r.left.toFixed(0),right:+r.right.toFixed(0),w:+r.width.toFixed(0),h:+r.height.toFixed(0),pos:cs.position}; };
          let overflow = false; let maxBottom = 0;
          for (const el of document.querySelectorAll('*')) { const cs=getComputedStyle(el); if(cs.position==='fixed'||cs.position==='absolute') continue; const b = el.getBoundingClientRect().bottom; if (b > maxBottom) maxBottom = b; }
          overflow = maxBottom > h + 10;
          return { vp:{w,h}, url:window.location.href, sidebar: g('aside'), appContent: g('#app-content'), contentFirst: g('#app-content > div'), careerTabBar: g('.border-b.border-border.bg-card'), overflows: maxBottom > h ? {maxBottom: +maxBottom.toFixed(0)} : null };
        });
        console.log(`\n=== ${name} / ${label} vp ${res.vp.w}x${res.vp.h} ===`);
        console.log(' url:', res.url.replace('http://localhost:3000',''));
        console.log(' sidebar:', JSON.stringify(res.sidebar));
        console.log(' appContent:', JSON.stringify(res.appContent));
        console.log(' contentFirst:', JSON.stringify(res.contentFirst));
        console.log(' careerTabBar:', JSON.stringify(res.careerTabBar));
        console.log(' pageOverflowMax:', JSON.stringify(res.overflows));
      } catch (e) {
        console.log(`${name}/${label} FAILED: ${e.message}`);
      }
      await page.close();
    }
  }
  await browser.close();
})();
