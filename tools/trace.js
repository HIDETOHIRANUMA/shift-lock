const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const root=path.resolve(__dirname,'..');const [,,lv,plan]=process.argv;
const srv=http.createServer((q,r)=>{const p=path.join(root,decodeURIComponent(q.url.split('?')[0].split('#')[0]));fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();return}r.writeHead(200,{'Content-Type':p.endsWith('.html')?'text/html':p.endsWith('.js')?'text/javascript':'font/woff2'});r.end(b)})}).listen(0,async()=>{
 const b=await chromium.launch();const pg=await b.newPage();pg.on('pageerror',e=>console.log('pageerror:',e.message));
 await pg.goto(`http://127.0.0.1:${srv.address().port}/tools/trace.html#lv=${encodeURIComponent(lv)}&plan=${encodeURIComponent(plan)}`);await pg.waitForFunction(()=>document.title==='DONE');
 console.log((await pg.evaluate(()=>window.R)).join('\n'));await b.close();srv.close();});
