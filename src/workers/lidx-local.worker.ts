import { LidxReader } from '../lib/lidx-local';
self.onmessage=async(ev:MessageEvent<{file:File;queries:Array<{cpf?:string;nome?:string}>}>)=>{
  try {
    const reader=new LidxReader(ev.data.file); const meta=await reader.open(); const results=[];
    self.postMessage({type:'progress',done:0,total:ev.data.queries.length,records:meta.registros});
    for(const query of ev.data.queries) {
      results.push(await reader.lookup(query));
      self.postMessage({type:'progress',done:results.length,total:ev.data.queries.length});
    }
    self.postMessage({type:'done',results,bytesRead:reader.bytesRead});
  } catch(e) { self.postMessage({type:'error',message:e instanceof Error?e.message:String(e)}); }
};
