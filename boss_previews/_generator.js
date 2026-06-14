const fs = require('fs');
const OUT = '/home/user/Space-Impact-/boss_previews';

/* ---------- SVG helpers ---------- */
const P = (pts, fill, extra='') => `<polygon points="${pts.map(p=>p.join(',')).join(' ')}" fill="${fill}" ${extra}/>`;
const C = (x,y,r,fill,extra='') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${extra}/>`;
const E = (x,y,rx,ry,fill,extra='') => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" ${extra}/>`;
const L = (x1,y1,x2,y2,stroke,w=3) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round"/>`;
const R = (x,y,w,h,fill,extra='') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`;
function star(cx,cy,spikes,outer,inner,fill,rot=0){
  let pts=[]; for(let i=0;i<spikes*2;i++){const r=i%2?inner:outer;const a=rot+i/(spikes*2)*Math.PI*2-Math.PI/2;pts.push([cx+Math.cos(a)*r,cy+Math.sin(a)*r]);}
  return P(pts,fill);
}
function ring(cx,cy,r,n,dotR,fill,rot=0){let s='';for(let i=0;i<n;i++){const a=rot+i/n*Math.PI*2;s+=C(cx+Math.cos(a)*r,cy+Math.sin(a)*r,dotR,fill);}return s;}

/* ---------- 25 boss forms ---------- */
// pal = {main, acc, dark, glow, eye}
const forms = {
  droneCarrier(cx,cy,p){ return E(cx,cy,70,40,p.main)+E(cx,cy,46,26,p.dark)+
    ring(cx,cy,82,6,9,p.acc)+ C(cx-18,cy,10,p.eye)+C(cx+18,cy,10,p.eye)+
    R(cx-66,cy-8,16,16,p.acc)+R(cx+50,cy-8,16,16,p.acc); },
  comet(cx,cy,p){ let s=''; for(let i=0;i<7;i++)s+=E(cx+44+i*18,cy,30-i*3,18-i*2,i%2?p.acc:p.glow,`opacity="${1-i*0.12}"`);
    return s+C(cx,cy,46,p.main)+C(cx-10,cy-8,26,p.glow)+C(cx,cy,20,p.eye); },
  twinOrbs(cx,cy,p){ return L(cx-44,cy,cx+44,cy,p.acc,6)+
    C(cx-50,cy,42,p.main)+C(cx-50,cy,22,p.eye)+ C(cx+50,cy,42,p.main)+C(cx+50,cy,22,p.eye)+
    ring(cx-50,cy,52,8,5,p.acc)+ring(cx+50,cy,52,8,5,p.acc); },
  pulsar(cx,cy,p){ let s=ring(cx,cy,88,3,0,'none'); for(let k of[88,68,48])s+=C(cx,cy,k,k===48?p.main:'none',`stroke="${p.acc}" stroke-width="4" opacity="${k===48?1:0.5}"`);
    return s+C(cx,cy,30,p.glow)+C(cx,cy,14,p.eye); },
  novaStar(cx,cy,p){ return star(cx,cy,12,92,40,p.glow)+star(cx,cy,8,70,30,p.main,0.3)+star(cx,cy,6,40,18,p.acc)+C(cx,cy,16,p.eye); },

  spider(cx,cy,p){ let s=''; for(let i=0;i<4;i++){const yy=cy-30+i*20; s+=L(cx,yy,cx-78,yy-18+i*12,p.dark,5)+L(cx,yy,cx+78,yy-18+i*12,p.dark,5);}
    return s+E(cx,cy,40,52,p.main)+C(cx,cy-44,30,p.main)+C(cx-12,cy-48,8,p.eye)+C(cx+12,cy-48,8,p.eye)+star(cx,cy,4,20,8,p.acc); },
  serpent(cx,cy,p){ let s=''; for(let i=0;i<8;i++){const a=i*0.5;const x=cx-i*22+60;const y=cy+Math.sin(a)*46; s+=C(x,y,30-i*1.6,i%2?p.main:p.dark);}
    const hx=cx+76,hy=cy; return s+E(hx,hy,40,30,p.main)+P([[hx+30,hy-18],[hx+58,hy-6],[hx+30,hy+2]],p.acc)+C(hx+8,hy-8,9,p.eye)+C(hx+8,hy+10,9,p.eye); },
  djinn(cx,cy,p){ let s=''; for(let i=0;i<5;i++)s+=E(cx,cy+40+i*14,46-i*7,14,p.acc,`opacity="${0.7-i*0.12}"`);
    return s+C(cx,cy-10,46,p.main)+P([[cx-46,cy-10],[cx-70,cy-46],[cx-30,cy-30]],p.dark)+P([[cx+46,cy-10],[cx+70,cy-46],[cx+30,cy-30]],p.dark)+
    C(cx-16,cy-16,9,p.eye)+C(cx+16,cy-16,9,p.eye)+star(cx,cy-50,5,22,9,p.glow); },
  mirror(cx,cy,p){ return P([[cx,cy-86],[cx+60,cy-26],[cx+60,cy+40],[cx,cy+86],[cx-60,cy+40],[cx-60,cy-26]],p.main)+
    P([[cx,cy-70],[cx+46,cy-18],[cx+46,cy+30],[cx,cy+70],[cx-46,cy+30],[cx-46,cy-18]],p.glow,'opacity="0.55"')+
    L(cx,cy-70,cx,cy+70,p.acc,3)+C(cx,cy,18,p.eye); },
  iceTitan(cx,cy,p){ let s=R(cx-50,cy-50,100,100,p.main); for(let i=-2;i<=2;i++)s+=P([[cx+i*30,cy-50],[cx+i*30+14,cy-78],[cx+i*30+28,cy-50]],p.glow);
    return s+R(cx-34,cy-30,68,40,p.dark)+C(cx-18,cy-10,10,p.eye)+C(cx+18,cy-10,10,p.eye)+star(cx,cy+40,6,26,11,p.acc); },

  crab(cx,cy,p){ return E(cx,cy,72,50,p.main)+E(cx,cy,52,34,p.dark)+
    P([[cx-72,cy],[cx-110,cy-26],[cx-86,cy-6],[cx-110,cy+10]],p.acc)+P([[cx+72,cy],[cx+110,cy-26],[cx+86,cy-6],[cx+110,cy+10]],p.acc)+
    C(cx-22,cy-30,10,p.eye)+C(cx+22,cy-30,10,p.eye)+C(cx-22,cy-30,4,'#200')+C(cx+22,cy-30,4,'#200'); },
  dragon(cx,cy,p){ let s=''; for(let i=0;i<6;i++)s+=C(cx-60+i*16,cy+18-i*2,18-i,p.dark);
    return s+P([[cx+10,cy-50],[cx+80,cy],[cx+10,cy+50],[cx+40,cy]],p.main)+ // wing
    E(cx+58,cy-6,42,28,p.main)+P([[cx+92,cy-18],[cx+126,cy-4],[cx+92,cy+8]],p.acc)+ // head/snout
    C(cx+74,cy-14,9,p.eye)+P([[cx+40,cy-26],[cx+52,cy-50],[cx+58,cy-26]],p.glow); },
  mech(cx,cy,p){ let s=ring(cx,cy,76,6,12,p.acc); return s+R(cx-46,cy-46,92,92,p.main)+R(cx-30,cy-30,60,60,p.dark)+
    C(cx,cy,22,p.glow)+C(cx,cy,10,p.eye)+R(cx-58,cy-10,16,20,p.acc)+R(cx+42,cy-10,16,20,p.acc); },
  phoenix(cx,cy,p){ return P([[cx,cy],[cx-80,cy-60],[cx-30,cy-10],[cx-90,cy+20]],p.acc)+P([[cx,cy],[cx+80,cy-60],[cx+30,cy-10],[cx+90,cy+20]],p.acc)+
    E(cx,cy,28,44,p.main)+P([[cx,cy-44],[cx-10,cy-72],[cx+10,cy-72]],p.glow)+C(cx-9,cy-20,7,p.eye)+C(cx+9,cy-20,7,p.eye)+
    P([[cx,cy+44],[cx-16,cy+86],[cx+16,cy+86]],p.glow); },
  sun(cx,cy,p){ let s=''; for(let i=0;i<16;i++){const a=i/16*Math.PI*2;s+=L(cx+Math.cos(a)*58,cy+Math.sin(a)*58,cx+Math.cos(a)*92,cy+Math.sin(a)*92,p.acc,6);}
    return s+C(cx,cy,58,p.main)+C(cx,cy,42,p.glow)+C(cx-16,cy-6,8,p.eye)+C(cx+16,cy-6,8,p.eye); },

  sporePod(cx,cy,p){ let s=''; for(let i=0;i<7;i++){const a=i/7*Math.PI*2;s+=C(cx+Math.cos(a)*70,cy+Math.sin(a)*70,12,p.acc);}
    return s+C(cx,cy,52,p.main)+ring(cx,cy,34,8,7,p.dark)+C(cx,cy,16,p.eye)+C(cx,cy,6,p.glow); },
  vineEmpress(cx,cy,p){ let s=''; for(let i=-1;i<=1;i+=2)for(let j=0;j<3;j++)s+=L(cx,cy,cx+i*(50+j*22),cy-60+j*40,p.dark,5);
    return s+P([[cx,cy-74],[cx+30,cy-30],[cx+44,cy+40],[cx-44,cy+40],[cx-30,cy-30]],p.main)+ // gown
    C(cx,cy-60,24,p.glow)+C(cx-9,cy-64,6,p.eye)+C(cx+9,cy-64,6,p.eye)+star(cx,cy-90,5,18,7,p.acc); },
  hiveCluster(cx,cy,p){ let s=''; const hex=[[0,0],[0,-40],[34,-20],[34,20],[0,40],[-34,20],[-34,-20],[0,-78],[68,-40],[68,40]];
    for(const[dx,dy]of hex)s+=star(cx+dx,cy+dy,6,24,21,(dx+dy)%2?p.main:p.dark);
    return s+C(cx,cy,12,p.eye)+C(cx+34,cy-20,8,p.glow)+C(cx-34,cy+20,8,p.glow); },
  mandrake(cx,cy,p){ let s=''; for(let i=-2;i<=2;i++)s+=L(cx+i*16,cy+30,cx+i*30,cy+90,p.dark,6);
    return s+E(cx,cy,46,40,p.main)+P([[cx,cy-40],[cx-20,cy-80],[cx-4,cy-44]],p.acc)+P([[cx,cy-40],[cx+20,cy-80],[cx+4,cy-44]],p.acc)+
    C(cx-16,cy-6,11,p.eye)+C(cx+16,cy-6,11,p.eye)+E(cx,cy+18,18,10,p.dark); },
  treant(cx,cy,p){ let s=R(cx-26,cy-10,52,90,p.dark); for(let i=0;i<10;i++){const a=i/10*Math.PI*2;s+=C(cx+Math.cos(a)*56,cy-40+Math.sin(a)*40,24,p.main);}
    return s+C(cx,cy-40,52,p.main)+C(cx-18,cy-44,9,p.eye)+C(cx+18,cy-44,9,p.eye)+E(cx,cy-22,16,20,p.dark)+star(cx,cy-40,5,16,6,p.glow); },

  eye(cx,cy,p){ return C(cx,cy,86,p.main)+C(cx,cy,84,'none',`stroke="${p.acc}" stroke-width="6"`)+
    E(cx,cy,84,52,p.dark)+C(cx,cy,40,p.glow)+C(cx,cy,22,p.eye)+C(cx-8,cy-8,7,'#fff')+ring(cx,cy,96,12,5,p.acc); },
  seraph(cx,cy,p){ let s=''; for(let i=0;i<3;i++)s+=P([[cx,cy-10],[cx-90+i*8,cy-50+i*30],[cx-30,cy+10+i*16]],p.glow,`opacity="${0.8-i*0.2}"`)+
    P([[cx,cy-10],[cx+90-i*8,cy-50+i*30],[cx+30,cy+10+i*16]],p.glow,`opacity="${0.8-i*0.2}"`);
    return s+E(cx,cy,30,50,p.main)+ring(cx,cy-54,22,8,4,p.acc)+C(cx,cy-54,20,'none',`stroke="${p.acc}" stroke-width="4"`)+C(cx,cy,0,p.eye)+R(cx-4,cy-40,8,70,p.eye); },
  maw(cx,cy,p){ let s=C(cx,cy,90,p.dark); for(let i=0;i<12;i++){const a=i/12*Math.PI*2;s+=P([[cx+Math.cos(a)*40,cy+Math.sin(a)*40],[cx+Math.cos(a+0.18)*88,cy+Math.sin(a+0.18)*88],[cx+Math.cos(a+0.36)*40,cy+Math.sin(a+0.36)*40]],p.main);}
    return s+C(cx,cy,40,'#0a0006')+C(cx,cy,18,p.glow)+ring(cx,cy,60,3,0,'none'); },
  fractal(cx,cy,p){ const tri=(x,y,sc,f)=>P([[x,y-40*sc],[x+34*sc,y+22*sc],[x-34*sc,y+22*sc]],f);
    return tri(cx,cy,1.6,p.main)+tri(cx,cy,1.0,p.dark)+tri(cx-40,cy+30,0.7,p.acc)+tri(cx+40,cy+30,0.7,p.acc)+tri(cx,cy-30,0.6,p.glow)+C(cx,cy+6,12,p.eye); },
  devourer(cx,cy,p){ let s=ring(cx,cy,98,10,7,p.acc); s+=star(cx,cy,8,96,52,p.dark,0.2);
    return s+C(cx,cy,60,p.main)+star(cx,cy,6,44,18,p.glow)+C(cx,cy,26,'#100')+C(cx,cy,14,p.eye)+
    C(cx-30,cy-30,8,p.glow)+C(cx+30,cy-30,8,p.glow)+C(cx-30,cy+30,8,p.glow)+C(cx+30,cy+30,8,p.glow); },
};

/* ---------- world + boss data ---------- */
const worlds = [
  { name:'I · NEBULA REACHES', sub:'Cosmic dust & newborn stars', sky:['#1a0033','#3a0a66'],
    pal:{main:'#9a6bff',acc:'#c9a9ff',dark:'#5a2a9a',glow:'#e6d2ff',eye:'#ffffff'},
    bosses:[
      {n:'Mote, the Star Hatchling',f:'droneCarrier',m:'Tutorial swarm-carrier: births weak drones, gentle aimed shots.'},
      {n:'Vael the Comet Lancer',f:'comet',m:'Telegraphed comet dashes across the lane — bait & dodge the rush.'},
      {n:'The Gemini Orbs',f:'twinOrbs',m:'Twin cores share a shield; you must whittle BOTH down together.'},
      {n:'Pulsa, Heart of the Reach',f:'pulsar',m:'Fires radial bullet-rings on a musical beat — slip through the gaps.'},
      {n:'NOVA SOVEREIGN',f:'novaStar',m:'World boss: starburst + summons, then a supernova you must shield.'},
    ]},
  { name:'II · CRYO EXPANSE', sub:'Frozen rings & glacial wrecks', sky:['#001a33','#004a7a'],
    pal:{main:'#5ac8ff',acc:'#bdefff',dark:'#1f6fa8',glow:'#e8fbff',eye:'#06354a'},
    bosses:[
      {n:'Frost Weaver',f:'spider',m:'Drops icicle volleys and slowing web-fields from above.'},
      {n:'Glacier Wyrm',f:'serpent',m:'Segmented serpent — only the head takes real damage.'},
      {n:'Hailstorm Djinn',f:'djinn',m:'Calls hail columns that rain down across the screen.'},
      {n:'Mirror Sentinel',f:'mirror',m:'Front facet reflects your shots — flank it to hit the core.'},
      {n:'ABSOLUTE ZERO',f:'iceTitan',m:'World boss: flash-freezes your engines, then heavy ice barrages.'},
    ]},
  { name:'III · INFERNAL FORGE', sub:'Magma foundries & war-machines', sky:['#2a0a00','#6a1500'],
    pal:{main:'#ff7a3c',acc:'#ffd24a',dark:'#a83a10',glow:'#fff0c0',eye:'#2a0a00'},
    bosses:[
      {n:'Magma Crawler',f:'crab',m:'Armored shell; pincers sweep — strike the glowing underbelly.'},
      {n:'Ember Drake',f:'dragon',m:'Breathes a wall of flame with a single safe gap to fly through.'},
      {n:'Forge Overseer',f:'mech',m:'Rotating turret-arms lay down a spinning spiral of fire.'},
      {n:'Cinder Phoenix',f:'phoenix',m:'Dies… then is reborn once at full rage. Kill it twice.'},
      {n:'SOLAR TYRANT',f:'sun',m:'World boss: sweeping solar beams + flare summons.'},
    ]},
  { name:'IV · VERDANT HOLLOW', sub:'Overgrown hive-jungle', sky:['#0a2a12','#0f5224'],
    pal:{main:'#46d36a',acc:'#b6ff7d',dark:'#1f7a36',glow:'#e6ffd0',eye:'#0a2a12'},
    bosses:[
      {n:'Spore Mother',f:'sporePod',m:'Vents homing spores; splits into smaller pods when hurt.'},
      {n:'Thorn Empress',f:'vineEmpress',m:'Lashes vine-whips in from the screen edges.'},
      {n:'The Hive Mind',f:'hiveCluster',m:'A cluster of cells — pop each segment to expose the core.'},
      {n:'Mandrake Colossus',f:'mandrake',m:'Screams to stun, and roots adds that rush you.'},
      {n:'WORLD ROOT',f:'treant',m:'World boss: many weak-points, seeking spores, vine storm.'},
    ]},
  { name:'V · THE VOID', sub:'Where reality unravels', sky:['#0a0010','#240038'],
    pal:{main:'#ff3c7c',acc:'#ff9ec0',dark:'#9a0a44',glow:'#ffd0e2',eye:'#ffffff'},
    bosses:[
      {n:'The Watcher',f:'eye',m:'Single great eye; charges a tracking gaze-laser.'},
      {n:'Null Seraph',f:'seraph',m:'Six wings fire crossing light-lances in holy patterns.'},
      {n:'Entropy Maw',f:'maw',m:'Devouring mouth that drags your ship toward it (gravity).'},
      {n:'Fractal Horror',f:'fractal',m:'Splits into shrinking copies — destroy every shard.'},
      {n:'THE DEVOURER',f:'devourer',m:'FINAL BOSS: cycles through every mechanic across 4 phases.'},
    ]},
];

/* ---------- render one world sheet ---------- */
function sheet(world, idx){
  const cardW=300, cardH=430, pad=24, cols=5;
  const w = pad + cols*(cardW+pad), h = 150 + cardH + pad;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="Courier New, monospace">`;
  svg += `<defs><radialGradient id="sky" cx="55%" cy="35%" r="80%"><stop offset="0%" stop-color="${world.sky[1]}"/><stop offset="100%" stop-color="${world.sky[0]}"/></radialGradient></defs>`;
  svg += R(0,0,w,h,'url(#sky)');
  // starfield
  let starsvg=''; for(let i=0;i<140;i++)starsvg+=C(Math.random()*w,Math.random()*h,Math.random()*1.6,'#ffffff',`opacity="${0.2+Math.random()*0.5}"`);
  svg += starsvg;
  // header
  svg += `<text x="${pad}" y="64" fill="${world.pal.acc}" font-size="38" font-weight="bold" letter-spacing="2">WORLD ${esc(world.name)}</text>`;
  svg += `<text x="${pad}" y="96" fill="#9fb6d6" font-size="18">${esc(world.sub)}</text>`;
  svg += L(pad,116,w-pad,116,world.pal.dark,2);
  // cards
  world.bosses.forEach((b,i)=>{
    const x = pad + i*(cardW+pad), y = 150;
    const tier5 = i===4;
    svg += R(x,y,cardW,cardH,'rgba(10,12,28,0.55)',`rx="14" stroke="${tier5?world.pal.acc:'rgba(150,170,220,0.25)'}" stroke-width="${tier5?3:1.5}"`);
    if(tier5) svg += `<text x="${x+cardW/2}" y="${y+26}" fill="${world.pal.acc}" font-size="13" font-weight="bold" text-anchor="middle">★ WORLD BOSS ★</text>`;
    else svg += `<text x="${x+cardW/2}" y="${y+26}" fill="#7f97b8" font-size="12" text-anchor="middle">LEVEL ${idx*5+i+1}</text>`;
    // creature
    const cx=x+cardW/2, cy=y+170;
    svg += C(cx,cy,118,world.pal.main,'opacity="0.06"');
    svg += forms[b.f](cx,cy,world.pal);
    // name
    svg += `<text x="${cx}" y="${y+300}" fill="#eaf3ff" font-size="16" font-weight="bold" text-anchor="middle">${esc(b.n)}</text>`;
    // mechanic (wrap)
    const words=b.m.split(' '); let line='',ln=0;
    for(const wd of words){ if((line+wd).length>30){ svg+=`<text x="${cx}" y="${y+326+ln*18}" fill="#a9c2e0" font-size="12.5" text-anchor="middle">${esc(line.trim())}</text>`; line=wd+' '; ln++; } else line+=wd+' '; }
    if(line) svg+=`<text x="${cx}" y="${y+326+ln*18}" fill="#a9c2e0" font-size="12.5" text-anchor="middle">${esc(line.trim())}</text>`;
  });
  svg += `</svg>`;
  return svg;
}
function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

worlds.forEach((wd,i)=>{ fs.writeFileSync(`${OUT}/world_${i+1}_bosses.svg`, sheet(wd,i)); });
console.log('Wrote', worlds.length, 'world sheets to', OUT);
