/* Optional asset-authoring tool. Install @napi-rs/canvas locally to rebuild
   the checked-in material maps; the game and tests have no dependency on it. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const root=path.resolve(__dirname,'..');
(async()=>{
 const context=vm.createContext({console,TextDecoder,document:{createElement:()=>createCanvas(1,1)},
   fetch:async p=>({ok:true,arrayBuffer:async()=>Uint8Array.from(fs.readFileSync(path.join(root,p))).buffer})});
 for(const f of ['assets','model','data','station-model', 'realism'])vm.runInContext(fs.readFileSync(path.join(root,'js',f+'.js'),'utf8'),context);
 const {Assets,Micro3D,GameData,Realism}=vm.runInContext('({Assets,Micro3D,GameData,Realism})',context);
 Assets.picture=p=>loadImage(path.join(root,p));await Realism.load(true);await GameData.load();
 const tex={deep:await Assets.texture('textures/deep.bmp'),fx:await Assets.texture('textures/fx.bmp')};
 const hardware=n=>/^(u\d|station_|box$|trash$|mine$|torpedo$|kapsel$|stream$|tanker)/.test(n);
 const models={};
 for(const file of fs.readdirSync(root).filter(p=>p.endsWith('.mbac'))){
   const n=file.slice(0,-5),m=Micro3D.loadMBAC(await Assets.raw(file));Micro3D.classifyBlend(m,hardware(n)?tex.deep:tex.fx);models[n]=m;
 }
 Realism.prepare(models,n=>hardware(n)?tex.deep:tex.fx,GameData.creatures);
 for(const key of Realism.MAPS){
   const t=Realism.compiled.get(key);if(!t)throw new Error('Missing material '+key);
   const c=createCanvas(t.w,t.h),ctx=c.getContext('2d'),image=ctx.createImageData(t.w,t.h);image.data.set(t.data);ctx.putImageData(image,0,0);
   // Lossless storage preserves the exact keyed edges, highlights and UV cells.
   fs.writeFileSync(path.join(root,'materials',key+'.png'),c.toBuffer('image/png'));
   console.log(key,t.w,t.h);
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
