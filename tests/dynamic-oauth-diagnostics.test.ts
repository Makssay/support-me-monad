import test from 'node:test';
import assert from 'node:assert/strict';
import {oauthFailureCategory} from '../src/dynamic-oauth-diagnostics';
test('OAuth diagnostics retain a fixed category without provider response data',()=>{
 assert.equal(oauthFailureCategory({error:{message:'Invalid client secret: SECRET'}}),'CLIENT_CREDENTIALS');
 assert.equal(oauthFailureCategory({error:'insufficient_credits',access_token:'SECRET'}),'CREDITS');
 assert.equal(oauthFailureCategory({message:'invalid_grant',code:'SECRET'}),'OAUTH_CODE');
 assert.equal(oauthFailureCategory({error:'email_associated_with_different_provider'}),'ACCOUNT_CONFLICT');
 assert.equal(oauthFailureCategory({error:'SECRET',jwt:'SECRET'}),'PROVIDER_REJECTED');
 assert.equal(oauthFailureCategory(null),'PROVIDER_REJECTED');
});

test('Diagnostic observer preserves responses and ignores non-Dynamic requests',async()=>{
 const {installDynamicOAuthDiagnostics,dynamicOAuthFailure,clearDynamicOAuthFailure}=await import('../src/dynamic-oauth-diagnostics');
 const globals=globalThis as any;const oldWindow=globals.window;const oldLocation=globals.location;
 globals.window={fetch:async()=>new Response(JSON.stringify({error:'invalid_client',token:'SECRET'}),{status:401})};globals.location={href:'https://example.com/'};
 try {
  installDynamicOAuthDiagnostics('qa-environment');
  const response=await globals.window.fetch('https://app.dynamicauth.com/api/v0/sdk/qa-environment/providers/twitter/signIn');
  assert.equal(dynamicOAuthFailure(),'HTTP 401 · CLIENT_CREDENTIALS');
  assert.equal((await response.json()).token,'SECRET');
  clearDynamicOAuthFailure();
  await globals.window.fetch('https://example.com/api/auth/session');
  assert.equal(dynamicOAuthFailure(),'');
 }finally{globals.window=oldWindow;globals.location=oldLocation;}
});
