// Reads after a mined receipt must never hold the wallet operation open forever.
// The refresh may finish in the background; this never resends a transaction.
export async function refreshAfterReceipt(refresh: () => Promise<void>, timeoutMs = 15000) {
 let timer: ReturnType<typeof setTimeout> | undefined;
 try {
  await Promise.race([
   Promise.resolve().then(refresh).catch(() => undefined),
   new Promise<void>(resolve => { timer = setTimeout(resolve, timeoutMs); }),
  ]);
 } finally { if (timer !== undefined) clearTimeout(timer); }
}
