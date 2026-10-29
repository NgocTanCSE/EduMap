import { chromium } from 'playwright';
const b64url = (s) => Buffer.from(s).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const now = Math.floor(Date.now()/1000);
const tok = `${b64url(JSON.stringify({alg:'HS256',typ:'JWT'}))}.${b64url(JSON.stringify({sub:'1',email:'dev@edumap.vn',role:'admin',exp:now+86400,iat:now}))}.x`;

const layers = [
  ['body', 'body'],
  ['html', 'html'],
  ['applayout-outer-div', 'body > div'],
  ['sidebar-aside', 'aside'],
  ['header', 'header'],
  ['content-area-div', 'body > div > div > div'],
  ['app-content', '#app-content'],
  ['chat-container', '#app-content > div'],
  ['title-bar', '#app-content > div > div'],
  ['scrollarea', '#app-content > div > div:nth-child(2)'],
  ['input-area', '#app-content > div > div:nth-child(3)'],
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.addInitScript((t) => {
    localStorage.setItem('edumap-access-token', t);
    localStorage.setItem('edumap-refresh-token', t);
    localStorage.setItem('edumap-user-info', JSON.stringify({id:'1',email:'dev@edumap.vn',fullName:'Dev',role:'admin'}));
  }, tok);
  await page.goto('http://localhost:3000/ai-chat', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(()=>{});
  await page.waitForTimeout(3000);

  const info = await page.evaluate((layers) => {
    const w = window.innerWidth, h = window.innerHeight;
    const g = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return { top:+r.top.toFixed(0), bottom:+r.bottom.toFixed(0), height:+r.height.toFixed(0), bottomMinusVH:+(r.bottom-h).toFixed(0), position: cs.position, display: cs.display, heightPct: cs.height };
    };
    const out = {};
    for (const [name, sel] of layers) out[name] = g(sel);
    // also find any element whose bottom > viewport, excluding fixed/absolutely positioned
    const overflowers = [];
    for (const el of document.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed' || cs.position === 'absolute') continue;
      const r = el.getBoundingClientRect();
      if (r.bottom > h + 5) overflowers.push({ tag:el.tagName, cls:String(el.className||'').slice(0,50), bottom:+r.bottom.toFixed(0), height:+r.height.toFixed(0), position: cs.position });
    }
    overflowers.sort((a,b)=>b.height-a.height);
    return { viewport:{w,h}, layers: out, overflowers: overflowers.slice(0,10) };
  }, layers);

  console.log('viewport:', info.viewport);
  for (const [name, rect] of Object.entries(info.layers)) {
    console.log(`  ${name.padEnd(20)}:`, rect ? JSON.stringify(rect) : 'NULL');
  }
  console.log('overflowers (bottom > vh):');
  for (const o of info.overflowers) console.log('  ', o.tag, '#'+o.cls, 'h='+o.height, 'bottom='+o.bottom, 'pos='+o.position);
  await browser.close();
})();
