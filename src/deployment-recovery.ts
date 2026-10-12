declare const __APP_BUILD_ID__: string;
let walletOperationPending = false;
let saveDraft: (() => void) | undefined;
export const setWalletOperationPending = (value: boolean) => { walletOperationPending = value; };
export function registerRecoveryDraft(save: () => void) {
 saveDraft = save;
 return () => { if (saveDraft === save) saveDraft = undefined; };
}
export function isMissingChunk(error: unknown): boolean {
 const message = error instanceof Error ? error.message : String(error);
 return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk [\w-]+ failed/i.test(message);
}
export function recoverMissingChunk(error: unknown): boolean {
 if (!isMissingChunk(error) || walletOperationPending) return false;
 // One attempt per build and tab. Never reload an unresolved wallet action or
 // loop when a network outage, rather than a deployment, prevents loading.
 try {
  const key = 'support.chunk-recovery.' + __APP_BUILD_ID__;
  if (sessionStorage.getItem(key)) return false;
  saveDraft?.();
  sessionStorage.setItem(key, '1');
  location.reload();
  return true;
 } catch { return false; }
}
export function installDeploymentRecovery() {
 window.addEventListener('vite:preloadError', event => {
  if (recoverMissingChunk((event as Event & { payload?: unknown }).payload)) event.preventDefault();
 });
 window.addEventListener('unhandledrejection', event => {
  if (recoverMissingChunk(event.reason)) event.preventDefault();
 });
}
