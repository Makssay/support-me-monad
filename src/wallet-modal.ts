// Privy resolves personal_sign before its closing screen has unmounted.
// Starting another request during that exit can replace the old screen's data.
export async function waitForWalletModal(
 state: () => { open: boolean; closedAt: number },
 now = () => Date.now(),
 pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)),
) {
 const started = now();
 while (true) {
  const modal = state();
  // The SDK keeps closing-screen cleanup timers for 200 ms.
  if (!modal.open && now() - modal.closedAt >= 350) return;
  if (now() - started >= 10000) throw Object.assign(new Error('Close the current wallet window, then retry.'), { code: 'WALLET_REQUEST_PENDING' });
  await pause(50);
 }
}
