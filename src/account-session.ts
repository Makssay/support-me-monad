// Enrollment is idempotent. Retry only this session check, never wallet actions.
export async function accountSession(
 request: () => Promise<Response>,
 active: () => boolean,
 wait: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms))
): Promise<Response> {
 const delays = [500, 1500, 4000];
 for (let attempt = 0; ; attempt++) {
  if (!active()) throw new DOMException('Session check cancelled', 'AbortError');
  try {
   const response = await request();
   if (![409, 503].includes(response.status) || attempt === delays.length) return response;
  } catch (error) {
   if (attempt === delays.length) throw error;
  }
  await wait(delays[attempt]);
 }
}
