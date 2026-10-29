import { chromium } from 'playwright';

const b64url = (s) => Buffer.from(s).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const now = Math.floor(Date.now()/1000);
const tok = `${b64url(JSON.stringify({alg:'HS256',typ:'JWT'}))}.${b64url(JSON.stringify({sub:'1',email:'dev@edumap.vn',role:'admin',exp:now+86400,iat:now,fullName:'Dev'}))}.x`;

const browser = await chromium.launch({headless:false});
const page = await browser.newPage({viewport:{width:1280,height:900}});
page.on('console', msg => console.log('PAGE:', msg.text()));
page.on('dialog', d => console.log('DIALOG:', d.message()));

await page.addInitScript((t)=> {
  localStorage.setItem('edumap-access-token', t);
  localStorage.setItem('edumap-refresh-token', t);
  localStorage.setItem('edumap-user-info', JSON.stringify({id:'1',email:'dev@edumap.vn',fullName:'Dev',role:'admin'}));
}, tok);

await page.goto('http://localhost:3000/map', {waitUntil:'domcontentloaded',timeout:20000}).catch(()=>{});
await page.waitForTimeout(4000);
console.log('final url:', page.url());
console.log('title:', await page.title());
const dims = await page.evaluate(()=>({sw:document.documentElement.scrollWidth, sh:document.documentElement.scrollHeight, iw: window.innerWidth, ih: window.innerHeight}));
console.log('dims:', dims);
const counts = await page.evaluate(()=>{
  return {
    headers: document.querySelectorAll('header').length,
    navs: document.querySelectorAll('nav').length,
    mapDivs: document.querySelectorAll('#map').length,
    tabs: document.querySelectorAll('[role="tab"]').length,
    text: (document.body.innerText||'').slice(0,400),
  };
});
console.log('counts:', JSON.stringify(counts));
await page.screenshot({path:'/tmp/fescreenshots/debug-map.png', fullPage:true});
await browser.close();
