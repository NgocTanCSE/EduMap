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
    const options = { hostname:u.hostname, port:u.port||443, path:u.pathname+u.search, method:opts.method||'GET', headers:opts.headers||{}, timeout:95000 };
    const req = https.request(options, (res) => { let body=''; res.on('data',c=>body+=c); res.on('end',()=>resolve({status:res.statusCode,body})); });
    req.on('error',reject); req.on('timeout',()=>{req.destroy();reject(new Error('timeout after 95s'));});
    if(opts.body) req.write(opts.body); req.end();
  });
}
(async()=>{
  console.log('=== TEST: /api/ai/learning-path with 95s timeout ===');
  try {
    const r = await doFetch(BASE+'/api/ai/learning-path', { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body:JSON.stringify({target_role:'Fullstack Developer',current_level:'Beginner',time_commitment_hours_per_week:15}) });
    console.log('HTTP '+r.status);
    console.log('Body (first 1500 chars): '+r.body.substring(0,1500));
  } catch(e) { console.log('ERROR: '+e.message); }
  console.log('\n=== TEST: /api/ai/search (vector search) ===');
  try {
    const r = await doFetch(BASE+'/api/ai/search?q=math&limit=3');
    console.log('HTTP '+r.status);
    console.log('Body (first 800 chars): '+r.body.substring(0,800));
  } catch(e) { console.log('ERROR: '+e.message); }
  console.log('\n=== TEST: /api/library/resources?page=1&limit=3 ===');
  try {
    const r = await doFetch(BASE+'/api/library/resources?page=1&limit=3');
    console.log('HTTP '+r.status);
    console.log('Body (first 800 chars): '+r.body.substring(0,800));
  } catch(e) { console.log('ERROR: '+e.message); }
})();
