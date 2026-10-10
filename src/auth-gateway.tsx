import { t, useLocale } from './i18n';
import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppProvider, type AuthSession } from './state';
const PrivyAuth = lazy(() => import('./privy'));
const SESSION_MARKER = 'support.privy-session';
class AuthBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
 state = { failed: false };
 static getDerivedStateFromError() { return { failed: true }; }
 componentDidCatch() { this.props.onFailure(); }
 render() { return this.state.failed ? <div className="auth-progress" role="alert"><p>{t("Sign in could not load. Please retry.")}</p><button className="button primary" onClick={() => location.reload()}>{t("Retry")}</button></div> : this.props.children; }
}
// Keep the public product mounted while authentication loads separately.
// This marker is only a boolean hint; Privy remains the authority for the session.
export default function AuthGateway({ appId, chainId, children }: { appId: string; chainId:number; children: ReactNode }) { useLocale(); 
 const [enabled, setEnabled] = useState(() => localStorage.getItem(SESSION_MARKER) === '1');
 const [session, setSession] = useState<AuthSession>();
 const [opening, setOpening] = useState(false);
 const pendingLogin = useRef<false | 'x' | 'email'>(false);
 const requestLogin = useCallback(() => { pendingLogin.current = 'x'; setOpening(true); setEnabled(true); }, []);
 const requestBackup = useCallback(() => { pendingLogin.current = 'email'; setOpening(true); setEnabled(true); }, []);
 const deferred = useMemo<AuthSession>(() => ({ ready: true, authenticated: false, wallets: [], login: requestLogin, loginBackup: requestBackup, connectWallet: requestLogin, logout: async () => { localStorage.removeItem(SESSION_MARKER); } }), [requestLogin, requestBackup]);
 useEffect(() => {
  if (!session?.ready) return;
  if (session.authenticated) localStorage.setItem(SESSION_MARKER, '1');
  else localStorage.removeItem(SESSION_MARKER);
  if (pendingLogin.current) { const method = pendingLogin.current; pendingLogin.current = false; if (!session.authenticated) { if (method === 'email') session.loginBackup?.(); else session.login(); } }
  setOpening(false);
 }, [session]);
 return <><AppProvider auth={session || deferred}>{children}</AppProvider>{enabled && <AuthBoundary onFailure={() => setOpening(false)}><Suspense fallback={null}><PrivyAuth appId={appId} chainId={chainId} onSession={setSession}/></Suspense></AuthBoundary>}{opening && !session?.ready && <div className="auth-progress" role="status"><p>{t("Preparing sign in…")}</p><button className="button secondary" onClick={() => { pendingLogin.current = false; setOpening(false); }}>{t("Cancel")}</button></div>}</>;
}
