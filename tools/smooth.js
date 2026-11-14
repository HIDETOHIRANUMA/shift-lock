// usage: node tools/smooth.js cases.json out.json
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const root=path.resolve(__dirname,'..');const cases=fs.readFileSync(process.argv[2],'utf8');
const srv=http.createServer((q,r)=>{const p=path.join(root,decodeURIComponent(q.url.split('?')[0].split('#')[0]));fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();return}r.writeHead(200,{'Content-Type':p.endsWith('.html')?'text/html':p.endsWith('.js')?'text/javascript':'font/woff2'});r.end(b)})}).listen(0,async()=>{
 const b=await chromium.launch();const pg=await b.newPage();pg.on('pageerror',e=>console.log('pageerror:',e.message));
 await pg.goto(`http://127.0.0.1:${srv.address().port}/tools/smooth.html#${encodeURIComponent(cases)}`);await pg.waitForFunction(()=>document.title==='DONE',null,{timeout:600000});
 const R=await pg.evaluate(()=>window.R);for(const r of R)console.log(r.name,'before',r.before,'after',r.after,'holds',JSON.stringify(r.holds));
 const o={};for(const r of R)o[r.name]=r.plan;fs.writeFileSync(process.argv[3],JSON.stringify(o));await b.close();srv.close();});
