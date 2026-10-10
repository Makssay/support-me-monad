// Optional explorer history must not block the authoritative contract-state read.
// One worker at a time; failures retry on the next refresh without unhandled rejections.
export function backgroundHistory(load: () => Promise<void>, updated: () => void) {
 let pending: Promise<void> | undefined;
 return () => {
  if (pending) return;
  pending = Promise.resolve().then(load).then(updated).catch(() => {}).finally(() => { pending = undefined; });
 };
}
