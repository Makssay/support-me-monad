import { t, useLocale } from './i18n';
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppProvider } from './state';
import App from './App';
import AuthGateway from './auth-gateway';
import './styles.css';
import '@fontsource/outfit/latin-400.css';
import '@fontsource/outfit/latin-600.css';
import '@fontsource/outfit/latin-700.css';
import '@fontsource/outfit/latin-800.css';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-700.css';
import './comic.css';
import './monad.css';
import './motion.css';
import './view-transitions.css';
import './payment.css';
import './experience.css';
import './ai.css';
import './i18n.css';
import './product.css';
import type { AppConfig } from '../shared/model';
function Bootstrap() { useLocale(); 
 const [config, setConfig] = useState<AppConfig>(); const [failed, setFailed] = useState(false);
 useEffect(() => { const controller = new AbortController(); let cancelled = false; const timer = setTimeout(() => controller.abort(), 15000); void fetch('/api/config', { signal: controller.signal }).then(async r => { if (!r.ok) throw new Error(); const data = await r.json(); if (!cancelled) setConfig(data); }).catch(() => { if (!cancelled) setFailed(true); }).finally(() => clearTimeout(timer)); return () => { cancelled = true; controller.abort(); clearTimeout(timer); }; }, []);
 if (failed && !config) return <div className="auth-loading" role="alert">{t("Could not connect to Support Me.")}<button className="button primary" onClick={() => location.reload()}>{t("Retry")}</button></div>;
 if (!config) return <div className="auth-loading" role="status">{t("Opening Support Me…")}</div>;
 return config.privyAppId ? <AuthGateway appId={config.privyAppId} chainId={config.chainId}><App/></AuthGateway> : <AppProvider><App/></AppProvider>;
}
createRoot(document.getElementById('root')!, { onRecoverableError(error) {
 // A viewport change cancels only the native wizard animation, not its commit.
 // Chrome's newer wording is not recognized by this React version yet.
 if (error instanceof DOMException && error.name === 'InvalidStateError' && error.message === 'Transition was aborted because of invalid state. Viewport size changed') return;
 window.reportError(error);
// Page fades and local wizard motion do not need asynchronous router commits.
} }).render(<React.StrictMode><BrowserRouter useTransitions={false}><Bootstrap /></BrowserRouter></React.StrictMode>);
