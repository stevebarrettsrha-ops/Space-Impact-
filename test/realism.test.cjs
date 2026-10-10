const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {renderer}=require('./renderer-helpers.cjs');
const {game,root}=require('./helpers.cjs');
let pending;
async function ready(){if(!pending)pending=renderer().then(a=>{a.original={...a.models};a.Realism.prepare(a.models,n=>a.hardware(n)?a.tex.deep:a.tex.fx,a.GameData.creatures);return a;});return pending;}

test('material artwork is a bundled WebP image and every world entity has a material profile',async()=>{
 const a=await ready(),bytes=fs.readFileSync(root+'/'+a.Realism.PATH);
 assert.equal(bytes.subarray(0,4).toString(),'RIFF');assert.equal(bytes.subarray(8,12).toString(),'WEBP');
 for(const key of a.Realism.MAPS){const image=fs.readFileSync(root+'/materials/'+key+'.png');assert.equal(image.subarray(1,4).toString(),'PNG');assert.equal(image.readUInt32BE(16),512);assert.equal(image.readUInt32BE(20),512);}
 for(const c of a.GameData.creatures)assert.ok(a.models['creature_'+c.id].texture);
 for(const n of ['u0','u1','u2','u3','u4','u5','u6','u7','u8','u9','u10','box','mine','torpedo','kapsel','trash','stream','station_starter','station_top','station_bottom','station_hangar_de']){
   assert.ok(a.models[n].material,n);assert.ok(a.models[n].texture.data.length>0,n);
 }
});
test('two-part creatures retain front and rear sections at every animation phase',async()=>{
 const a=await ready();
 for(const c of a.GameData.creatures.filter(c=>c.models.length===2)){
   const m=a.models['creature_'+c.id],originals=c.models.map(n=>a.original[n]);
   assert.equal(m.lod.count,originals.reduce((n,p)=>n+p.count,0));
   assert.equal(m.lod.tris.length,originals.reduce((n,p)=>n+p.tris.length,0));
   for(const phase of [0,1,2,3])assert.ok(a.Realism.deformation(m,phase,false));
   assert.equal(a.Realism.deformation(m,2,true),null);
 }
});
test('all enhanced mesh indices, normals, UVs and material samples remain valid',async()=>{
 const a=await ready();
 for(const [name,m] of Object.entries(a.models).filter(([,m])=>m.material)){
  assert.ok(Array.from(m.V).every(Number.isFinite),name);
  assert.ok(Array.from(m.N).every(Number.isFinite),name);
  assert.equal(m.N.length,m.V.length);
  assert.equal(m.texture.data.length,m.texture.w*m.texture.h*4);
  for(const t of m.tris){for(const k of ['a','b','c'])assert.ok(t[k]>=0&&t[k]<m.count,name);
    for(const k of ['ua','ub','uc','va','vb','vc'])assert.ok(Number.isFinite(t[k]),name);}
 }
});
test('five algae species use complete opaque leaf geometry with distinct texture colours',async()=>{
 const a=await ready(),colours=new Set();
 for(let i=13;i<18;i++){const m=a.models['creature_'+i];assert.ok(m.tris.length>500);assert.ok(m.tris.every(t=>t.blend===0));
   colours.add(Array.from(m.texture.data.subarray(0,3)).join(','));}
 assert.equal(colours.size,5);
});
test('emissive UVs and textures are preserved when solid surfaces are refined',async()=>{
 const a=await ready(),m=a.models.u0;
 const before=a.original.u0.tris.filter(t=>t.blend===2),after=m.tris.filter(t=>t.blend===2);
 assert.ok(before.length>0);assert.equal(after.length,before.length);assert.equal(m.emissionTexture,a.tex.deep);
 after.forEach((t,i)=>assert.deepEqual(t.emission,before[i]));
});
test('real rasterizer renders detailed models, animation changes pixels, and depth hides bubbles',async()=>{
 const a=await ready(),g=a.Gfx,m=a.models.creature_8;
 function draw(phase){g.clearTo(4,18,24);g.setFog(4,18,24,1e6,2e6);g.setCamera(0,0,-4800,0,0,0,1);
   g.drawModel(m,0,0,0,g.rotMatrix(1.05,0,0),1,a.tex.fx,{ambient:.6,deform:a.Realism.deformation(m,phase,false)});
   return Uint32Array.from(g.buf32);}
 const first=draw(0),second=draw(1.8);let count=0,different=0;
 for(let i=0;i<first.length;i++){if(g.zbuf[i]<1e29)count++;if(first[i]!==second[i])different++;}
 assert.ok(count>200);assert.ok(different>100);
 g.zbuf.fill(1);const before=Uint32Array.from(g.buf32);g.point(0,0,0,500,255,255,255,true,true);
 assert.deepEqual(Uint32Array.from(g.buf32),before);
});
test('flight renders the whole creature mesh instead of alternating body parts',async()=>{
 const a=await game(),sector=a.enter(),drawn=[];
 const mesh={name:'shark_01',bbox:[-100,-50,-200,100,50,200]},models={creature_8:mesh};
 a.Flight.bind(models,{fx:{}},{},()=>({}));
 Object.assign(a.gfx,{setFog(){},setLamp(){},clearGradient(){},setCamera(){},waterLight(){},rotMatrix(){},
   point(){},drawModel:m=>drawn.push(m),project:()=>null});
 const ctx={fillRect(){},strokeRect(){},fillText(){},measureText:()=>({width:10}),beginPath(){},moveTo(){},lineTo(){},closePath(){},stroke(){}};
 sector.radar=0;a.Flight.spawnCreature(8,0,0,sector.pz+1000);
 for(const phase of [0,1,2]){sector.ents[0].frame=phase%2;sector.ents[0].anim=phase;a.Flight.render(ctx);}
 assert.equal(drawn.length,3);assert.ok(drawn.every(m=>m===mesh));
});

test('camera and model pitch agree with the flight direction when diving or climbing',async()=>{
 const {Gfx:g}=await ready();
 for(const pitch of [-1,-.4,0,.4,1])for(const yaw of [-.8,0,.7]){
   const x=Math.sin(yaw)*Math.cos(pitch),y=Math.sin(pitch),z=Math.cos(yaw)*Math.cos(pitch);
   g.setCamera(0,0,0,yaw,pitch,0,1);
   const p=g.project(x*5000,y*5000,z*5000);
   assert.ok(p);assert.ok(Math.abs(p.x-g.lw/2)<.001);assert.ok(Math.abs(p.y-g.lh/2)<.001);
   const r=g.rotMatrix(yaw,pitch,0);
   assert.ok(Math.abs(r[2]-x)<1e-6);assert.ok(Math.abs(r[5]-y)<1e-6);assert.ok(Math.abs(r[8]-z)<1e-6);
 }
});

test('automatic detail cannot crop the viewport when it reaches the minimum buffer size',async()=>{
 const {Gfx:g}=await ready();g.setDetail('auto');
 for(let i=0;i<600;i++)g.autoScale(100,100);
 const k=1/g.renderScale;
 assert.ok(g.W>=120&&g.H>=120);
 assert.ok(g.W*k>=320&&g.W*k<320+k);
 assert.ok(g.H*k>=240&&g.H*k<240+k);
 g.setDetail('native');
});
