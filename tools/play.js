// Headless smoke test: screenshots of the title, a typed line, play and a shifted page.
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const root=path.resolve(__dirname,'..');const out=process.argv[2]||'/tmp/shots';fs.mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png'};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';const p=path.join(root,u);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();return}r.writeHead(200,{'Content-Type':types[path.extname(p)]||'application/octet-stream'});r.end(b)})}).listen(0,async()=>{
 const b=await chromium.launch();const pg=await b.newPage({viewport:{width:1280,height:720}});
 const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
 await pg.goto(`http://127.0.0.1:${srv.address().port}/`);await pg.waitForTimeout(1500);
 await pg.screenshot({path:out+'/01_title.png'});
 const lv=+(process.argv[3]||0);
 await pg.evaluate((k)=>SHIFTLOCK.start(k),lv);await pg.waitForTimeout(900);await pg.screenshot({path:out+'/02_typing.png'});
 await pg.waitForTimeout(2500);await pg.screenshot({path:out+'/03_play.png'});
 await pg.keyboard.down('ArrowRight');await pg.waitForTimeout(500);await pg.keyboard.press('Space');await pg.waitForTimeout(400);await pg.keyboard.up('ArrowRight');
 await pg.waitForTimeout(300);await pg.screenshot({path:out+'/04_moved.png'});
 await pg.keyboard.down('Shift');await pg.waitForTimeout(300);await pg.screenshot({path:out+'/05_shift.png'});await pg.keyboard.up('Shift');
 console.log(JSON.stringify(await pg.evaluate(()=>({scene:SHIFTLOCK.scene,line:SHIFTLOCK.line,mode:SHIFTLOCK.mode,dot:SHIFTLOCK.dot&&{x:SHIFTLOCK.dot.x|0,y:SHIFTLOCK.dot.y|0}}))));
 console.log('errors:',errs.length?errs.join(' | '):'none');await b.close();srv.close();});
