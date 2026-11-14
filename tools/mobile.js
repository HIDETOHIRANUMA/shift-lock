const {chromium,devices}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const root=path.resolve(__dirname,'..');const out=process.argv[2];fs.mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';const p=path.join(root,u);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();return}r.writeHead(200,{'Content-Type':types[path.extname(p)]||'application/octet-stream'});r.end(b)})}).listen(0,async()=>{
 const b=await chromium.launch();const ctx=await b.newContext({...devices['iPhone 13 landscape']});const pg=await ctx.newPage();
 const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.goto(`http://127.0.0.1:${srv.address().port}/`);await pg.waitForTimeout(1200);
 await pg.screenshot({path:out+'/m_title.png'});
 await pg.touchscreen.tap(400,200);await pg.waitForTimeout(3500);
 await pg.screenshot({path:out+'/m_play.png'});
 const box=await pg.locator('#touch button[data-k=shift]').boundingBox();console.log('shift btn',JSON.stringify(box));
 await pg.evaluate(()=>SHIFTLOCK.start(2));await pg.waitForTimeout(3500);
 await pg.screenshot({path:out+'/m_line3.png'});
 console.log(JSON.stringify(await pg.evaluate(()=>({scene:SHIFTLOCK.scene,line:SHIFTLOCK.line}))),'errors:',errs.length?errs.join('|'):'none');
 await b.close();srv.close();});
