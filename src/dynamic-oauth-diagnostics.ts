// Keep only status and a fixed category; never store URLs, OAuth codes or bodies.
export function oauthFailureCategory(body: unknown): string {
 const b=body as {code?:unknown;error?:unknown;message?:unknown}|null;
 const e=b?.error as {code?:unknown;message?:unknown}|null;
 const text=[b?.code,typeof b?.error==='string'?b.error:'',b?.message,e?.code,e?.message].filter(v=>typeof v==='string').join(' ').toLowerCase();
 if(/insufficient.?credit|credit.?balance|credits.?depleted|payment.required|usagecap/.test(text))return 'CREDITS';
 if(/invalid.client|client.secret|client.authentication/.test(text))return 'CLIENT_CREDENTIALS';
 if(/invalid.grant|code.expired|invalid.code|code.verifier|pkce/.test(text))return 'OAUTH_CODE';
 if(/redirect.uri|callback.url/.test(text))return 'CALLBACK';
 if(/invalid.scope|insufficient.scope/.test(text))return 'SCOPES';
 if(/rate.limit|too.many.requests/.test(text))return 'RATE_LIMIT';
 if(/email_associated|account.already|social_account_already/.test(text))return 'ACCOUNT_CONFLICT';
 if(/sandbox_maximum/.test(text))return 'SANDBOX_LIMIT';
 return 'PROVIDER_REJECTED';
}
let installed=false;
let failure='';
export function clearDynamicOAuthFailure(){failure='';}
export function dynamicOAuthFailure(){return failure;}
export function installDynamicOAuthDiagnostics(environmentId:string){
 if(installed)return;installed=true;
 const original=window.fetch.bind(window);
 window.fetch=async(input,init)=>{
  let tracked=false;
  try {const url=new URL(input instanceof Request?input.url:String(input),location.href);tracked=url.origin==='https://app.dynamicauth.com'&&url.pathname.startsWith(`/api/v0/sdk/${environmentId}/providers/twitter/`)&&/\/(signIn|verify|result)$/.test(url.pathname);}catch{}
  try {
   const response=await original(input,init);
   if(tracked&&!response.ok){let body:unknown;try{body=await response.clone().json();}catch{}failure=`HTTP ${response.status} · ${oauthFailureCategory(body)}`;}
   return response;
  }catch(error){if(tracked)failure='NETWORK';throw error;}
 };
}
