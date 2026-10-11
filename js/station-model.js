/* Angular industrial station complex, in world units (100 units = one metre).
   Flight and the dock console use this same mesh at scale 1. */
'use strict';
const StationModel = (() => {
  const TAU = Math.PI * 2;
  let materialTemplate=null;

  function texture(metal, rebel, hull, accent) {
    const w=1024,h=512,S=256,data=new Uint8ClampedArray(w*h*4);
    const colours=[hull||[164,181,180],[46,60,65],[211,166,61],[25,69,83],
      [128,225,242],[10,20,25],accent||(rebel?[151,92,61]:[67,116,135]),[238,96,59]];
    if(materialTemplate?.source===metal){
      // Only tint varies between fleets/factions. Reuse the relief map and
      // panel pattern instead of rebuilding them for every colour scheme.
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        const i=y*w+x,p=i*4,cell=Math.floor(y/S)*4+Math.floor(x/S),shade=materialTemplate.shades[i];
        for(let k=0;k<3;k++)data[p+k]=colours[cell][k]*shade;
        data[p+3]=255;
      }
      return {w,h,data,industrial:true,surface:materialTemplate.surface};
    }
    const height=new Float32Array(w*h),shades=new Float32Array(w*h),surface=new Uint8ClampedArray(w*h*4);
    const hash=(x,y)=>{let q=Math.imul(x+71,374761393)^Math.imul(y+29,668265263);q=Math.imul(q^(q>>>13),1274126177);return (q>>>0)/4294967295;};
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const cell=Math.floor(y/S)*4+Math.floor(x/S),u=x%S,v=y%S,i=y*w+x,p=i*4;
      const grain=metal.data[((v%metal.h)*metal.w+u%metal.w)*4]/255;
      const solid=cell===0||cell===1||cell===6;
      let shade=.8+grain*.24,relief=.5,rough=.56,metallic=.65;
      if(solid){
        // Interlocking armour panels, dark service recesses, corner fasteners,
        // edge wear and rain-like corrosion. Detail is authored at 2x density.
        const row=Math.floor(v/64),col=Math.floor((u+(row%2)*32)/96);
        const px=(u+(row%2)*32)%96,py=v%64;
        shade*=.73+hash(col+cell*7,row)*.34;
        const seam=Math.min(px,95-px,py,63-py);
        if(seam<2){shade*=.22;relief=.13;rough=.87;}
        else if(seam<4){shade*=1.34;relief=.72;rough=.32;}
        if(px>7&&px<89&&py>10&&py<18){shade*=.37;relief=.25;}
        const screw=Math.min(Math.hypot(px-7,py-7),Math.hypot(px-88,py-55));
        if(screw<2.4){shade*=screw<1.1?.22:1.45;relief=screw<1.1?.15:.68;}
        if(cell===1){
          if(u%32>4&&u%32<28&&v%12>3&&v%12<9){shade*=.25;relief=.15;}
          rough=.74;metallic=.8;
        }
        if(hash(u>>2,row+cell)> .93 && py>20){shade*=.76;rough=.85;}
        if(v>220)shade*=.9;
        relief+=(grain-.5)*.025;
      }else if(cell===2){
        shade=((u+v)%64<29)?.16:1;relief=.45;rough=.75;metallic=.15;
      }else if(cell===3){
        const frame=u%64<5||v%64<5;
        shade=frame?.22:.66+(1-v/256)*.76;relief=frame?.3:.5;rough=.12;metallic=.25;
      }else if(cell===4||cell===7){
        shade=.72+.28*Math.sin(Math.PI*u/256);rough=.24;metallic=.05;
        if(v%32<3)shade*=.6;
      }else{shade=.65+grain*.25;rough=.95;metallic=.1;relief=.3;}
      for(let k=0;k<3;k++)data[p+k]=colours[cell][k]*shade;
      data[p+3]=255;height[i]=relief;shades[i]=shade;surface[p+2]=rough*255;surface[p+3]=metallic*255;
    }
    // Tangent-space normals and roughness/metalness share one extra texture.
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const i=y*w+x,p=i*4,left=x%S===0?i:i-1,right=x%S===S-1?i:i+1;
      const top=y%S===0?i:i-w,bottom=y%S===S-1?i:i+w;
      const nx=(height[left]-height[right])*1.4,ny=(height[top]-height[bottom])*1.4;
      const length=Math.hypot(nx,ny,1);
      surface[p]=(nx/length*.5+.5)*255;surface[p+1]=(ny/length*.5+.5)*255;
    }
    materialTemplate={source:metal,shades,surface:{w,h,data:surface}};
    return {w,h,data,industrial:true,surface:materialTemplate.surface};
  }

  function build(metal, rebel = false, low = false, family = 0, tier = 1, skin = texture(metal,rebel)) {
    const m=MeshKit.create(low?8:20,low?Infinity:1800), {box,beam,hull,lathe,rib}=m;
    const size=[.88,1,1.13][tier];
    // Separate working modules around a tall core. The reference stations
    // read as joined machinery, not a monolithic pyramid or a smooth disc.
    hull([0,0,0],[[-3500,3400,3600],[2800,3400,3600],[4000,2700,2800]],0);
    for(const y of [-3300,-1500,500,2500]){
      box([0,y,-3550],[6400,180,220],1);
      for(const side of [-1,1])box([side*3410,y,-300],[180,180,5400],1);
    }
    // Stacked command decks with a bridge offset toward the docking entrance.
    hull([0,0,300],[[3520,3000,2500],[4050,3000,2500],[4300,2400,2050]],0,.12,'y');
    hull([0,0,-180],[[4300,2200,1550],[5150,2200,1550],[5400,1750,1250]],1,.12,'y');
    box([0,5500,-580],[3900,240,3000],0);
    box([0,5840,-1100],[3400,500,1250],3);
    box([0,6200,-850],[3950,180,1950],0);
    hull([300,0,500],[[5400,1000,750],[6900,1000,750]],6,.12,'y');
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
    m.transform(0,[0,0,0],[.76,1,1]);
    for(const side of [-1,1]){
      const x=side*7600;
      // A narrow pressure corridor inside a genuinely open cross-braced bridge.
      box([side*4350,600,1500],[3500,380,540],0);
      for(const y of [0,1300])for(const z of [800,2200]){
        beam([side*2600,y,z],[side*6100,y,z],130,1);
        for(let i=0;i<4;i++)beam([side*(2600+i*875),0,z],[side*(3475+i*875),1300,z],95,6);
      }
      for(const xx of [2650,3475,4350,5225,6050])for(const z of [800,2200])beam([side*xx,0,z],[side*xx,1300,z],100,1);
      hull([x,-600,600],[[-5900,2400,2700],[4100,2400,2700],[5100,1700,2100]],0);
      for(const z of [-4000,-1400,1200,3800]){
        box([x,2210,z],[5000,200,260],1);
        for(const dx of [-2410,2410])box([x+dx,-600,z],[180,5700,260],1);
      }
      // Side galleries give the bays a readable human scale: walkways,
      // stanchions, exposed conduits, vent banks and separately mounted tanks.
      for(const dx of [-1,1]){
        const outer=x+dx*2480;
        box([outer,250,-300],[340,120,8700],1);
        for(const y of [500,950])beam([outer+dx*200,y,-4400],[outer+dx*200,y,3900],45,6);
        for(const z of [-4300,-2300,-300,1700,3700]){
          beam([outer+dx*200,250,z],[outer+dx*200,1000,z],55,0);
          box([outer+dx*30,-900,z],[140,850,1100],1);
        }
        if(!low){
          for(const y of [-2300,-2050]){
            lathe([outer+dx*130,y,0],'z',[[-4500,100],[3900,100]],6);
            for(const z of [-4100,-1800,500,2800])rib([outer+dx*130,y,0],'z',z,135,75,1);
          }
          for(const z of [-2600,1900]){
            lathe([outer+dx*80,-700,z],'y',[[-1000,0],[-850,280],[650,280],[800,0]],0);
            rib([outer+dx*80,-700,z],'y',-500,300,90,6);
            rib([outer+dx*80,-700,z],'y',350,300,90,6);
          }
        }
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
    if(!low)for(const side of [-1,1]){
      for(const y of [-2400,400,2800]){
        box([side*2650,y,250],[160,180,5350],1);
        for(const z of [-1800,-600,600,1800])box([side*2750,y+240,z],[160,210,550],6);
      }
      for(const z of [-2200,1700]){
        lathe([side*2780,0,z],'y',[[-3100,125],[3600,125]],6);
        for(const y of [-2200,-400,1500,3100])rib([side*2780,0,z],'y',y,165,100,1);
      }
    }
    if(tier===2)for(const x of [-2200,2200]){
      box([x,5900,1500],[180,3000,180],1);box([x,7440,1500],[650,140,650],6);
    }
    m.transform(0,[0,0,0],[size,size,size]);
    const model=m.finish(key(rebel,{family,tier}),skin,{specular:.24,gloss:48});
    // Collision is a compound hull, so ships can fly through gaps between wings.
    model.collision=[[-2950,-3600,-3500,2950,6900,4100],
      [-10600,-5300,-5450,-4740,3700,5800],[4740,-5300,-5450,10600,3700,5800],
      [-3550,100,-8000,3550,1300,-3300],[-3550,-3600,-8000,3550,-3225,-3300],
      [-3550,-3225,-8000,-2925,100,-3300],[2925,-3225,-8000,3550,100,-3300],
      [-3300,-3000,3500,3300,900,7000],[-6100,0,800,-2600,1300,2200],
      [2600,0,800,6100,1300,2200]].map(b=>b.map(v=>v*size));
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
    const civilSkin=texture(metal,false),rebelSkin=texture(metal,true);
    for(let family=0;family<4;family++)for(let tier=0;tier<3;tier++){
      const civil=build(metal,false,false,family,tier,civilSkin);
      const rebelName=key(true,{family,tier});
      models[civil.name]=civil;
      // Geometry and collision bounds are immutable after authoring. Factions
      // need distinct skins/names, but can share every high- and low-detail array.
      models[rebelName]={...civil,name:rebelName,texture:rebelSkin,
        lod:{...civil.lod,name:rebelName,texture:rebelSkin}};
    }
    for(const rebel of [false,true])models[key(rebel)]=models[key(rebel,{family:0,tier:1})];
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
