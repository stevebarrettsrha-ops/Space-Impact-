/* Solid manufactured assets. Built once, with low-detail meshes and shared
   material atlases. Names stay compatible with missions and saved ship IDs. */
'use strict';
const WorldAssets = (() => {
  const SHIPS = [
    {length:2800,radius:390,beam:760,colour:[151,161,152],accent:[198,142,58],role:'utility'},
    {length:3200,radius:470,beam:860,colour:[111,149,143],accent:[198,173,93],role:'fishing'},
    {length:3300,radius:350,beam:1020,colour:[88,100,106],accent:[166,68,49],role:'raider'},
    {length:3100,radius:320,beam:650,colour:[55,72,84],accent:[82,153,169],role:'interceptor'},
    {length:3650,radius:600,beam:800,colour:[160,164,152],accent:[179,103,50],role:'hauler'},
    {length:3400,radius:300,beam:1150,colour:[173,181,174],accent:[63,143,155],role:'agile'},
    {length:4900,radius:630,beam:1350,colour:[130,144,147],accent:[190,144,58],role:'freighter'},
    {length:3500,radius:420,beam:920,colour:[100,129,150],accent:[169,188,189],role:'patrol'},
    {length:3800,radius:440,beam:1220,colour:[153,164,170],accent:[91,117,163],role:'catamaran'},
    {length:4600,radius:570,beam:1180,colour:[90,110,130],accent:[154,179,185],role:'command'},
    {length:3900,radius:450,beam:1020,colour:[194,197,179],accent:[172,142,73],role:'luxury'}
  ];
  let metal, atlases=new Map();
  function atlas(name,colour,accent){
    if(!atlases.has(name))atlases.set(name,StationModel.texture(metal,false,colour,accent));
    return atlases.get(name);
  }
  function vessel(m,c,length,r,cell=0,flat=1){
    const start=m.cursor;
    m.lathe([0,0,0],'z',[[-.52*length,0],[-.50*length,r*.38],[-.44*length,r*.72],[-.31*length,r*.96],
      [.26*length,r],[.39*length,r*.88],[.47*length,r*.6],[.51*length,r*.25],[.52*length,0]],cell);
    m.transform(start,c,[1,flat,1]);
  }
  function thruster(m,x,y,z,r){
    // Duct, inner wall, recessed hub and four physical impeller blades.
    m.lathe([x,y,z],'z',[[-r*.6,r*.82],[-r*.4,r],[r*.8,r*.9]],1);
    m.lathe([x,y,z],'z',[[-r*.61,r*.66],[-r*.61,r*.82]],0,false);
    m.lathe([x,y,z],'z',[[-r*.59,r*.66],[r*.3,r*.66]],1,true,true);
    vessel(m,[x,y,z],r*.5,r*.20,6);
    for(let i=0;i<4;i++){
      const start=m.cursor;m.box([r*.38,0,0],[r*.62,r*.14,r*.12],0);
      m.transform(start,[x,y,z-r*.12],[1,1,1],0,i*Math.PI/2+.3);
    }
  }
  function ship(id,low=false){
    const p=SHIPS[id],m=MeshKit.create(low?8:16,low?Infinity:700),L=p.length,R=p.radius,B=p.beam;
    const cargo=['hauler','freighter','command'].includes(p.role),twin=['catamaran','freighter'].includes(p.role);
    m.hull([0,0,0],[[-L*.50,R*.48,R*.48],[-L*.30,R,R*.85],[L*.24,R,R*.70],
      [L*.43,R*.60,R*.43],[L*.52,R*.15,R*.15]],0,.24);
    for(const z of [-L*.23,0,L*.22])m.box([0,R*.76,z],[R*1.6,45,L*.09],1);
    const wing=p.role==='interceptor'?.35:.55;
    for(const side of [-1,1]){
      m.prism([[side*R*.55,L*.16],[side*B,-L*wing],[side*B*.85,-L*.58],[side*R*.4,-L*.23]],160,6);
      m.box([side*B*.84,8,-L*.48],[65,45,130],side===1?4:7);
      if(twin)vessel(m,[side*B*.72,-R*.13,-L*.1],L*.83,R*.48,0);
      // Outboard pods keep the original twin-engine silhouette readable.
      vessel(m,[side*B*.72,-R*.12,-L*.31],L*.39,R*.39,1);
      thruster(m,side*B*.72,-R*.12,-L*.51,R*.36);
      if(cargo){
        for(let z=-1;z<=1;z++){
          m.box([side*R*.87,0,z*L*.18],[R*.72,R*1.25,L*.165],z===0?6:0);
          m.box([side*R*.88,R*.67,z*L*.18],[R*.79,45,L*.17],1);
        }
      }else if(p.role==='raider'||p.role==='patrol'||p.role==='command'){
        vessel(m,[side*R*.95,-R*.13,L*.11],L*.53,95,1);
      }
    }
    // Raised cabin, separate forward glazing and a low sonar sail.
    m.hull([0,R*.70,L*.08],[[-L*.2,R*.60,R*.32],[L*.07,R*.60,R*.36],[L*.20,R*.38,R*.16]],6,.18);
    if(!low)for(const side of [-1,1]){
      m.hull([side*R*.81,-R*.12,-L*.04],[[-L*.24,R*.30,R*.46],[L*.24,R*.30,R*.38]],0);
      for(let i=0;i<5;i++)m.box([side*R*1.13,R*.05,-L*.23+i*L*.065],[35,R*.40,L*.026],1);
      // Exposed coolant loops, armoured hatches and bolted wing roots.
      m.beam([side*R*.62,R*.87,-L*.26],[side*R*.62,R*.87,L*.16],40,1);
      for(const z of [-L*.20,0,L*.18]){
        m.box([side*R*.42,R*.83,z],[R*.45,45,L*.09],6);
        m.box([side*B*.57,105,z-L*.16],[140,75,90],0);
      }
      for(let i=0;i<4;i++)m.box([side*B*.72,R*.30,-L*.38+i*L*.045],[R*.43,45,L*.018],6);
    }
    const glass=m.cursor;
    m.lathe([0,0,0],'z',[[0,R*.49],[R*.16,R*.43],[R*.33,0]],3);
    m.transform(glass,[0,R*.76,L*.27],[1,.64,1]);
    m.box([0,R*.92,-L*.10],[R*.31,R*.75,L*.20],1);
    m.box([0,R*1.4,-L*.17],[55,R*.36,65],0);
    for(const side of [-1,1]){
      vessel(m,[side*R*.65,-R*.20,L*.36],R*.7,65,4);
      if(p.role==='fishing'||p.role==='utility'){
        m.box([side*R*.92,-R*.56,L*.13],[100,90,L*.55],1);
        m.box([side*R*.92,-R*.57,L*.42],[200,170,160],6);
      }
    }
    // Portholes and maintenance plates are attached to the hull.
    if(!low)for(const side of [-1,1])for(let i=0;i<3;i++){
      const start=m.cursor;m.lathe([0,0,0],'z',[[0,0],[0,75]],3);
      m.transform(start,[side*R*.98,0,(i-1)*L*.13],[1,1,1],side*Math.PI/2);
    }
    if(p.role==='luxury')vessel(m,[0,R*.56,-L*.2],L*.18,R*.66,3,.56);
    const model=m.finish('u'+id,atlas('ship'+id,p.colour,p.accent));
    model.role=p.role;model.wake={x:B*.72,y:-R*.12,z:-L*.59,r:R*.30};
    if(!low){model.lod=ship(id,true);model.lod.texture=model.texture;}
    return model;
  }
  function prop(name,low=false){
    const m=MeshKit.create(low?8:16),c=[0,0,0];
    let tex=atlas('hardware',[135,152,153],[187,138,58]);
    if(name==='stream'){
      // Clear, genuinely hollow transit aperture. The frame stays fixed.
      m.lathe(c,'z',[[-500,5000],[-300,5450],[300,5450],[500,5000]],0);
      m.lathe(c,'z',[[-500,5000],[500,5000]],1,true,true);
      for(const z of [-510,510])m.rib(c,'z',z,5420,130,6);
      for(let i=0;i<8;i++){
        const start=m.cursor;m.box([0,5500,0],[650,1000,1250],1);
        m.box([0,5000,-530],[250,220,100],4);
        m.transform(start,c,[1,1,1],0,i*Math.PI/4);
      }
      m.box([0,-5900,0],[3400,950,1900],1);
      m.box([0,-6200,0],[5100,250,2400],0);
    }else if(name==='tanker1'){
      vessel(m,c,11300,720,1);
      for(const x of [-650,650]){
        vessel(m,[x,0,0],9600,650,0);
        for(const z of [-3300,-1100,1100,3300])m.rib([x,0,0],'z',z,695,160,6);
        thruster(m,x,-40,-5550,400);
      }
      vessel(m,[0,700,4000],2200,600,6,.7);
      m.box([0,900,5100],[700,230,140],3);
      for(const z of [-3000,0,3000])m.box([0,-600,z],[2400,250,500],1);
    }else if(name==='box'||name.startsWith('goods_')){
      m.box(c,[740,640,900],0);
      for(const x of [-350,350])m.box([x,0,0],[90,730,980],1);
      for(const y of [-310,310])m.box([0,y,0],[800,90,940],6);
      m.box([0,50,-461],[270,220,20],2);
      m.box([0,325,0],[340,20,480],1);
    }else if(name==='kapsel'){
      vessel(m,c,1300,350,0);
      m.rib(c,'z',-220,362,80,6);m.rib(c,'z',260,362,80,6);
      m.box([0,210,450],[260,180,190],3);
      m.box([0,370,-160],[130,60,120],4);
    }else if(name==='mine'){
      m.lathe(c,'y',[[-540,0],[-500,190],[-350,400],[0,490],[350,400],[500,190],[540,0]],1);
      m.rib(c,'y',0,507,90,2);
      for(let i=0;i<6;i++){
        const start=m.cursor;m.box([0,535,0],[65,280,65],0);
        m.box([0,680,0],[80,70,80],7);m.transform(start,c,[1,1,1],i*Math.PI/3,Math.PI/2);
      }
      m.box([0,550,0],[150,110,150],7);
    }else if(name==='torpedo'){
      vessel(m,[0,0,140],370,37,0);m.rib([0,0,140],'z',80,38,34,6);
      for(let i=0;i<4;i++){
        const start=m.cursor;m.box([44,0,-5],[58,8,85],1);m.transform(start,c,[1,1,1],0,i*Math.PI/2);
      }
      thruster(m,0,0,-58,29);
    }else if(name.startsWith('trash')){
      tex=atlas('wreck',[102,101,81],[145,89,51]);
      const variant=Number(name.slice(-1))||0;
      for(const side of [-1,1])m.box([side*320,-100,0],[85,100,850],1);
      m.box([0,-100,-360],[710,100,85],1);
      m.prism([[-360,-300],[80,-350],[330,-120],[180,310],[-270,230]],45,0);
      const start=m.cursor;m.prism([[-200,-260],[110,-290],[260,20],[80,250],[-130,100]],35,6);
      m.transform(start,[80,190,20],[1,1,1],.3+variant*.45,.9);
      if(variant===1)vessel(m,[-290,170,-170],430,170,1);
      if(variant===2)m.box([-170,90,260],[400,330,100],2);
    }else if(name==='pfeil'){
      m.prism([[0,420],[-280,-100],[280,-100]],80,4);
      m.box([0,0,-225],[160,80,280],4);
    }
    const model=m.finish(name,tex);
    if(!low){model.lod=prop(name,true);model.lod.texture=model.texture;}
    return model;
  }
  const PROPS=['tanker1','stream','box','kapsel','mine','torpedo','trash','trash1','trash2','pfeil'];
  function prepare(models,steel){
    metal=steel;atlases.clear();
    SHIPS.forEach((p,i)=>models['u'+i]=ship(i));
    for(const name of PROPS)models[name]=prop(name);
  }
  function drawWake(model,x,y,z,rotation,scale,time,power){
    if(!model.wake||power<.05)return;
    const w=model.wake;
    // Overlapping soft cores form two continuous jets. Bubble rims trail
    // behind them; both begin outside the nozzle and stay behind the hull.
    for(const side of [-1,1])for(let i=0;i<28;i++){
      const t=i/27,pulse=1+Math.sin(time*13-i*.6+side)*.06;
      const p=[side*w.x+Math.sin(i*.8+time*3)*t*25,w.y+t*t*130,w.z-t*(1100+1300*power)];
      const q=[0,1,2].map(k=>(rotation[k*3]*p[0]+rotation[k*3+1]*p[1]+rotation[k*3+2]*p[2])*scale);
      Gfx.point(x+q[0],y+q[1],z+q[2],(w.r*2.5+t*180)*Math.pow(1-t*.98,.45)*scale*power*pulse,
        110+135*(1-t),190+60*(1-t),245,true,false);
      if(i%3===0){
        const drift=Math.sin(i*3.1+time)*t*90;
        Gfx.point(x+q[0]+drift*scale,y+q[1]+t*60*scale,z+q[2],(25+t*35)*scale,151,210,229,true,true);
      }
    }
  }
  function drawBolt(shot){
    const fusion=/laser_[678]$/.test(shot.model),length=(fusion?430:650)*shot.scale;
    for(let i=11;i>=0;i--){
      const t=i/12,q=1-t,trail=length*t;
      Gfx.point(shot.x-shot.dx*trail,shot.y-shot.dy*trail,shot.z-shot.dz*trail,
        (18+q*38)*shot.scale,fusion?245:115+q*120,fusion?95+q*105:190+q*55,fusion?65+q*90:250,true);
    }
  }
  function drawFlash(fx){
    const life=Math.max(0,1-fx.t/14);
    if(life>0){
      Gfx.point(fx.x,fx.y,fx.z,fx.s*(500+fx.t*75)*life,230,170,95,true);
      Gfx.point(fx.x,fx.y,fx.z,fx.s*260*life,245,240,211,true);
    }
  }
  // Authoring-only models for the matching equipment and cargo catalogue.
  function catalogue(models,data){
    for(const e of data.equip){
      const m=MeshKit.create(12),tier=e.id%3,c=[0,0,0],T=e.type;
      if(T===0){
        vessel(m,c,1000+tier*160,150,1);m.box([0,-170,-200],[450,190,650],0);
        for(let i=0;i<3+tier;i++)m.rib(c,'z',-300+i*160,185,70,e.id<6?6:4);
        m.lathe([0,0,600],'z',[[0,0],[0,110]],e.id<6?5:4);
      }else if(T===1){
        vessel(m,c,1600,150,0);m.rib(c,'z',300,160,220,6);
        for(const side of [-1,1])m.box([side*180,0,-520],[220,35,300],1);
      }else if(T===2){
        m.box([0,-180,0],[650,180,500],1);
        m.lathe(c,'x',[[-380,280],[-300,280],[-300,180],[300,180],[300,280],[380,280]],6);
        m.box([0,0,330],[100,100,750],0);m.prism([[0,900],[-160,600],[160,600]],70,0);
      }else if(T===3){
        m.lathe(c,'y',[[-260,450],[-140,450],[0,300],[180,180],[250,0]],0);
        for(let i=0;i<4;i++){
          const a=i*Math.PI/2;m.box([Math.cos(a)*340,70,Math.sin(a)*340],[140,300,140],4);
        }
      }else if(T===4){
        for(let i=0;i<3;i++)m.box([i*60,i*95,i*50],[680,90,850],i===2?6:1);
      }else if(T===5){
        m.box([0,-250,0],[750,150,700],1);m.box([0,350,0],[750,140,700],6);
        for(const x of [-280,280])m.lathe([x,0,0],'y',[[-200,60],[350,60]],0);
        m.box([0,20,0],[500,210,550],0);
      }else if(T===6||T===7){
        for(const x of T===7?[-280,280]:[0]){vessel(m,[x,0,0],750,240,0);thruster(m,x,0,-380,260);}
        m.box([0,180,40],[650,160,400],6);
      }else if(T===8){
        m.box([0,-300,0],[650,140,650],1);
        m.lathe(c,'y',[[-250,100],[0,100],[60,500],[230,560]],0);
        m.lathe(c,'y',[[60,470],[250,530]],3,true,true);m.box([0,210,0],[50,400,50],4);
      }else if(T===9){
        for(const x of [-230,230]){vessel(m,[x,0,0],1000,180,6);m.rib([x,0,0],'z',150,185,100,1);}
        m.box([0,0,-300],[550,230,200],0);
      }else{
        vessel(m,c,600,310,0);m.box([0,250,250],[380,280,220],6);m.box([0,265,365],[260,90,35],4);
        for(const x of [-360,360])m.box([x,-150,80],[100,140,650],1);
      }
      models['equipment_'+e.id]=m.finish('equipment_'+e.id,atlas('equipment'+tier,[150+tier*12,167+tier*6,166],[65+tier*35,135,157]));
    }
    for(let id=18;id<42;id++){
      const m=MeshKit.create(12),c=[0,0,0];
      let skin=atlas('goods',[186,192,174],[88,143,150]);
      const bottle=(x,z,cell=6)=>{
        m.lathe([x,0,z],'y',[[-350,0],[-330,170],[200,170],[270,70],[410,70],[430,0]],cell);
        m.rib([x,0,z],'y',390,78,75,1);
      };
      if(id===18){models.goods_18={...models.creature_8,name:'goods_18'};continue;}
      if([19,25,27,31,35,37].includes(id)){
        bottle(-170,0);bottle(170,140,id===27?0:6);
        if(id===27){m.box([0,0,-150],[650,650,180],0);m.box([0,0,-250],[90,360,30],7);m.box([0,0,-250],[330,90,30],7);}
      }else if([22,24,28,33].includes(id)){
        m.lathe(c,'y',[[-350,0],[-340,330],[330,330],[350,0]],0);
        m.rib(c,'y',-300,340,60,1);m.rib(c,'y',310,340,60,1);m.box([0,0,-337],[380,240,30],6);
      }else if(id===20||id===29){
        for(let i=0;i<4;i++)m.box([i*18,i*75,0],[730,70,850-i*50],i%2?6:0);
      }else if(id===21||id===23||id===26){
        skin=atlas('food',[191,168,132],[174,87,67]);
        m.box([0,-230,0],[850,65,750],0);
        for(const x of [-200,200])vessel(m,[x,-100,0],500,180,id===21?1:6,.65);
        if(id===21)for(const x of [-200,200])m.lathe([x,-100,265],'z',[[0,0],[0,140]],0);
      }else if(id===30||id===41){
        for(const x of [-220,0,220]){vessel(m,[x,0,0],650,100,6);m.rib([x,0,0],'z',170,108,100,4);}
        m.box([0,-150,0],[800,110,720],1);
      }else if(id===32){
        m.box([0,-300,0],[500,80,420],1);m.box([0,0,0],[70,600,70],0);
        m.box([0,300,0],[650,220,200],0);m.box([0,300,-115],[530,130,35],4);
      }else if(id===34){
        m.box(c,[850,70,620],6);
        for(let i=0;i<6;i++)m.box([(i%3-1)*230,75,(Math.floor(i/3)-.5)*300],[160,100,180],1);
      }else if(id===36){
        m.box(c,[800,700,600],0);m.box([0,30,-320],[650,500,50],3);
        for(const x of [-220,0,220])m.box([x,40,-350],[70,350,35],4);
      }else if(id===38){models.goods_38=models.equipment_42;continue;
      }else if(id===39){
        m.box([0,200,0],[75,800,75],1);m.box([0,-250,0],[460,430,65],0);m.box([0,630,0],[360,90,90],6);
      }else if(id===40){
        m.lathe(c,'y',[[-350,280],[-300,280],[-260,0]],1);
        vessel(m,[0,0,0],180,130,6);m.box([0,180,0],[180,280,160],0);
        m.lathe([0,400,0],'y',[[-90,0],[-60,100],[60,100],[90,0]],6);
        for(const x of [-130,130])m.box([x,-90,0],[100,370,100],0);
      }
      models['goods_'+id]=m.finish('goods_'+id,skin,{specular:.10,gloss:18});
    }
  }
  return {prepare,SHIPS,PROPS,drawWake,drawBolt,drawFlash,catalogue};
})();
