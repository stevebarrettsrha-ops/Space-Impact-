/* Connected pressure-hull station, in world units (100 units = one metre).
   Flight and the dock console use this same mesh at scale 1. */
'use strict';
const StationModel = (() => {
  const TAU = Math.PI * 2;

  function texture(metal, rebel) {
    const w = 512, h = 256, data = new Uint8ClampedArray(w * h * 4);
    const colours = [[155,178,180], [52,72,78], [192,153,66], [25,75,94],
      [139,225,231], [12,24,30], rebel ? [154,93,60] : [54,117,139], [214,77,49]];
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

  function build(metal, rebel = false, low = false) {
    const V = [], N = [], tris = [], sides = low ? 12 : 24;
    const unit = v => { const d = Math.hypot(...v) || 1; return v.map(x => x / d); };
    function face(points, normals, cell) {
      const u = (cell % 4) * 128 + 3, v = Math.floor(cell / 4) * 128 + 3;
      const uv = [[u,v], [u+121,v], [u+121,v+121], [u,v+121]], start = V.length / 3;
      for (let i = 0; i < 4; i++) { V.push(...points[i]); N.push(...unit(normals[i])); }
      for (const ids of [[0,1,2], [0,2,3]]) {
        let [a,b,c] = ids;
        const p = points[a], q = points[b].map((x,k) => x-p[k]), r = points[c].map((x,k) => x-p[k]);
        const cross = [q[1]*r[2]-q[2]*r[1], q[2]*r[0]-q[0]*r[2], q[0]*r[1]-q[1]*r[0]];
        if (Math.hypot(...cross) < .001) continue;
        if (cross.reduce((s,x,k) => s+x*normals[a][k],0) < 0) [b,c] = [c,b];
        tris.push({a:start+a,b:start+b,c:start+c,ua:uv[a][0],va:uv[a][1],ub:uv[b][0],vb:uv[b][1],uc:uv[c][0],vc:uv[c][1],blend:0});
      }
    }
    // A lathed profile gives pressure vessels rounded caps, cylindrical walls,
    // and hollow bay rims. Normals follow the profile; ribs retain hard edges.
    function lathe(center, axis, rings, cell, smooth = true, inward = false) {
      const map = (a,b,c) => axis === 'y' ? [a,c,b] : axis === 'x' ? [c,a,b] : [a,b,c];
      for (let j = 0; j < rings.length - 1; j++) {
        const [z0,r0] = rings[j], [z1,r1] = rings[j+1], dz = z1-z0, dr = r1-r0;
        for (let i = 0; i < sides; i++) {
          const a = i / sides * TAU, b = (i+1) / sides * TAU;
          const points = [[a,z0,r0],[b,z0,r0],[b,z1,r1],[a,z1,r1]].map(([t,z,r]) =>
            map(Math.cos(t)*r,Math.sin(t)*r,z).map((x,k) => x+center[k]));
          const normals = [a,b,b,a].map(t => {
            if (!smooth) t = (a+b)/2;
            return map(Math.cos(t)*dz,Math.sin(t)*dz,-dr).map(x => inward ? -x : x);
          });
          face(points,normals,cell);
        }
      }
    }
    function box(c, s, cell) {
      for (let axis = 0; axis < 3; axis++) for (const sign of [-1,1]) {
        const a = (axis+1)%3, b = (axis+2)%3, n = [0,0,0]; n[axis] = sign;
        const points = [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y]) => {
          const p = c.slice(); p[axis] += sign*s[axis]/2; p[a] += x*s[a]/2; p[b] += y*s[b]/2; return p;
        });
        face(points,[n,n,n,n],cell);
      }
    }
    function rib(c,axis,z,r,width,cell=1) {
      lathe(c,axis,[[z-width/2,r-45],[z-width/2,r],[z+width/2,r],[z+width/2,r-45]],cell,false);
    }
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

    const bbox=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];let radius=0;
    for(let i=0;i<V.length;i+=3){for(let k=0;k<3;k++){bbox[k]=Math.min(bbox[k],V[i+k]);bbox[k+3]=Math.max(bbox[k+3],V[i+k]);}radius=Math.max(radius,Math.hypot(V[i],V[i+1],V[i+2]));}
    const model={V:new Float32Array(V),N:new Float32Array(N),tris,count:V.length/3,bbox,radius,
      name:rebel?'station_rebel':'station_civil',texture:texture(metal,rebel),material:{specular:.22,gloss:36}};
    if(!low){model.lod=build(metal,rebel,true);model.lod.texture=model.texture;}
    return model;
  }
  const key = rebel => rebel ? 'station_rebel' : 'station_civil';
  return {build,key};
})();
