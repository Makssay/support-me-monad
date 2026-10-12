// Polling, manual refresh and post-receipt refresh share one in-flight read.
export function coalesceLoad<T>(read: () => Promise<T>) {
 let pending: Promise<T> | undefined;
 return () => {
  if (!pending) pending = Promise.resolve().then(read).finally(() => { pending = undefined; });
  return pending;
 };
}
