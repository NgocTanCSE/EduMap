import { chromium } from 'playwright';

const b64url = (s) => Buffer.from(s).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const now = Math.floor(Date.now()/1000);
const tok = `${b64url(JSON.stringify({alg:'HS256',typ:'JWT'}))}.${b64url(JSON.stringify({sub:'1',email:'dev@edumap.vn',role:'admin',exp:now+86400,iat:now}))}.x`;

const probe = (sel) => `(() => { const el = document.querySelector('${sel}'); return el ? (() => { const r = el.getBoundingClientRect(); return {top:+r.top.toFixed(0),bottom:+r.bottom.toFixed(0),left:+r.left.toFixed(0),right:+r.right.toFixed(0),width:+r.width.toFixed(0),height:+r.height.toFixed(0)}; })() : null; })()`;

(async () => {
  const browser = await chromium.launch({ headless: true });
  for (const [vp,label] of [[[1280,900],'desktop'],[[390,844],'mobile']]) {
    const page = await browser.newPage({ viewport: { width: vp[0], height: vp[1] } });
    await page.addInitScript((t) => {
      localStorage.setItem('edumap-access-token', t);
      localStorage.setItem('edumap-refresh-token', t);
      localStorage.setItem('edumap-user-info', JSON.stringify({id:'1',email:'dev@edumap.vn',fullName:'Dev',role:'admin'}));
    }, tok);
    await page.goto('http://localhost:3000/ai-chat', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(()=>{});
    await page.waitForTimeout(3000);
    const res = await page.evaluate(() => {
      const w = window.innerWidth, h = window.innerHeight;
      const g = (sel) => { const e = document.querySelector(sel); return e ? (({top,bottom,left,right,width,height}) => ({top:+top.toFixed(0),bottom:+bottom.toFixed(0),left:+left.toFixed(0),right:+right.toFixed(0),width:+width.toFixed(0),height:+height.toFixed(0)})(e.getBoundingClientRect())) : null; };
      const appContent = g('#app-content');
      const chat = g('.flex.flex-col.h-full.w-full.p-4.bg-background');
      const header = g('header');
      // count overflowing elements
      const over = [];
      for (const el of document.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        if (r.right > w + 2 || r.bottom > h + 2) over.push({tag:el.tagName,cls:String(el.className||'').slice(0,40),b:+r.bottom.toFixed(0),r:+r.right.toFixed(0)});
      }
      return { viewport:{w,h}, header, appContent, chat, overflows: over.slice(0,10) };
    });
    console.log(`\n=== ai-chat / ${label} ===`);
    console.log(' viewport:', res.viewport);
    console.log(' header:', JSON.stringify(res.header));
    console.log(' appContent:', JSON.stringify(res.appContent));
    console.log(' chatContainer:', JSON.stringify(res.chat));
    if (res.appContent && res.chat) {
      console.log(' bottom-gap = appContent.bottom - chat.bottom =', res.appContent.bottom - res.chat.bottom);
    }
    console.log(' overflows:', JSON.stringify(res.overflows));
    await page.close();
  }
  await browser.close();
})();
