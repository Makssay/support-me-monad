interface Statement { bind(...args: unknown[]): Statement; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; run(): Promise<{meta:{changes:number}}> }
interface Env { DB: { prepare(sql: string): Statement; batch(statements: Statement[]): Promise<unknown[]> }; D1_GATEWAY_SECRET: string; SCHEDULER_SECRET: string; APP_ORIGIN: string }
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
async function authorized(request: Request, expected: string) {
 if (!expected) return false;
 const supplied = request.headers.get('Authorization')?.replace(/^Bearer /, '') || '';
 const encoder = new TextEncoder();
 const [a,b] = await Promise.all([crypto.subtle.digest('SHA-256',encoder.encode(supplied)),crypto.subtle.digest('SHA-256',encoder.encode(expected))]);
 const x=new Uint8Array(a),y=new Uint8Array(b);let difference=0;for(let i=0;i<x.length;i++)difference|=x[i]^y[i];return difference===0;
}
export default {
 async fetch(request: Request, env: Env) {
  const path = new URL(request.url).pathname;
  if (path === '/health') return json({ ok: true, service: 'support-me-storage' });
  if (request.method !== 'POST' || !await authorized(request,env.D1_GATEWAY_SECRET)) return json({error:'Not authorized'},401);
  if (Number(request.headers.get('Content-Length')) > 3500000) return json({error:'Payload too large'},413);
  try {
   const body = await request.json() as any; const now = Date.now();
   if (typeof body.owner !== 'string' || !/^[\da-f-]{36}$/i.test(body.owner)) return json({error:'Invalid lease'},400);
   if (path === '/storage/acquire') {
    const expires = now + 300000;
    const changed=await env.DB.prepare('UPDATE app_lease SET owner=?, expires=? WHERE id=1 AND expires<?').bind(body.owner,expires,now).run();
    if (!changed.meta.changes) return json({error:'Busy'},409);
    const rows=(await env.DB.prepare('SELECT key,value FROM app_records').all<{key:string;value:string}>()).results;
    if (JSON.stringify(rows).length > 3000000) { await env.DB.prepare('UPDATE app_lease SET expires=0 WHERE id=1 AND owner=?').bind(body.owner).run(); return json({error:'MVP capacity reached'},503); }
    return json({expires,rows});
   }
   if (path === '/storage/release') { await env.DB.prepare('UPDATE app_lease SET expires=0 WHERE id=1 AND owner=?').bind(body.owner).run(); return json({ok:true}); }
   const held=await env.DB.prepare('SELECT owner,expires FROM app_lease WHERE id=1').first<{owner:string;expires:number}>();
   if (!held || held.owner !== body.owner || held.expires <= now) return json({error:'Lease expired'},409);
   if (path === '/storage/assert') return json({ok:true});
   if (path === '/storage/commit') {
    if (!Array.isArray(body.changes) || body.changes.length > 5000 || body.changes.some((c:any)=>typeof c.key!=='string'||c.key.length>1000||c.value!==null&&(typeof c.value!=='string'||c.value.length>500000))) return json({error:'Invalid changes'},400);
    // Each statement is fenced again inside the atomic batch: an expired owner
    // cannot write even if another invocation acquires between read and batch.
    const encoded=JSON.stringify(body.changes);
    const results=await env.DB.batch([
     env.DB.prepare('SELECT owner,expires FROM app_lease WHERE id=1'),
     env.DB.prepare("DELETE FROM app_records WHERE key IN (SELECT json_extract(value,'$.key') FROM json_each(?) WHERE json_extract(value,'$.value') IS NULL) AND EXISTS(SELECT 1 FROM app_lease WHERE id=1 AND owner=? AND expires>?)").bind(encoded,body.owner,now),
     env.DB.prepare("INSERT INTO app_records(key,value) SELECT json_extract(value,'$.key'),json_extract(value,'$.value') FROM json_each(?) WHERE json_extract(value,'$.value') IS NOT NULL AND EXISTS(SELECT 1 FROM app_lease WHERE id=1 AND owner=? AND expires>?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(encoded,body.owner,now)
    ]) as any[];
    if (results[0]?.results?.[0]?.owner !== body.owner || results[0]?.results?.[0]?.expires<=now) return json({error:'Lease expired'},409);
    return json({ok:true});
   }
   return json({error:'Not found'},404);
  } catch { return json({error:'Storage unavailable'},503); }
 },
 async scheduled(_event: unknown, env: Env) {
  let status='not_configured';
  if (env.APP_ORIGIN?.startsWith('https://') && env.SCHEDULER_SECRET) {
   try { const response=await fetch(env.APP_ORIGIN+'/api/internal/tick',{method:'POST',headers:{Authorization:'Bearer '+env.SCHEDULER_SECRET},signal:AbortSignal.timeout(230000)});status=response.ok?'ok':`http_${response.status}`; await response.body?.cancel(); } catch { status='unavailable'; }
  }
  await env.DB.prepare('INSERT INTO scheduler_health(id,checked_at,status) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET checked_at=excluded.checked_at,status=excluded.status').bind(Date.now(),status).run();
 }
};
