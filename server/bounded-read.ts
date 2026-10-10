// Preserve input order and keep remote RPC pressure bounded.
export async function boundedRead<T, R>(items: readonly T[], read: (item: T) => Promise<R>, concurrency = 3): Promise<R[]> {
 if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error('Invalid read concurrency');
 const result = new Array<R>(items.length); let cursor = 0;
 await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
  while (cursor < items.length) { const index = cursor++; result[index] = await read(items[index]); }
 }));
 return result;
}
