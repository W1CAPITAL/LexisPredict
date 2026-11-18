export const RELAY_ORIGIN='https://predictbot-opencode.daviconcentrix.workers.dev';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SESSION=/^ses[a-zA-Z0-9_-]{1,180}$/;
export type RelaySpec={method:'GET'|'POST';path:string;body:Record<string,unknown>|null};
export function openCodeRelayRequest(value:unknown):RelaySpec{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Solicitação MCP inválida.');
 const v=value as Record<string,unknown>;
 if(Object.keys(v).some(k=>!['action','deviceId','key','operation','input','jobId'].includes(k)))throw Error('Campo da ponte não autorizado.');
 if(v.action==='devices'&&Object.keys(v).length===1)return{method:'GET',path:'/v1/devices',body:null};
 if(v.action==='task'&&Object.keys(v).length===2&&typeof v.jobId==='string'&&UUID.test(v.jobId))return{method:'POST',path:'/v1/task',body:{jobId:v.jobId}};
 if(v.action!=='submit'||typeof v.deviceId!=='string'||!UUID.test(v.deviceId)||typeof v.key!=='string'||!UUID.test(v.key)||Object.keys(v).some(k=>!['action','deviceId','key','operation','input'].includes(k)))throw Error('Operação não autorizada.');
 const input=v.input;
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Tarefa inválida.');
 const t=input as Record<string,unknown>;
 let args:Record<string,unknown>|null=null;
 if(v.operation==='create'&&Object.keys(t).length===1&&typeof t.title==='string'&&t.title.length>0&&t.title.length<=200)args={title:t.title};
 if(v.operation==='prompt'&&Object.keys(t).length===2&&typeof t.sessionId==='string'&&SESSION.test(t.sessionId)&&typeof t.text==='string'&&t.text.trim().length>0&&t.text.length<=32000)args={sessionId:t.sessionId,text:t.text};
 if(v.operation==='messages'&&Object.keys(t).length===1&&typeof t.sessionId==='string'&&SESSION.test(t.sessionId))args={sessionId:t.sessionId};
 if(!args)throw Error('Formato da tarefa não permitido.');
 return{method:'POST',path:'/v1/jobs',body:{deviceId:v.deviceId,key:v.key,operation:v.operation,input:args}};
}
