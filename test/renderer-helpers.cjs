const fs=require('node:fs'),vm=require('node:vm');
const {root,source,eventTarget}=require('./helpers.cjs');
function canvas(){
  const c={width:320,height:240,style:{},parentElement:{classList:{add(){}}}};
  const ctx={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),
    getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4).fill(128)}),
    save(){},restore(){},setTransform(){},translate(){},beginPath(){},rect(){},clip(){},drawImage(){},putImageData(){},strokeRect(){}};
  c.getContext=()=>ctx;return c;
}
async function renderer(){
 const window={...eventTarget(),innerWidth:320,innerHeight:240,devicePixelRatio:1,matchMedia:()=>({matches:false}),dispatchEvent(){}};
 const document={createElement:canvas,documentElement:{dataset:{},style:{setProperty(){}}}};
 const context=vm.createContext({console,window,document,TextDecoder,CustomEvent:class {},getComputedStyle:()=>({}),
   fetch:async p=>({ok:true,arrayBuffer:async()=>Uint8Array.from(fs.readFileSync(root+'/'+p)).buffer})});
 const run=code=>vm.runInContext(code,context);
 for(const f of ['assets','model','station-model', 'realism','gfx','data'])run(source('js/'+f+'.js'));
 const api=run('({Assets,Micro3D,Realism,Gfx,GameData})');api.Gfx.init(canvas());
 await api.GameData.load();
 api.Assets.picture=async()=>({width:8,height:4});await api.Realism.load();
 const tex={deep:await api.Assets.texture('textures/deep.bmp'),fx:await api.Assets.texture('textures/fx.bmp')};
 const hardware=n=>/^(u\d|station_|box$|trash$|mine$|torpedo$|kapsel$|stream$|tanker)/.test(n);
 const models={};
 const names=fs.readdirSync(root).filter(p=>p.endsWith('.mbac')).map(p=>p.slice(0,-5));
 for(const n of names){const m=api.Micro3D.loadMBAC(await api.Assets.raw(n+'.mbac'));api.Micro3D.classifyBlend(m,hardware(n)?tex.deep:tex.fx);models[n]=m;}
 return {...api,tex,models,hardware,run,context};
}
module.exports={renderer};
