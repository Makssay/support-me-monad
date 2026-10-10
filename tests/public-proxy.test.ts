import { test } from 'node:test';
import assert from 'node:assert/strict';
import { proxyRequest } from '../cloudflare/public-proxy';

test('public entrance preserves auth, bodies and cookies, with a fixed upstream and no redirect following', async () => {
 const response = await proxyRequest(new Request('https://support-me-monad.support-me.workers.dev/api/auth/session?check=1', { method: 'POST', headers: { Authorization: 'Bearer qa-only', 'Content-Type': 'application/json' }, body: '{}' }), (async (input: Request) => {
  assert.equal(input.url, 'https://support-me-monad.vercel.app/api/auth/session?check=1');
  assert.equal(input.redirect, 'manual');
  assert.equal(input.headers.get('Authorization'), 'Bearer qa-only');
  assert.equal(await input.text(), '{}');
  return new Response('{}', { headers: { 'Set-Cookie': 'qa=1; HttpOnly; Secure; SameSite=Lax', 'Cache-Control': 'no-store' } });
 }) as typeof fetch);
 assert.match(response.headers.get('Set-Cookie')!, /HttpOnly/);
 assert.equal(response.headers.get('Cache-Control'), 'no-store');
});
test('public entrance rewrites only app redirects and blocks private scheduler paths', async () => {
 const req = new Request('https://support-me-monad.support-me.workers.dev/create');
 const send = (location: string) => (async () => new Response(null, { status: 302, headers: { Location: location } })) as typeof fetch;
 assert.equal((await proxyRequest(req, send('https://support-me-monad.vercel.app/profile?a=1'))).headers.get('Location'), 'https://support-me-monad.support-me.workers.dev/profile?a=1');
 assert.equal((await proxyRequest(req, send('https://discord.com/oauth2/authorize'))).headers.get('Location'), 'https://discord.com/oauth2/authorize');
 assert.equal((await proxyRequest(new Request('https://support-me-monad.support-me.workers.dev/api/internal/tick'), (() => { throw Error('must not call upstream'); }) as typeof fetch)).status, 404);
 assert.equal((await proxyRequest(req, (() => { throw Error('offline'); }) as typeof fetch)).status, 502);
});
