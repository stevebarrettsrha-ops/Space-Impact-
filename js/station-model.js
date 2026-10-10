/* Angular industrial station complex, in world units (100 units = one metre).
   Flight and the dock console use this same mesh at scale 1. */
'use strict';
const StationModel = (() => {
  const TAU = Math.PI * 2;

  function texture(metal, rebel, hull, accent) {
    const w = 512, h = 256, data = new Uint8ClampedArray(w * h * 4);
    const colours = [hull || [155,178,180], [52,72,78], [192,153,66], [25,75,94],
      [139,225,231], [12,24,30], accent || (rebel ? [154,93,60] : [54,117,139]), [214,77,49]];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const cell = (y >> 7) * 4 + (x >> 7), u = x & 127, v = y & 127;
      const p = ((v * 2 * metal.w) + u * 2) * 4;
      const grain = (metal.data[p] + metal.data[p + 1] + metal.data[p + 2]) / 765;
      let shade = cell === 4 || cell === 7 ? 1 : .74 + grain * .4;
      // Recessed panel seams and sparse fasteners, without painted-on windows.
      if ((cell === 0 || cell === 1 || cell === 6) && (u < 2 || v < 2)) shade *= .55;
      if ((cell === 0 || cell === 6) && ((u - 7) ** 2 + (v - 7) ** 2 < 5)) shade *= .45;
      if (cell === 2 && ((u + v) % 48 < 20)) shade *= .24;
      for (let k = 0; k < 3; k++) data[(y * w + x) * 4 + k] = colours[cell][k] * shade;
      data[(y * w + x) * 4 + 3] = 255;
    }
    return {w, h, data};
  }

  function build(metal, rebel = false, low = false, family = 0, tier = 1, skin = texture(metal,rebel)) {
    const m=MeshKit.create(low?8:20), {box,hull,lathe,rib}=m;
    const size=[.88,1,1.13][tier];
    // An angular deep-water city: four inhabited decks above an open docking
    // cavern, a pyramidal command crown, and massive separate service wings.
    hull([0,0,0],[[-3500,3400,3600],[2800,3400,3600],[4000,2700,2800]],0);
    for(const y of [-3300,-1500,500,2500]){
      box([0,y,-3550],[6400,180,220],1);
      for(const side of [-1,1])box([side*3410,y,-300],[180,180,5400],1);
    }
    // A steep pyramidal command crown restores the original station language.
    hull([0,0,0],[[3520,3500,3100],[5300,2050,1650]],0,.14,'y');
    hull([0,0,0],[[5310,2050,1650],[5700,2050,1650]],3,.14,'y');
    hull([0,0,0],[[5740,2250,1850],[6900,900,700]],0,.14,'y');
    box([0,7060,0],[2000,250,1600],1);
    box([0,7350,250],[1000,500,800],6);
    box([0,8200,250],[180,3000,180],1);
    box([0,9300,250],[2300,160,320],0);
    box([0,9750,250],[160,140,160],7);
    // Lit windows in individual recesses, not a wrapped band on a cylinder.
    for(const side of [-1,1])for(const y of [-700,1300,3000])for(const z of [-2000,-650,700,2050]){
      box([side*3425,y,z],[50,420,880],5);
      box([side*3460,y,z],[40,280,650],3);
      if(!low)box([side*3485,y-160,z],[50,45,720],4);
    }
    for(const side of [-1,1]){
      const x=side*7600;
      // Deep rectangular hangars connected by enclosed bridges and trusses.
      hull([side*4850,600,1500],[[-1000,2300,650],[1000,2300,650]],1);
      hull([x,-600,600],[[-5900,2400,2700],[4100,2400,2700],[5100,1700,2100]],0);
      for(const z of [-4000,-1400,1200,3800]){
        box([x,2210,z],[5000,200,260],1);
        for(const dx of [-2410,2410])box([x+dx,-600,z],[180,5700,260],1);
      }
      // Recessed end doors, armour frames and overhead work lights.
      box([x,-500,-5340],[3800,3800,130],5);
      box([x,-500,-5430],[3200,3200,120],6);
      for(const dx of [-1740,1740])box([x+dx,-500,-5500],[160,3600,160],2);
      box([x,1450,-5500],[3800,220,300],0);
      for(const dx of [-1250,0,1250])box([x+dx,1250,-5680],[420,80,80],4);
      // Heavy foundations and under-slung life-support pressure vessels.
      for(const z of [-2600,2600]){
        box([x,-4100,z],[1200,2000,1300],1);
        box([x,-5160,z],[2900,200,2400],0);
      }
      lathe([x,-3650,300],'z',[[-3500,0],[-3250,600],[3300,600],[3550,0]],1);
      for(const z of [-2700,0,2700])rib([x,-3650,300],'z',z,640,140,6);
      if(!low)for(let i=0;i<5;i++)box([x,-1000+i*570,-5510],[3000,45,35],1);
    }
    // Central rectangular entrance: solid roof, side jambs and a deep floor.
    // The aperture remains physically open, with runway strips inside it.
    box([0,600,-5650],[7100,1000,4700],0);
    for(const x of [-3250,3250])box([x,-1500,-5650],[650,3600,4700],0);
    box([0,-3400,-5650],[7100,350,4700],1);
    box([0,-1400,-3370],[5800,3000,100],5);
    box([0,1210,-7900],[7000,280,430],6);
    for(const x of [-2830,2830]){
      box([x,-1500,-8030],[90,2900,90],4);
      for(const z of [-7400,-6300,-5200,-4100])box([x,-3190,z],[110,60,420],4);
    }
    // Rear power stacks and dockside equipment give the silhouette depth.
    for(const x of [-2200,2200]){
      hull([x,-1000,5000],[[-1400,950,1700],[1900,950,1700]],1);
      for(const y of [-1800,-600,600])box([x,y,6930],[1450,280,120],6);
    }
    if(family===1){
      // Science port: tall asymmetric instrument gantries and faceted radomes.
      for(const x of [-7600,7600]){
        box([x,3450,600],[300,2300,300],1);
        hull([x,4580,600],[[-950,1400,650],[950,1400,650]],3);
        box([x,5330,600],[3200,150,2300],0);
      }
    }else if(family===2){
      // Refinery: service towers, lifting beams and grouped pressure tanks.
      for(const side of [-1,1]){
        box([side*7900,3900,2200],[440,3200,440],2);
        box([side*6400,5520,2200],[3500,350,440],2);
        for(const z of [-1000,1700]){
          lathe([side*7500,3200,z],'x',[[-1650,500],[1650,500]],1);
          for(const x of [-1300,1300])rib([side*7500,3200,z],'x',x,550,100,6);
        }
      }
    }else if(family===3){
      // Naval base: bulky angular armoured bastions with separate barrels.
      for(const side of [-1,1]){
        hull([side*7600,2900,1000],[[-2100,1800,800],[1600,1800,800]],1);
        box([side*7600,3780,600],[3800,160,3300],6);
        for(const dx of [-450,450])lathe([side*7600+dx,3400,-1800],'z',[[-1800,150],[1600,150]],1);
      }
    }
    if(!low)for(const side of [-1,1])for(const z of [-2800,500,3000]){
      box([side*7600,2420,z],[1500,180,800],6);
      for(let i=0;i<5;i++)box([side*7600-500+i*250,2530,z],[80,70,680],1);
    }
    if(tier===2)for(const x of [-2200,2200]){
      box([x,5900,1500],[180,3000,180],1);box([x,7440,1500],[650,140,650],6);
    }
    m.transform(0,[0,0,0],[size,size,size]);
    const model=m.finish(key(rebel,{family,tier}),skin,{specular:.24,gloss:48});
    // Collision is a compound hull, so ships can fly through gaps between wings.
    model.collision=[[-3500,-3600,-3500,3500,6900,4100],
      [-10100,-5300,-5450,-5100,3700,5800],[5100,-5300,-5450,10100,3700,5800],
      [-3550,100,-8000,3550,1300,-3300],[-3550,-3600,-8000,3550,-3225,-3300],
      [-3550,-3225,-8000,-2925,100,-3300],[2925,-3225,-8000,3550,100,-3300],
      [-3300,-3000,3500,3300,900,7000]].map(b=>b.map(v=>v*size));
    model.family=family;model.tier=tier;
    if(!low)model.lod=build(metal,rebel,true,family,tier,skin);
    return model;
  }
  function appearance(st){return {family:st.id%4,tier:st.tech<=3?0:st.tech<=7?1:2};}
  function key(rebel,station){
    const base=rebel?'station_rebel':'station_civil';
    if(!station)return base;
    const a=station.family===undefined?appearance(station):station;
    return base+'_'+a.family+'_'+a.tier;
  }
  function prepare(models,metal){
    for(const rebel of [false,true]){
      const skin=texture(metal,rebel);
      for(let family=0;family<4;family++)for(let tier=0;tier<3;tier++){
        models[key(rebel,{family,tier})]=build(metal,rebel,false,family,tier,skin);
      }
      models[key(rebel)]=models[key(rebel,{family:0,tier:1})];
    }
  }
  function contact(model,x,y,z,radius) {
    let result=null;
    for(const b of model?.collision||[]){
      const p=[x,y,z],q=p.map((v,k)=>Math.max(b[k],Math.min(b[k+3],v)));
      let delta=p.map((v,k)=>v-q[k]),distance=Math.hypot(...delta),penetration=radius-distance;
      if(distance<1e-6){
        let nearest=Infinity,axis=0,sign=1;
        for(let k=0;k<3;k++)for(const s of [-1,1]){
          const gap=s<0?p[k]-b[k]:b[k+3]-p[k];
          if(gap<nearest){nearest=gap;axis=k;sign=s;}
        }
        delta=[0,0,0];delta[axis]=sign;distance=1;penetration=radius+nearest;
      }
      if(penetration>0&&(!result||penetration>result.penetration))result={normal:delta.map(v=>v/distance),penetration};
    }
    return result;
  }
  return {build,key,texture,prepare,appearance,contact};
})();
