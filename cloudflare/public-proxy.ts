import {coalesceStateRead} from './state-read';
const upstreamOrigin = 'https://support-me-monad.vercel.app';

// Fixed destination: this is the app's public entrance, never an open proxy.
// Authentication and storage remain in the existing Vercel/D1 backend.
export async function proxyRequest(request: Request, send: typeof fetch = fetch): Promise<Response> {
 const incoming = new URL(request.url);
 if (incoming.pathname.startsWith('/api/internal/')) return new Response('Not found', { status: 404 });
 const destination = new URL(incoming.pathname + incoming.search, upstreamOrigin);
 const headers = new Headers(request.headers);
 headers.delete('host');
 headers.delete('x-forwarded-host');
 headers.delete('x-forwarded-for');
 headers.delete('x-real-ip');
 const clientIp = request.headers.get('cf-connecting-ip');
 if (clientIp) headers.set('x-forwarded-for', clientIp);
 try {
  const response = await send(new Request(new Request(destination, request), { headers, redirect: 'manual' }));
  const outgoing = new Headers(response.headers);
  const location = outgoing.get('location');
  if (location) {
   const redirect = new URL(location, destination);
   if (redirect.origin === upstreamOrigin) outgoing.set('location', incoming.origin + redirect.pathname + redirect.search + redirect.hash);
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: outgoing });
 } catch {
  return Response.json({ error: 'Support Me is temporarily unavailable. Please retry shortly.' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
 }
}
export function publicEntrance(request:Request,send:typeof fetch=fetch,ctx?:{waitUntil(promise:Promise<unknown>):void}){return coalesceStateRead(request,async()=>{
 const response=await proxyRequest(request,send);
 if(response.headers.get('X-State-Refresh-Needed')==='1'&&ctx){
  const url=new URL('/api/snapshot-refresh',request.url);
  ctx.waitUntil(proxyRequest(new Request(url,request),send).then(r=>r.body?.cancel()).catch(()=>undefined));
 }
 return response;
});}
export default { fetch: (request:Request,_env:unknown,ctx:{waitUntil(promise:Promise<unknown>):void})=>publicEntrance(request,fetch,ctx) };
