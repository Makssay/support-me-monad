interface PageVisibility { readonly visibilityState: string; addEventListener(type: string, listener: () => void): void; removeEventListener(type: string, listener: () => void): void; }
interface Timers { set(callback: () => void, ms: number): unknown; clear(id: unknown): void; }
export function startSnapshotPolling(load: () => Promise<unknown>, canRead: () => boolean, page: PageVisibility = document, timers: Timers = {set: (cb,ms) => setTimeout(cb,ms),clear: id => clearTimeout(id as ReturnType<typeof setTimeout>)}) {
 let stopped=false, running=false, timer:unknown;
 const schedule=()=>{if(!stopped && page.visibilityState==='visible') timer=timers.set(()=>void poll(),30000);};
 async function poll() {
  if(stopped || running || page.visibilityState!=='visible') return;
  running=true;
  try { if(canRead()) await load(); } catch { /* A later visible poll can recover. */ }
  finally { running=false;schedule(); }
 }
 const changed=()=>{timers.clear(timer);if(page.visibilityState==='visible')void poll();};
 page.addEventListener('visibilitychange',changed);
 schedule();
 return ()=>{stopped=true;timers.clear(timer);page.removeEventListener('visibilitychange',changed);};
}
