// Stills for the itch.io page: the trailer script without captions, frames saved at chosen moments.
// usage: node trailer/stills.js OUTDIR
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const root=path.resolve(__dirname,'..');const out=process.argv[2];fs.mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.json':'application/json'};
const SHOTS=[['01_title',null,2.2],['02_line1','l1',1.6],['03_shift_comma','l3',2.6],['04_dash_lift','l5',3.4],['05_red_pen','l6',2.9],['06_reply','reply',2.9],['07_letter','ending',4.4]];
const srv=http.createServer((q,r)=>{const p=path.join(root,decodeURIComponent(q.url.split('?')[0]));fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();return}r.writeHead(200,{'Content-Type':types[path.extname(p)]||'application/octet-stream'});r.end(b)})}).listen(0,async()=>{
 const b=await chromium.launch({args:['--hide-scrollbars']});const pg=await b.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
 const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.addInitScript({path:path.join(__dirname,'harness.js')});await pg.addInitScript(()=>{window.__noCaptions=true;});
 await pg.goto(`http://127.0.0.1:${srv.address().port}/index.html`);
 await pg.waitForFunction(()=>document.fonts.status==='loaded'&&window.__ready&&window.__ready());
 await pg.evaluate(()=>window.__installSoundLog());await pg.evaluate(p=>{window.__PLANS=p},JSON.parse(fs.readFileSync(path.join(__dirname,'plans.json'),'utf8')));
 await pg.evaluate(fs.readFileSync(path.join(__dirname,'director.js'),'utf8'));
 const todo=SHOTS.slice();let n=0;
 while(todo.length&&n<60*90){const done=await pg.evaluate(ms=>window.__frame(ms),1000/60);n++;const t=n/60;
  const cues=await pg.evaluate(()=>window.__cues||{});
  const [name,cue,off]=todo[0];const at=(cue?cues[cue]:0);
  if(at!=null&&t>=at+off){await pg.screenshot({path:`${out}/${name}.png`});todo.shift();}
  if(done)break;}
 console.log('left',todo.length,'frames',n,'errors',errs.length?errs.join('|'):'none');await b.close();srv.close();});
