import { t, useLocale } from './i18n';
import { useApp } from './state';
export function AccountBackup() { useLocale(); 
 const { auth, busy } = useApp();
 if (!auth?.member) return null;
 return <div className="account-backup"><p className="wallet-note">{auth.member.username ? `@${auth.member.username}` : t("X account linked")} {t("· Your Support Me identity")}</p>{auth.cleanupError && <><p className="callout" role="alert">{t(auth.cleanupError)}</p><button className="button secondary wide" disabled={busy} onClick={auth.retry}>{t("Retry")}</button></>}{auth.member.backupEmail ? <p className="callout">{t("✓ Backup email verified. You can use it to sign in to this account.")}</p> : <><p className="wallet-note">{t("Keep a way back in if you lose access to X.")}</p><button className="button secondary wide" disabled={busy} onClick={auth.linkEmail}>{t("Add backup email")}</button></>}</div>;
}
export function AccountSignIn() { useLocale(); 
 const { auth, connect, disconnect, setWalletOpen } = useApp();
 if (!auth) return null;
 if (auth.authenticated) return <><p role="status">{t(auth.accountError || '') || (auth.member ? t("Opening your wallet…") : t("Verifying your account…"))}</p>{auth.needsX ? <button className="button primary wide" onClick={auth.linkX}>{t("Link X to continue")}</button> : auth.accountError ? <button className="button primary wide" onClick={auth.retry}>{t("Retry account verification")}</button> : null}<button className="button secondary wide" onClick={disconnect}>{t("Sign out")}</button></>;
 return <><button className="button primary wide" disabled={!auth.ready} onClick={() => void connect()}>{auth.ready ? t("Continue with X") : t("Preparing sign in…")}</button><p className="wallet-note">{t("Your X profile is your identity. We’ll create your wallet after you join.")}</p><button className="button secondary wide" disabled={!auth.ready} onClick={() => { setWalletOpen(false); auth.loginBackup?.(); }}>{t("Sign in with backup email")}</button><p className="wallet-note">{t("Already joined? Use the email you linked to your account.")}</p></>;
}
