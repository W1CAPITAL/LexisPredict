import http from 'node:http';
const port=Number(process.env.PORT||10000);
http.createServer((req,res)=>{
 const path=String(req.url||'').split('?')[0];
 if(req.method!=='GET'||!['/','/health'].includes(path)){res.writeHead(404).end();return;}
 res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'https://lexispredict.vercel.app'});
 res.end(JSON.stringify({ok:true,service:'lexispredict-wa-auto',purpose:'health check'}));
}).listen(port,'0.0.0.0',()=>console.log('WA.Auto cloud health server ready on '+port));
try{await import('./index.mjs');}
catch(error){console.error('WA.Auto startup failed:',String(error?.message||error).slice(0,240));process.exit(1);}
