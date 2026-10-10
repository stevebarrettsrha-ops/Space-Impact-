/* Reusable solid mesh primitives. Coordinates and normals share one transform;
   faces are wound outward, with separate inward surfaces for hollow openings. */
'use strict';
const MeshKit = (() => {
  const TAU = Math.PI * 2;
  function create(segments = 20) {
    const V = [], N = [], tris = [], sides = segments;
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
      const inner=r-Math.min(45,r*.15);
      lathe(c,axis,[[z-width/2,inner],[z-width/2,r],[z+width/2,r],[z+width/2,inner]],cell,false);
    }

    function prism(points, depth, cell) {
      // A convex outline in X/Z, extruded vertically; used for control surfaces.
      const center = points.reduce((c,p)=>[c[0]+p[0]/points.length,c[1]+p[1]/points.length],[0,0]);
      for(const y of [-depth/2,depth/2])for(let i=1;i<points.length-1;i++){
        const p=[points[0],points[i],points[i+1],points[i+1]].map(([x,z])=>[x,y,z]);
        const n=[0,Math.sign(y),0];face(p,[n,n,n,n],cell);
      }
      for(let i=0;i<points.length;i++){
        const a=points[i],b=points[(i+1)%points.length];
        let n=unit([b[1]-a[1],0,a[0]-b[0]]);
        if(n[0]*((a[0]+b[0])/2-center[0])+n[2]*((a[1]+b[1])/2-center[1])<0)n=n.map(v=>-v);
        face([[a[0],-depth/2,a[1]],[b[0],-depth/2,b[1]],[b[0],depth/2,b[1]],[a[0],depth/2,a[1]]],[n,n,n,n],cell);
      }
    }
    function transform(start, offset, scale=[1,1,1], yaw=0, roll=0) {
      const cy=Math.cos(yaw),sy=Math.sin(yaw),cr=Math.cos(roll),sr=Math.sin(roll);
      const rotate=([x,y,z])=>{const X=x*cr-y*sr,Y=x*sr+y*cr;return [X*cy+z*sy,Y,-X*sy+z*cy];};
      for(let i=start;i<V.length;i+=3){
        const p=rotate(V.slice(i,i+3).map((x,k)=>x*scale[k]));
        const n=unit(rotate(N.slice(i,i+3).map((x,k)=>x/scale[k])));
        for(let k=0;k<3;k++){V[i+k]=p[k]+offset[k];N[i+k]=n[k];}
      }
    }
    function finish(name, texture, material={specular:.28,gloss:38}) {
    const bbox=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];let radius=0;
    for(let i=0;i<V.length;i+=3){for(let k=0;k<3;k++){bbox[k]=Math.min(bbox[k],V[i+k]);bbox[k+3]=Math.max(bbox[k+3],V[i+k]);}radius=Math.max(radius,Math.hypot(V[i],V[i+1],V[i+2]));}

      return {V:new Float32Array(V),N:new Float32Array(N),tris,count:V.length/3,bbox,radius,name,texture,material};
    }
    return {face,lathe,box,rib,prism,transform,finish,get cursor(){return V.length;}};
  }
  return {create};
})();
