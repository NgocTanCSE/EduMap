import { chromium } from 'playwright';
const b64url = (s) => Buffer.from(s).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const now = Math.floor(Date.now()/1000);
const tok = `${b64url(JSON.stringify({alg:'HS256',typ:'JWT'}))}.${b64url(JSON.stringify({sub:'1',email:'dev@edumap.vn',role:'admin',exp:now+86400,iat:now,fullName:'Dev'}))}.x`;

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
  const data = await page.evaluate(() => {
    const url = window.location.href;
    const title = document.title;
    const app = document.querySelector('#app-content, #app-content > *');
    const appHTML = app ? app.outerHTML.slice(0, 400) : null;
    const chatRoot = document.querySelector('#app-content > div');
    return { url, title, appHTML, chatCls: chatRoot ? String(chatRoot.className) : null, chatHTML: chatRoot ? chatRoot.outerHTML.slice(0,600) : null, bodyHeight: document.body.scrollHeight };
  });
  console.log('URL:', data.url);
  console.log('TITLE:', data.title);
  console.log('bodyHeight:', data.bodyHeight);
  console.log('app-content outerHTML (first 400):', data.appHTML);
  console.log('chat root cls:', data.chatCls);
  console.log('chat root outerHTML (first 600):', data.chatHTML);
  await browser.close();
})();
