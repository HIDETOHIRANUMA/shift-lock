const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const root=path.resolve(__dirname,'..');const out=process.argv[2];
const srv=http.createServer((q,r)=>{const p=path.join(root,decodeURIComponent(q.url.split('?')[0]));fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();return}r.writeHead(200,{'Content-Type':p.endsWith('.html')?'text/html':'font/woff2'});r.end(b)})}).listen(0,async()=>{
 const b=await chromium.launch();const pg=await b.newPage({viewport:{width:1260,height:1000}});pg.on('pageerror',e=>console.log('err',e.message));
 await pg.goto(`http://127.0.0.1:${srv.address().port}/tools/cover.html`);await pg.waitForFunction(()=>document.title==='DONE');
 await pg.locator('#c').screenshot({path:out});await b.close();srv.close();console.log('saved',out);});
