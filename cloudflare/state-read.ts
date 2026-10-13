type SharedRead={body:ArrayBuffer;status:number;statusText:string;headers:[string,string][]};
const pending=new Map<string,Promise<SharedRead>>();
// State is public display data. Collapse concurrent reads without retaining a
// cache after completion, so a post-payment refresh still reaches the backend.
export async function coalesceStateRead(request:Request,read:()=>Promise<Response>,partition=''):Promise<Response>{
 const url=new URL(request.url);
 if(request.method!=='GET'||url.pathname!=='/api/state'||request.headers.has('authorization'))return read();
 const key=url.origin+url.pathname+url.search+'\n'+partition;
 let task=pending.get(key);
 if(!task){task=(async()=>{const r=await read();const body=await r.arrayBuffer();const headers=new Headers(r.headers);headers.delete('content-length');headers.delete('content-encoding');headers.delete('transfer-encoding');return {body,status:r.status,statusText:r.statusText,headers:[...headers.entries()]};})().finally(()=>pending.delete(key));pending.set(key,task);}
 const data=await task;
 // Share bytes, never a Response/ReadableStream owned by another request.
 return new Response(data.body.slice(0),{status:data.status,statusText:data.statusText,headers:data.headers});
}
