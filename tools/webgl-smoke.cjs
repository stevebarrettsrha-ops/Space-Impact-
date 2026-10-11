/* Browser integration gate: real WebGL compilation, rendering, resizing and
   context recovery. Run after installing Playwright and Chromium. */
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html','.js':'text/javascript','.png':'image/png','.webp':'image/webp'};
(async()=>{
 const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  fs.readFile(file,(error,data)=>{if(error){res.writeHead(404);res.end();}else{res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(data);}});
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1280,height:960}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
   window.requestAnimationFrame=()=>0;
   const original=HTMLCanvasElement.prototype.getContext;
   HTMLCanvasElement.prototype.getContext=function(type,...args){
    const context=original.call(this,type,...args);if(type==='webgl')window.sceneGL=context;return context;
   };
  });
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.waitForFunction(()=>typeof Game!=='undefined'&&Game.mode==='splash',{},{timeout:60000,polling:100});
  
  const report=await page.evaluate(()=>{
   World.fresh('Graphics check',0,1);window.sector=Flight.enter({});
   Object.assign(sector,{px:10000,py:4000,pz:-15500,throttle:0,yaw:Math.atan2(-10000,15500),pitch:Math.atan2(-4000,Math.hypot(10000,15500))});
   Flight.update(1,Input);Flight.render(Gfx.context());
   for(let i=0;i<600;i++)Gfx.autoScale(100,100);
   return {backend:Gfx.backend,width:Gfx.W,height:Gfx.H,scale:Gfx.renderScale,canvasWidth:document.getElementById('screen').width,canvasHeight:document.getElementById('screen').height,error:sceneGL.getError(),antialias:sceneGL.getContextAttributes().antialias};
  });
  assert.equal(report.backend,'webgl');assert.equal(report.error,0);assert.equal(report.scale,1);assert.equal(report.width,report.canvasWidth);assert.equal(report.height,report.canvasHeight);assert.ok(report.width>=1270&&report.height>=950);
  fs.mkdirSync(path.join(root,'test-output'),{recursive:true});
  await page.screenshot({path:path.join(root,'test-output/gameplay-desktop.png')});
  await page.evaluate(()=>{
   Object.assign(sector,{px:18000,py:-4500,pz:-39000,throttle:.85,t:420,yaw:Math.atan2(-18000,39000),pitch:.06});
   Flight.render(Gfx.context());
  });
  await page.screenshot({path:path.join(root,'test-output/gameplay-propulsion.png')});
  await page.evaluate(()=>{Station.open({undock(){},quit(){}});Gfx.pushPage();Station.render(Gfx.context());Gfx.pop();});
  await page.screenshot({path:path.join(root,'test-output/station-console.png')});
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{Gfx.resize();Flight.render(Gfx.context());});
  assert.equal(await page.evaluate(()=>sceneGL.getError()),0);
  await page.screenshot({path:path.join(root,'test-output/gameplay-portrait.png')});
  await page.evaluate(()=>{window.sceneLoss=sceneGL.getExtension('WEBGL_lose_context');sceneLoss.loseContext();});
  await page.waitForFunction(()=>Gfx.backend==='software',{},{polling:100});
  await page.evaluate(()=>Flight.render(Gfx.context()));
  await page.evaluate(()=>sceneLoss.restoreContext());
  await page.waitForFunction(()=>Gfx.backend==='webgl',{},{polling:100});
  await page.evaluate(()=>Flight.render(Gfx.context()));
  assert.equal(await page.evaluate(()=>sceneGL.getError()),0);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({report,contextRecovery:true,errors},null,2));
 }finally{if(browser)await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
