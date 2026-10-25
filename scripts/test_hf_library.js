const https = require('https');
const crypto = require('crypto');
const BASE = 'https://tancse2005-edumap.hf.space';
const JWT_SECRET = 'edumap-local-dev-secret';
function b64url(buf) { return buf.toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
const h = b64url(Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})));
const p = b64url(Buffer.from(JSON.stringify({sub:'test-user-123',role:'student',email:'test@test.com',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600})));
const s = crypto.createHmac('sha256',JWT_SECRET).update(h+'.'+p).digest();
const token = h+'.'+p+'.'+b64url(s);
function doFetch(url, opts) {
  opts = opts || {};
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const options = { hostname:u.hostname, port:u.port||443, path:u.pathname+u.search, method:opts.method||'GET', headers:opts.headers||{}, timeout:30000 };
    const req = https.request(options, (res) => { let body=''; res.on('data',c=>body+=c); res.on('end',()=>resolve({status:res.statusCode,body})); });
    req.on('error',reject); req.on('timeout',()=>{req.destroy();reject(new Error('timeout after 30s'));});
    if(opts.body) req.write(opts.body); req.end();
  });
}
(async()=>{
  // First get a resource ID
  console.log('=== Get library resources ===');
  try {
    const r = await doFetch(BASE+'/api/library/resources?page=1&limit=2');
    const data = JSON.parse(r.body);
    const firstId = data.items[0]?.id;
    console.log('First resource ID: ' + firstId);
    console.log('First resource title: ' + data.items[0]?.title);
    
    if (firstId) {
      console.log('\n=== TEST: /api/library/resources/' + firstId + '/summary ===');
      try {
        const r2 = await doFetch(BASE+'/api/library/resources/'+firstId+'/summary', { headers: { 'Authorization': 'Bearer ' + token } });
        console.log('HTTP ' + r2.status);
        console.log('Body: ' + r2.body.substring(0, 1000));
      } catch(e) { console.log('ERROR: ' + e.message); }
    }
  } catch(e) { console.log('ERROR: ' + e.message); }

  // Test without auth
  console.log('\n=== TEST: /api/ai/analytics/stats (public endpoint) ===');
  try {
    const r = await doFetch(BASE+'/api/ai/analytics/stats');
    console.log('HTTP ' + r.status);
    console.log('Body: ' + r.body.substring(0, 500));
  } catch(e) { console.log('ERROR: ' + e.message); }

  // Test trends
  console.log('\n=== TEST: /api/ai/trends (public endpoint) ===');
  try {
    const r = await doFetch(BASE+'/api/ai/trends');
    console.log('HTTP ' + r.status);
    console.log('Body: ' + r.body.substring(0, 500));
  } catch(e) { console.log('ERROR: ' + e.message); }
})();
