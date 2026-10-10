/* Optional authoring: npm install --no-save @napi-rs/canvas, then run this file.
   Pictures come from the real game meshes and rasterizer, not separate art. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const root=path.resolve(__dirname,'..');
(async()=>{
 const width=256,height=192,cv=createCanvas(width,height);cv.style={};cv.parentElement={classList:{add(){}}};
 const window={innerWidth:width,innerHeight:height,devicePixelRatio:1,addEventListener(){},dispatchEvent(){},matchMedia:()=>({matches:false})};
 const document={createElement:()=>createCanvas(1,1),documentElement:{dataset:{},style:{setProperty(){}}}};
 const context=vm.createContext({console,window,document,CustomEvent:class{},getComputedStyle:()=>({}),TextDecoder,
  fetch:async p=>({ok:true,arrayBuffer:async()=>Uint8Array.from(fs.readFileSync(path.join(root,p))).buffer})});
 for(const f of ['assets','model','mesh-kit','station-model','world-assets','catalog','realism','gfx','data'])
  vm.runInContext(fs.readFileSync(path.join(root,'js',f+'.js'),'utf8'),context);
 const {Assets,Micro3D,Realism,WorldAssets,Catalog,Gfx:g,GameData}=vm.runInContext('({Assets,Micro3D,Realism,WorldAssets,Catalog,Gfx,GameData})',context);
 Assets.picture=p=>loadImage(path.join(root,p));await Realism.load();await GameData.load();
 const tex=await Assets.texture('textures/fx.bmp'),models={};
 for(const name of GameData.creatures.flatMap(c=>c.models)){
  const m=Micro3D.loadMBAC(await Assets.raw(name+'.mbac'));Micro3D.classifyBlend(m,tex);models[name]=m;
 }
 Realism.prepare(models,()=>tex,GameData.creatures);WorldAssets.catalogue(models,GameData);
 g.init(cv);g.setDetail('native');
 const out=createCanvas(Catalog.COLS*Catalog.CELL_W,Math.ceil(Catalog.ENTRIES.length/Catalog.COLS)*Catalog.CELL_H),ctx=out.getContext('2d');
 Catalog.ENTRIES.forEach((e,i)=>{
  const m=models[e.model];if(!m||!m.count)throw new Error('Missing catalogue model '+e.model);
  const cy=(m.bbox[1]+m.bbox[4])/2;
  g.clearTo(0,0,0);g.setLamp(.15,m.radius*3);g.setFog(0,0,0,1e7,2e7);
  g.setCamera(0,cy+m.radius*.3,-m.radius*2.75,0,-.1,0,.88);
  g.drawModel(m,0,0,0,g.rotMatrix(e.yaw,-.10,0),1,tex,{ambient:.7,noFog:true});
  // Preserve a transparent surround; depth marks the occupied model pixels.
  const image=cv.getContext('2d').createImageData(g.W,g.H);
  const words=new Uint32Array(image.data.buffer);
  let left=g.W,top=g.H,right=0,bottom=0;
  for(let p=0;p<words.length;p++){
   const occupied=g.zbuf[p]<1e29;words[p]=occupied?g.buf32[p]:0;
   if(occupied){const x=p%g.W,y=Math.floor(p/g.W);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  }
  if(left>right)throw new Error('Empty catalogue render '+e.model);
  cv.getContext('2d').putImageData(image,0,0);
  const sw=right-left+1,sh=bottom-top+1,k=Math.min((Catalog.CELL_W-12)/sw,(Catalog.CELL_H-12)/sh);
  const dw=sw*k,dh=sh*k;
  ctx.drawImage(cv,left,top,sw,sh,i%Catalog.COLS*Catalog.CELL_W+(Catalog.CELL_W-dw)/2,
   Math.floor(i/Catalog.COLS)*Catalog.CELL_H+(Catalog.CELL_H-dh)/2,dw,dh);
 });
 fs.mkdirSync(path.join(root,'previews'),{recursive:true});
 fs.writeFileSync(path.join(root,Catalog.PATH),out.toBuffer('image/webp',94));
 console.log(Catalog.ENTRIES.length+' model previews written to '+Catalog.PATH);
})().catch(e=>{console.error(e);process.exitCode=1;});
