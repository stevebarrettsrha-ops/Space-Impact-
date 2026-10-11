const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {renderer}=require('./renderer-helpers.cjs');
const {game,root,drawingContext}=require('./helpers.cjs');
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
 const a=await ready(),m=a.models.gulper_eel;
 const before=a.original.gulper_eel.tris.filter(t=>t.blend===2),after=m.tris.filter(t=>t.blend===2);
 assert.ok(before.length>0);assert.equal(after.length,before.length);assert.equal(m.emissionTexture,a.tex.fx);
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

test('station hulls stay inside collision bounds with valid outward and interior faces at both detail levels',async()=>{
 const a=await ready();
 for(const name of ['station_civil','station_rebel'])for(const m of [a.models[name],a.models[name].lod]){
  assert.ok(m.radius<16000,'station fits within the docking approach');
  assert.ok(m.collision.length>=8,'compound collision preserves clear passages');
  assert.ok(m.bbox[3]-m.bbox[0]>17500,'large stations keep broad industrial wings');
  assert.ok(m.bbox[4]-m.bbox[1]>13000,'command tower preserves a tall silhouette');
  assert.ok(m.tris.every(t=>t.blend===0),'no floating flare planes');
  for(let i=0;i<m.count;i++)assert.ok(Math.abs(Math.hypot(...m.N.subarray(i*3,i*3+3))-1)<1e-5);
  for(const t of m.tris){
   const p=Array.from(m.V.subarray(t.a*3,t.a*3+3));
   const q=Array.from(m.V.subarray(t.b*3,t.b*3+3),(v,k)=>v-p[k]);
   const r=Array.from(m.V.subarray(t.c*3,t.c*3+3),(v,k)=>v-p[k]);
   const n=[q[1]*r[2]-q[2]*r[1],q[2]*r[0]-q[0]*r[2],q[0]*r[1]-q[1]*r[0]];
   assert.ok(n.reduce((s,v,k)=>s+v*m.N[t.a*3+k],0)>0,'winding must agree with surface normal');
   for(const k of ['ua','ub','uc'])assert.ok(t[k]>=0&&t[k]<m.texture.w);
   for(const k of ['va','vb','vc'])assert.ok(t[k]>=0&&t[k]<m.texture.h);
  }
 }
 assert.notDeepEqual(a.models.station_civil.texture.data,a.models.station_rebel.texture.data);
});

test('flight and dock console render the same complete station at the same scale for both factions',async()=>{
 const a=await game(),drawn=[],models={station_civil_0_2:{},station_rebel_0_2:{}};
 Object.assign(a.gfx,{setFog(){},setLamp(){},clearGradient(){},setCamera(){},waterLight(){},rotMatrix(){},
   point(){},drawModel:(m,x,y,z,r,s)=>drawn.push({m,s}),project:()=>null});
 a.Flight.bind(models,{deep:{}},{},()=>({}));a.Station.bind(models,{deep:{}},{},()=>({}));
 for(const rebel of [false,true]){
  a.World.setRebel(a.World.state().station,rebel);
  const sector=a.Flight.enter({noLife:true,noFriends:true,enemies:0});sector.radar=0;
  drawn.length=0;a.Flight.render(drawingContext());
  assert.equal(drawn.length,1);assert.equal(drawn[0].m,models[rebel?'station_rebel_0_2':'station_civil_0_2']);
  const flight=drawn.pop();a.Station.open({undock(){},quit(){}});a.Station.render(drawingContext());
  assert.equal(drawn.length,1);assert.equal(drawn[0].m,flight.m);assert.equal(drawn[0].s,flight.s);
 }
});

test('station rebuild preserves approach range and completes docking without a collision lock',async()=>{
 const a=await game(),events=[],sector=a.Flight.enter({noLife:true,noFriends:true,enemies:0,onDone:r=>events.push(r)});
 sector.throttle=0;sector.px=0;sector.py=0;sector.pz=-15100;
 a.Input.virtual('action',true);a.Flight.update(1,a.Input);a.Input.reset();
 assert.equal(sector.docking,null);
 sector.pz=-14900;a.Input.virtual('action',true);a.Flight.update(1,a.Input);a.Input.reset();
 assert.ok(sector.docking);
 for(let i=0;i<56;i++)a.Flight.update(1,a.Input);
 assert.deepEqual(events,['dock']);assert.equal(sector.docking,null);
});

test('every station in the 200-station world resolves to a bounded design for either faction',async()=>{
 const a=await ready(),StationModel=a.run('StationModel'),designs=new Set();
 assert.equal(a.GameData.stations.length,200);
 for(const station of a.GameData.stations)for(const rebel of [false,true]){
  const key=StationModel.key(rebel,station),m=a.models[key];designs.add(key);
  assert.ok(m&&m.count>0,key);assert.ok(m.radius<16000,key+' exceeds approach envelope');
  assert.ok(m.lod&&m.lod.tris.length<m.tris.length);
 }
 assert.equal(designs.size,24);
});

test('civil and rebel stations share geometry at both detail levels while retaining their skins',async()=>{
 const a=await ready(),api=a.run('StationModel');
 for(let family=0;family<4;family++)for(let tier=0;tier<3;tier++){
  const civil=a.models[api.key(false,{family,tier})],rebel=a.models[api.key(true,{family,tier})];
  for(const [c,r] of [[civil,rebel],[civil.lod,rebel.lod]]){
   assert.notEqual(c,r);assert.notEqual(c.name,r.name);assert.notEqual(c.texture,r.texture);
   for(const field of ['V','N','tris','bbox','collision'])assert.equal(c[field],r[field],field+' must be shared');
   assert.equal(c.count,r.count);assert.equal(c.radius,r.radius);
  }
 }
 for(const rebel of [false,true])assert.equal(a.models[api.key(rebel)],a.models[api.key(rebel,{family:0,tier:1})]);
});

test('all ships and active props use complete replacement meshes and render from front and rear',async()=>{
 const a=await ready(),WorldAssets=a.run('WorldAssets'),g=a.Gfx,shapes=new Set();
 for(const name of [...a.GameData.ships.map(s=>s.model),...WorldAssets.PROPS]){
  const m=a.models[name];assert.ok(m&&m.count>0,name);assert.notEqual(m,a.original[name]);
  if(name.startsWith('u')){
   assert.ok(m.tris.every(t=>t.blend===0),'ships cannot contain exhaust billboards');
   assert.ok(m.wake.z<0);assert.ok(m.bbox[5]<3000,'bow stays behind the weapon launch position');
   shapes.add(require('node:crypto').createHash('sha256').update(Buffer.from(m.V.buffer)).digest('hex'));
  }
  for(const yaw of [.6,2.4]){
   g.clearTo(0,0,0);g.setCamera(0,0,-m.radius*3,0,0,0,1);g.setFog(0,0,0,1e7,2e7);
   g.drawModel(m,0,0,0,g.rotMatrix(yaw,.12,0),1,null,{ambient:.7,noFog:true});
   assert.ok(Array.from(g.buf32).filter(p=>(p&0xffffff)!==0).length>40,name+' failed to render');
  }
 }
 assert.equal(shapes.size,11);
});

test('transit gate has an unobstructed opening and propulsion wakes remain behind the ship',async()=>{
 const a=await ready(),g=a.Gfx,m=a.models.stream;
 g.clearTo(0,0,0);g.setCamera(0,0,-20000,0,0,0,1);g.setFog(0,0,0,1e7,2e7);
 g.drawModel(m,0,0,0,null,1,null,{ambient:.7,noFog:true});
 assert.equal(g.buf32[Math.floor(g.H/2)*g.W+Math.floor(g.W/2)]&0xffffff,0);
 assert.ok(g.zbuf[Math.floor(g.H/2)*g.W+Math.floor(g.W/2)]>1e29);
 const points=[],original=g.point;g.point=(...args)=>points.push(args);
 try{
  const assets=a.run('WorldAssets'),ship=a.models.u0;
  assets.drawWake(ship,0,0,0,g.rotMatrix(0,0,0),1,.5,0);assert.equal(points.length,0);
  assets.drawWake(ship,0,0,0,g.rotMatrix(0,0,0),1,.5,1);
  assert.ok(points.length>2&&points.length<128,'bounded continuous jet and bubble particle budget');
  assert.ok(points.some(p=>p[0]<0)&&points.some(p=>p[0]>0),'both outboard engines produce a wake');
  for(const [x,y,z,r] of points){assert.ok(z<=ship.wake.z&&z>=ship.wake.z-2400);assert.ok(r>0&&r<450);}
 }finally{g.point=original;}
});

test('catalogue covers every ship view, equipment item and cargo good with a bundled model preview',async()=>{
 const a=await game(),catalog=a.run('Catalog'),images={},bytes=fs.readFileSync(root+'/'+catalog.PATH);
 assert.equal(bytes.subarray(0,4).toString(),'RIFF');assert.equal(bytes.subarray(8,12).toString(),'WEBP');
 a.Assets.picture=async()=>({width:catalog.COLS*catalog.CELL_W,height:Math.ceil(catalog.ENTRIES.length/catalog.COLS)*catalog.CELL_H});
 await catalog.load(images);
 const keys=[...a.GameData.ships.flatMap(s=>[s.icon+'a',s.icon+'b']),...a.GameData.equip.map(e=>e.icon),...a.GameData.goods.map(g=>g.icon)];
 assert.equal(keys.length,108);assert.equal(Object.keys(images).length,keys.length);
 for(const key of keys){assert.ok(images[key],key);assert.ok(images[key].uiWidth<=60&&images[key].uiHeight<=36);}
 a.Assets.picture=async()=>({width:1,height:1});await assert.rejects(()=>catalog.load({}),/dimensions/);
});

 test('station collision follows solid wings and leaves the docking throat clear',async()=>{
 const a=await ready(),station=a.models.station_civil,api=a.run('StationModel');
 assert.equal(api.contact(station,0,-1500,-6500,500),null);
 assert.equal(api.contact(station,4200,-1200,-5000,500),null);
 for(const point of [[7600,0,0],[-7600,0,0],[0,4000,0],[0,600,-7000]]){
  const hit=api.contact(station,...point,500);assert.ok(hit);assert.ok(hit.penetration>0);
  const corrected=point.map((v,i)=>v+hit.normal[i]*(hit.penetration+.1));
  assert.equal(api.contact(station,...corrected,500),null);
 }
});

test('canyon backdrop triangles stay outside the navigable sector',async()=>{
 const a=await ready(),draw=a.Gfx.drawModel;let terrain;
 try{a.Gfx.drawModel=model=>{terrain=model;};a.Realism.drawEnvironment(0);}finally{a.Gfx.drawModel=draw;}
 assert.ok(terrain&&terrain.tris.length>0);
 for(const t of terrain.tris){
  const nearest=[0,1,2].map(k=>{
   const coordinates=[t.a,t.b,t.c].map(i=>terrain.V[i*3+k]);
   const lo=Math.min(...coordinates),hi=Math.max(...coordinates);
   return lo>0?lo:hi<0?-hi:0;
  });
  assert.ok(Math.hypot(...nearest)>90000,'scenery must not intrude into flight routes');
 }
});
