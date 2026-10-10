/* Realistic surface materials and continuous deformation for the original
   3D silhouettes. Built once at boot; no network or allocations per vertex. */
'use strict';
const Realism = (() => {
  const PATH = 'materials/surfaces.webp';
  const MAPS=['deep-metal','deep-wreck','fx-shell','fx-skin','fx-scales','fx-turtle','fx-jelly','fx-shrimp','fx-kelp','fx-wreck'];
  const SCALE = 4;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const profiles = {
    scales: {tile:0, colour:[0.62,0.76,0.81], mix:0.64, specular:0.32, gloss:28},
    skin: {tile:1, colour:[0.58,0.65,0.68], mix:0.72, specular:0.30, gloss:22},
    shell: {tile:2, colour:[0.96,0.84,0.67], mix:0.82, specular:0.26, gloss:36},
    turtle: {tile:3, colour:[0.67,0.69,0.43], mix:0.78, specular:0.20, gloss:20},
    metal: {tile:4, colour:[0.85,0.91,0.93], mix:0.28, specular:0.48, gloss:44},
    wreck: {tile:5, colour:[0.73,0.69,0.60], mix:0.48, specular:0.15, gloss:14},
    kelp: {tile:6, colour:[0.65,0.84,0.42], mix:0.68, specular:0.20, gloss:18},
    rock: {tile:7, colour:[0.65,0.68,0.63], mix:0.85, specular:0.04, gloss:8},
    jelly: {tile:1, colour:[0.56,0.81,0.88], mix:0.58, specular:0.50, gloss:48},
    shrimp: {tile:2, colour:[0.85,0.53,0.37], mix:0.62, specular:0.28, gloss:30}
  };
  let sheet, terrain;
  const compiled=new Map();
  const cache = new Map();
  function profile(name) {
    if (name === 'nautilus') return 'shell';
    if (name.startsWith('turtle')) return 'turtle';
    if (name.startsWith('shrimp')) return 'shrimp';
    if (name === 'jellyfish') return 'jelly';
    if (name.startsWith('alga_')) return 'kelp';
    if (/^(whale|shark|manta|gulper_eel|squid)/.test(name)) return 'skin';
    if (/^(anglerfish|devilfish|marlin|fish_swarm|aquar)/.test(name)) return 'scales';
    if (/^(trash|biowaste|fischtod)$/.test(name)) return 'wreck';
    if (/^(u\d+$|station_|box$|mine$|torpedo$|kapsel$|stream$|tanker)/.test(name)) return 'metal';
    return null;
  }
  function sample(tile, u, v) {
    const tw=sheet.w/4, th=sheet.h/2;
    // Reflect the coordinates at tile edges to avoid a wrapping seam.
    const mirror=t=>{t=((t%2)+2)%2;return t>1?2-t:t;};
    const x=clamp(Math.floor((tile%4)*tw+2+mirror(u)*(tw-5)),0,sheet.w-1);
    const y=clamp(Math.floor(Math.floor(tile/4)*th+2+mirror(v)*(th-5)),0,sheet.h-1);
    return (y*sheet.w+x)*4;
  }
  function bake(source, kind) {
    let byKind=cache.get(source);
    if (!byKind) cache.set(source,byKind=new Map());
    if (byKind.has(kind)) return byKind.get(kind);
    const p=profiles[kind], w=source.w*SCALE, h=source.h*SCALE;
    const data=new Uint8ClampedArray(w*h*4), src=source.data;
    for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
      const a=((Math.floor(y/SCALE)*source.w)+Math.floor(x/SCALE))*4, b=(y*w+x)*4;
      const r=src[a],g=src[a+1],bl=src[a+2], alpha=src[a+3];
      data[b+3]=alpha;
      // Keep key pixels, warm eyes and luminous accents intact.
      if(!alpha || r+g+bl<=30 || (r>g*1.28 && r>bl*1.45)) {
        data[b]=r; data[b+1]=g; data[b+2]=bl; continue;
      }
      const fx=clamp((x+.5)/SCALE-.5,0,source.w-1),fy=clamp((y+.5)/SCALE-.5,0,source.h-1);
      const ix=Math.floor(fx),iy=Math.floor(fy),ax=fx-ix,ay=fy-iy;
      const at=(xx,yy,k)=>src[(Math.min(yy,source.h-1)*source.w+Math.min(xx,source.w-1))*4+k];
      const smooth=k=>at(ix,iy,k)*(1-ax)*(1-ay)+at(ix+1,iy,k)*ax*(1-ay)+at(ix,iy+1,k)*(1-ax)*ay+at(ix+1,iy+1,k)*ax*ay;
      const channels=[smooth(0),smooth(1),smooth(2)];
      const q=sample(p.tile,x/w*3,y/h*3), lum=(channels[0]*.25+channels[1]*.55+channels[2]*.20)/255;
      const detail=(sheet.data[q]+sheet.data[q+1]+sheet.data[q+2])/3;
      for(let k=0;k<3;k++) {
        const original=channels[k];
        const natural=(kind==='metal'||kind==='wreck'?32+lum*195:70+lum*130)*p.colour[k];
        const grain=0.72+detail/255*.52;
        data[b+k]=clamp((original*(1-p.mix)+natural*p.mix)*grain,0,255);
      }
    }
    const t={w,h,data}; byKind.set(kind,t); return t;
  }
  function bounds(model) {
    const b=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity]; let r=0;
    for(let i=0;i<model.V.length;i+=3){for(let k=0;k<3;k++){b[k]=Math.min(b[k],model.V[i+k]);b[k+3]=Math.max(b[k+3],model.V[i+k]);}r=Math.max(r,Math.hypot(model.V[i],model.V[i+1],model.V[i+2]));}
    model.bbox=b; model.radius=r; model.count=model.V.length/3; return model;
  }
  function combine(parts) {
    const V=[],N=[],tris=[];
    for(const m of parts){const offset=V.length/3;V.push(...m.V);N.push(...(m.N||new Float32Array(m.V.length)));for(const t of m.tris)tris.push({...t,a:t.a+offset,b:t.b+offset,c:t.c+offset});}
    return bounds({V:new Float32Array(V),N:new Float32Array(N),tris});
  }
  /* Curved edge subdivision using endpoint normals. Shared edges use the
     same midpoint, UV seams remain separate, and emissive quads stay intact. */
  function refine(model) {
    const V=Array.from(model.V),N=Array.from(model.N),tris=[], edges=new Map();
    function midpoint(a,b){const key=a<b?a+':'+b:b+':'+a;if(edges.has(key))return edges.get(key);
      const i=V.length/3, delta=[0,1,2].map(k=>V[b*3+k]-V[a*3+k]);
      const da=delta.reduce((s,x,k)=>s+x*N[a*3+k],0),db=delta.reduce((s,x,k)=>s+x*N[b*3+k],0);
      let normal=[0,1,2].map(k=>N[a*3+k]+N[b*3+k]),len=Math.hypot(...normal)||1;
      for(let k=0;k<3;k++){V.push((V[a*3+k]+V[b*3+k])/2+(db*N[b*3+k]-da*N[a*3+k])*.10);N.push(normal[k]/len);}edges.set(key,i);return i;}
    for(const t of model.tris){
      if(t.blend){tris.push({...t});continue;}
      const ab=midpoint(t.a,t.b),bc=midpoint(t.b,t.c),ca=midpoint(t.c,t.a);
      const a=[t.a,t.ua,t.va],b=[t.b,t.ub,t.vb],c=[t.c,t.uc,t.vc];
      const d=[ab,(t.ua+t.ub)/2,(t.va+t.vb)/2],e=[bc,(t.ub+t.uc)/2,(t.vb+t.vc)/2],f=[ca,(t.uc+t.ua)/2,(t.vc+t.va)/2];
      for(const [p,q,r] of [[a,d,f],[d,b,e],[f,e,c],[d,e,f]])tris.push({m:t.m,blend:t.blend,a:p[0],b:q[0],c:r[0],ua:p[1],va:p[2],ub:q[1],vb:q[2],uc:r[1],vc:r[2]});
    }
    return bounds({...model,V:new Float32Array(V),N:new Float32Array(N),tris,lod:model});
  }
  function upgrade(model,kind,texture,name) {
    const key=(kind==='metal'||name==='trash'?'deep-':'fx-')+kind;
    if(!compiled.has(key))compiled.set(key,bake(texture,kind));
    const copy={...model,tris:model.tris.map(t=>{const n={...t};for(const key of ['ua','ub','uc','va','vb','vc'])n[key]*=SCALE;delete n.bu0;delete n.bu1;delete n.bv0;delete n.bv1;return n;}),texture:compiled.get(key),material:profiles[kind],name};
    // Original emissive cells must retain their original colour and UVs.
    copy.emissionTexture=texture;
    copy.tris.forEach((t,i)=>{if(t.blend===2)t.emission=model.tris[i];});
    return copy.N ? refine(copy) : copy;
  }
  async function load(baking=false) {
    async function decode(path){
      const image=await Assets.picture(path),canvas=document.createElement('canvas');
      canvas.width=image.width;canvas.height=image.height;
      const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
      return {w:image.width,h:image.height,data:ctx.getImageData(0,0,image.width,image.height).data};
    }
    sheet=await decode(PATH);compiled.clear();
    if(!baking)await Promise.all(MAPS.map(async key=>compiled.set(key,await decode('materials/'+key+'.png'))));
  }
  function prepare(models,texFor,creatures) {
    if(!sheet) throw new Error('Realistic surface materials were not loaded');
    cache.clear();
    const original={...models};
    for(const [name,m] of Object.entries(original)) {const p=profile(name);if(p && m.count)models[name]=upgrade(m,p,texFor(name),name);}
    for(const c of creatures){
      const parts=c.models.map(n=>original[n]).filter(Boolean);
      if(!parts.length)continue;
      const name=c.models[0],combined=combine(parts),kind=profile(name);
      models['creature_'+c.id]=c.id>=13 ? kelp(combined,c.id-13,name) : upgrade(combined,kind,texFor(name),name);
    }
    const metal=tileTexture(4);
    for(const rebel of [false,true])models[StationModel.key(rebel)]=StationModel.build(metal,rebel);
    terrain=makeTerrain();
  }
  function tileTexture(tile,colour) {
    const w=256,data=new Uint8ClampedArray(w*w*4);
    for(let y=0;y<w;y++)for(let x=0;x<w;x++){
      const p=sample(tile,x/w,y/w),q=(y*w+x)*4;
      for(let k=0;k<3;k++)data[q+k]=sheet.data[p+k]*(colour?colour[k]:1);
      data[q+3]=255;
    }
    return {w,h:w,data};
  }
  function kelp(source,species,name,low=false) {
    const V=[],N=[],tris=[],b=source.bbox,height=b[4]-b[1],width=(b[3]-b[0])*.45;
    const palette=[[1.28,1.08,.65],[.50,.94,1.65],[.92,.66,.45],[1.40,.35,.38],[.62,1.15,.62]];
    const leaves=low?6:10+species*2,steps=low?6:16;
    for(let leaf=0;leaf<leaves;leaf++){
      const angle=leaf*2.39996,ca=Math.cos(angle),sa=Math.sin(angle),base=V.length/3;
      const tall=height*(.6+.4*(.5+.5*Math.sin(leaf*3.1+species)));
      for(let j=0;j<=steps;j++){
        const t=j/steps,spread=width*(.08+Math.pow(t,1.5)*.78);
        const curl=Math.sin(t*5+leaf)*width*.13*t;
        const half=Math.pow(Math.sin(Math.PI*t),.8)*width*(species===0?.11:.16)+1;
        for(const side of [-1,1]){
          V.push(ca*spread-sa*(curl+side*half),b[1]+t*tall,sa*spread+ca*(curl+side*half));
          N.push(sa*.85,.53,-ca*.85);
        }
      }
      for(let j=0;j<steps;j++){
        const a=base+j*2,bb=a+1,c=a+2,d=a+3,v0=j/steps*255,v1=(j+1)/steps*255;
        for(const ids of [[a,c,bb,0,v0,0,v1,255,v0],[bb,c,d,255,v0,0,v1,255,v1]]){
          const t={a:ids[0],b:ids[1],c:ids[2],ua:ids[3],va:ids[4],ub:ids[5],vb:ids[6],uc:ids[7],vc:ids[8],blend:0};
          tris.push(t,{...t,b:t.c,c:t.b,ub:t.uc,vb:t.vc,uc:t.ub,vc:t.vb});
        }
      }
    }
    const model=bounds({V:new Float32Array(V),N:new Float32Array(N),tris,texture:tileTexture(6,palette[species]),material:profiles.kelp,name});
    if(!low){model.lod=kelp(source,species,name,true);model.lod.texture=model.texture;}
    return model;
  }
  function deformation(model,phase,still) {
    if(still)return null;
    const n=model.name||'',b=model.bbox;
    let mode=1,strength=.045;
    if(n.startsWith('alga')){mode=2;strength=.05;}
    else if(n==='jellyfish'){mode=3;strength=.045;}
    else if(n==='manta'||n.startsWith('turtle')){mode=4;strength=.05;}
    else if(n.startsWith('whale')){mode=5;strength=.045;}
    else if(n==='nautilus')return null;
    return {mode,phase,strength,lo:b[2],span:Math.max(1,b[5]-b[2]),bottom:b[1],height:Math.max(1,b[4]-b[1]),width:Math.max(Math.abs(b[0]),Math.abs(b[3]),1)};
  }
  function makeTerrain() {
    const V=[],N=[],tris=[],size=24,step=12000;
    const height=(x,z)=>-102000+Math.sin(x*.71)*Math.cos(z*.53)*3500+Math.sin(z*1.31+x*.22)*1500;
    for(let z=0;z<=size;z++)for(let x=0;x<=size;x++){
      const X=(x-size/2)*step,Z=(z-size/2)*step;
      // Entire seabed stays below the navigable sector sphere (radius 900m).
      const y=height(x,z),nx=-(height(x+1,z)-height(x-1,z))/(2*step),nz=-(height(x,z+1)-height(x,z-1))/(2*step),len=Math.hypot(nx,1,nz);
      V.push(X,y,Z); N.push(nx/len,1/len,nz/len);
    }
    for(let z=0;z<size;z++)for(let x=0;x<size;x++){
      const a=z*(size+1)+x,b=a+1,c=a+size+1,d=c+1;
      tris.push({a,b:c,c:b,ua:0,va:0,ub:0,vb:255,uc:255,vc:0,blend:0});
      tris.push({a:b,b:c,c:d,ua:255,va:0,ub:0,vb:255,uc:255,vc:255,blend:0});
    }
    const tex=tileTexture(7);
    return bounds({V:new Float32Array(V),N:new Float32Array(N),tris,texture:tex,material:profiles.rock});
  }
  function drawEnvironment(time) {
    if(terrain)Gfx.drawModel(terrain,0,0,0,null,1,terrain.texture,{ambient:.52,time});
  }
  return {PATH,MAPS,load,prepare,profile,deformation,combine,refine,drawEnvironment,profiles,compiled};
})();
