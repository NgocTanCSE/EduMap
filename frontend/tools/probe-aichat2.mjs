import { chromium } from 'playwright';

const b64url = (s) => Buffer.from(s).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const now = Math.floor(Date.now()/1000);
const tok = `${b64url(JSON.stringify({alg:'HS256',typ:'JWT'}))}.${b64url(JSON.stringify({sub:'1',email:'dev@edumap.vn',role:'admin',exp:now+86400,iat:now}))}.x`;

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

  // Find the tallest non-fixed elements (the ones causing page scroll)
  const info = await page.evaluate(() => {
    const w = window.innerWidth, h = window.innerHeight;
    const tall = [];
    for (const el of document.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed' || cs.position === 'absolute') continue;
      const r = el.getBoundingClientRect();
      if (r.bottom > h + 10 && r.height > 100) {
        tall.push({ tag: el.tagName, cls: String(el.className||'').slice(0,60), top:+r.top.toFixed(0), bottom:+r.bottom.toFixed(0), height:+r.height.toFixed(0) });
      }
    }
    tall.sort((a,b)=>b.height-a.height);
    // app-content + chat
    const ac = document.querySelector('#app-content');
    const acRect = ac ? (({top,bottom,left,right,width,height})=>({top:+top.toFixed(0),bottom:+bottom.toFixed(0),left:+left.toFixed(0),right:+right.toFixed(0),width:+width.toFixed(0),height:+height.toFixed(0)})(ac.getBoundingClientRect())) : null;
    const chat = document.querySelector('#app-content > div');
    const chatRect = chat ? (({top,bottom,left,right,width,height})=>({top:+top.toFixed(0),bottom:+bottom.toFixed(0),left:+left.toFixed(0),right:+right.toFixed(0),width:+width.toFixed(0),height:+height.toFixed(0)})(chat.getBoundingClientRect())) : null;
    const chatCls = chat ? String(chat.className) : null;
    return { viewport:{w,h}, appContent: acRect, chatFirstChild: {cls: chatCls, rect: chatRect}, tall: tall.slice(0,8) };
  });
  console.log('viewport:', info.viewport);
  console.log('app-content:', JSON.stringify(info.appContent));
  console.log('chat first-child cls:', info.chatFirstChild.cls);
  console.log('chat first-child rect:', JSON.stringify(info.chatFirstChild.rect));
  console.log('tallest non-fixed elements:');
  for (const t of info.tall) console.log('  ', t.tag, '#'+t.cls, 'h='+t.height, 'bottom='+t.bottom, 'top='+t.top);
  await browser.close();
})();
