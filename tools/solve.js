// usage: node tools/solve.js [i=N] [m=1,0] [lv=JSON]
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const root=path.resolve(__dirname,'..');const hash=process.argv.slice(2).map(a=>{const k=a.indexOf('=');return a.slice(0,k)+'='+encodeURIComponent(a.slice(k+1))}).join('&');
const types={'.html':'text/html','.js':'text/javascript','.woff2':'font/woff2'};
const srv=http.createServer((q,r)=>{const p=path.join(root,decodeURIComponent(q.url.split('?')[0].split('#')[0]));fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();return}r.writeHead(200,{'Content-Type':types[path.extname(p)]||'application/octet-stream'});r.end(b)})}).listen(0,async()=>{
 const b=await chromium.launch();const pg=await b.newPage();pg.on('pageerror',e=>console.log('pageerror:',e.message));
 await pg.goto(`http://127.0.0.1:${srv.address().port}/tools/solve.html#${hash}`);await pg.waitForFunction(()=>document.title==='DONE',null,{timeout:1800000,polling:500});
 const R=await pg.evaluate(()=>window.R);for(const r of R){const {path:p,...rest}=r;console.log(JSON.stringify(rest));}
 fs.writeFileSync(path.join(root,'tools','solutions.json'),JSON.stringify(R));await b.close();srv.close();});
