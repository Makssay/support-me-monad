import { t, useLocale } from './i18n';
import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppProvider, type AuthSession } from './state';
const DynamicAuth = lazy(() => import('./dynamic'));
const PrivyAuth = lazy(() => import('./privy'));
const SESSION_MARKER = 'support.privy-session';
// A first-time OAuth return has no saved session yet. Mount the SDK so it can
// consume and verify the callback; URL parameters themselves never grant access.
const hasOAuthReturn = () => {
 const params = new URLSearchParams(window.location.search);
 return ['privy_oauth_state', 'privy_oauth_provider', 'privy_oauth_code'].some(key => params.has(key));
};
class AuthBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
 state = { failed: false };
 static getDerivedStateFromError() { return { failed: true }; }
 componentDidCatch() { this.props.onFailure(); }
 render() { return this.state.failed ? <div className="auth-progress" role="alert"><p>{t("Sign in could not load. Please retry.")}</p><button className="button primary" onClick={() => location.reload()}>{t("Retry")}</button></div> : this.props.children; }
}
// Keep the public product mounted while authentication loads separately.
// This marker is only a boolean hint; Privy remains the authority for the session.
export default function AuthGateway({ appId, chainId, children, dynamicEnvironmentId, authProvider = 'privy', dynamicGasSponsorship = false }: { appId: string; chainId:number; children: ReactNode; dynamicEnvironmentId?:string; authProvider?:'privy'|'dynamic'; dynamicGasSponsorship?:boolean }) { useLocale();
 // Router navigation and OAuth query cleanup must not switch a mounted SDK.
 const [provider] = useState<'privy' | 'dynamic'>(() => {
  const requested = new URLSearchParams(location.search).get('auth');
  const preferred = requested || localStorage.getItem('support.auth-provider') || authProvider;
  return dynamicEnvironmentId && preferred === 'dynamic' ? 'dynamic' : 'privy';
 });
 useEffect(() => { localStorage.setItem('support.auth-provider', provider); }, [provider]);
 const loginLegacy = useCallback(() => { const url = new URL(location.href);url.searchParams.set('auth','privy');location.assign(url.href); }, []);
 const onSession = useCallback((auth:AuthSession) => setSession({...auth, ...(provider === 'dynamic' && appId ? {loginLegacy} : {})}), [provider,appId,loginLegacy]); 
 const [enabled, setEnabled] = useState(() => provider === 'dynamic' || hasOAuthReturn() || localStorage.getItem(`${SESSION_MARKER}.${provider}`) === '1');
 const [session, setSession] = useState<AuthSession>();
 const [opening, setOpening] = useState(false);
 const pendingLogin = useRef<false | 'x' | 'email'>(false);
 const requestLogin = useCallback(() => { pendingLogin.current = 'x'; setOpening(true); setEnabled(true); }, []);
 const requestBackup = useCallback(() => { pendingLogin.current = 'email'; setOpening(true); setEnabled(true); }, []);
 const deferred = useMemo<AuthSession>(() => ({ provider, ready: provider !== 'dynamic', authenticated: false, wallets: [], login: requestLogin, loginBackup: requestBackup, connectWallet: requestLogin, logout: async () => { localStorage.removeItem(`${SESSION_MARKER}.${provider}`); } }), [provider, requestLogin, requestBackup]);
 useEffect(() => {
  if (!session?.ready) return;
  if (session.authenticated) localStorage.setItem(`${SESSION_MARKER}.${provider}`, '1');
  else localStorage.removeItem(`${SESSION_MARKER}.${provider}`);
  if (pendingLogin.current) { const method = pendingLogin.current; pendingLogin.current = false; if (!session.authenticated) { if (method === 'email') session.loginBackup?.(); else session.login(); } }
  setOpening(false);
 }, [session]);
 return <><AppProvider auth={session || deferred}>{children}</AppProvider>{enabled && <AuthBoundary onFailure={() => setOpening(false)}><Suspense fallback={null}>{provider === 'dynamic' ? <DynamicAuth environmentId={dynamicEnvironmentId!} chainId={chainId} gasSponsorship={dynamicGasSponsorship} onSession={onSession}/> : <PrivyAuth appId={appId} chainId={chainId} onSession={onSession}/>}</Suspense></AuthBoundary>}{opening && !session?.ready && <div className="auth-progress" role="status"><p>{t("Preparing sign in…")}</p><button className="button secondary" onClick={() => { pendingLogin.current = false; setOpening(false); }}>{t("Cancel")}</button></div>}</>;
}
