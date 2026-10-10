/* Connected pressure-hull station, in world units (100 units = one metre).
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
    const mesh=MeshKit.create(low?10:20);
    const {face,lathe,box,rib}=mesh;
    const sides=low?10:20;
    const origin = [0,0,0];
    // Central command tower and lower ballast chamber.
    lathe(origin,'y',[[-2700,0],[-2550,1250],[-2100,2000],[2400,2000],[2850,1810],[3220,1350],[3450,0]],0);
    for (const y of [-2100,-800,650,2400]) rib(origin,'y',y,2070,130);
    lathe(origin,'y',[[650,2030],[1350,2030]],6);
    // Individual bridge glazing is fitted to the curved hull, not a billboard.
    for (let i=0;i<sides;i++) {
      const a=(i+.16)/sides*TAU,b=(i+.84)/sides*TAU,r=2020;
      const p=[[a,1610],[b,1610],[b,2110],[a,2110]].map(([t,y])=>[Math.cos(t)*r,y,Math.sin(t)*r]);
      const n=[a,b,b,a].map(t=>[Math.cos(t),0,Math.sin(t)]);
      face(p,n,3);
    }
    // Twin habitation vessels, joined by sealed cross-corridors.
    for (const side of [-1,1]) {
      const x=side*4900, c=[x,0,700];
      lathe([side*3100,0,700],'x',[[-1900,540],[1900,540]],1);
      lathe(c,'z',[[-3050,0],[-2900,850],[-2470,1280],[2100,1280],[2500,850],[2670,0]],0);
      for(const z of [-2400,-900,900,2050])rib(c,'z',z,1350,140);
      lathe(c,'z',[[-1550,1290],[-1080,1290]],6);
      // End-cap observation port and its pressure collar, facing approach.
      lathe(c,'z',[[-3020,0],[-3020,490]],3);
      rib(c,'z',-3010,570,140);
      box([x,720,-2080],[240,80,50],4);
      // Ballast tanks and short landing/support feet.
      lathe([x,-1800,700],'z',[[-1900,0],[-1650,440],[1500,440],[1750,0]],1);
      for(const z of [-750,2200]) {
        box([x,-1470,z],[300,900,380],1);
        box([x,-2430,z],[300,1300,380],1);
        box([x,-3050,z],[1250,180,850],1);
      }
    }
    // Recessed docking throat opens toward the normal approach (-Z).
    const bay=[0,-650,0];
    lathe(bay,'z',[[-6200,1910],[-5600,1980],[-1750,1980]],0);
    lathe(bay,'z',[[-6220,1620],[-2800,1620]],1,true,true);
    lathe(bay,'z',[[-6230,1620],[-6230,1910]],2,false);
    lathe(bay,'z',[[-2790,0],[-2790,1620]],5);
    for(const z of [-5680,-4350])rib(bay,'z',z,2040,140);
    box([0,-2070,-4490],[2200,150,3400],1);
    for(const x of [-1310,1310]) {
      box([x,-420,-6260],[95,1050,70],4);
      for(const z of [-5900,-4900,-3900])box([x,-1940,z],[85,60,360],4);
    }
    box([0,1130,-6080],[2200,260,340],6);
    box([0,1130,-6260],[500,75,40],4);
    // Rear machinery pod and a compact sonar mast, with attached navigation lamps.
    lathe([0,-650,3600],'z',[[-1850,1450],[700,1450],[1100,900],[1200,0]],1);
    for(const x of [-700,700])box([x,-600,4780],[600,950,100],6);
    lathe(origin,'y',[[3370,260],[4200,260],[4430,100]],1);
    box([0,4390,0],[1100,160,220],0);
    box([0,4550,0],[100,160,100],7);

    // Four working station types, each with three technology tiers.
    if(family===1){
      // Research observatory: sealed sensor domes and a broad sonar array.
      lathe([0,4650,0],'y',[[0,160],[120,800],[350,1100],[500,800],[550,0]],6);
      for(const x of [-2900,2900]){
        lathe([x,600,2200],'y',[[-500,0],[-400,720],[600,720],[1000,500],[1150,0]],3);
        box([x,0,1500],[250,300,2200],1);
      }
    }else if(family===2){
      // Industrial refinery: connected pressure tanks, pipework and service gantry.
      for(const x of [-3000,3000]){
        lathe([x,0,3650],'y',[[-2200,0],[-2050,500],[-1700,760],[2000,760],[2350,480],[2500,0]],0);
        for(const y of [-1300,300,1850])rib([x,0,3650],'y',y,800,130,6);
        box([x*.65,-500,3650],[2400,240,320],1);
      }
      box([0,3750,3000],[6500,260,350],2);
      for(const x of [-3000,3000])box([x,2450,3000],[280,2600,350],1);
    }else if(family===3){
      // Fortified port: armour skirts and attached defensive turrets.
      for(const side of [-1,1]){
        box([side*5300,500,700],[1300,1600,3650],1);
        box([side*5350,1320,700],[1400,130,3750],6);
        box([side*3100,1100,700],[650,1800,650],1);
        lathe([side*3100,2050,700],'y',[[0,750],[500,750],[750,350]],0);
        for(const dx of [-220,220])lathe([side*3100+dx,2500,0],'z',[[-1700,110],[1400,110]],1);
      }
    }
    if(tier===2)for(const x of [-1500,1500]){
      box([x,3200,1000],[170,2400,170],1);
      box([x,4350,1000],[450,120,350],6);
    }
    const size=[.86,1,1.10][tier];mesh.transform(0,[0,0,0],[size,size,size]);
    const model=mesh.finish(key(rebel,{family,tier}),skin);
    model.family=family;model.tier=tier;
    if(!low){model.lod=build(metal,rebel,true,family,tier,skin);}
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
  return {build,key,texture,prepare,appearance};
})();
