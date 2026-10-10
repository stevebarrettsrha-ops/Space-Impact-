/* Full-resolution WebGL scene renderer. The existing canvas remains the UI
   compositor; the software rasteriser is retained for unsupported devices. */
'use strict';
const OceanGPU = (() => {
  const vertex = `
    attribute vec3 aPosition, aNormal;
    attribute vec2 aUV;
    uniform mat3 uRotation, uView;
    uniform vec3 uPosition, uTranslation;
    uniform vec2 uProjection;
    uniform float uScale;
    uniform vec4 uDeform, uBounds;
    varying vec3 vWorld, vNormal, vView;
    varying vec2 vUV;
    void main() {
      vec3 p=aPosition, n=aNormal;
      float mode=uDeform.x, phase=uDeform.y, strength=uDeform.z;
      float tail=1.0-(p.z-uBounds.x)/max(1.0,uBounds.y);
      if(mode==1.0 || mode==5.0) {
        float angle=phase-tail*4.0, amp=uBounds.y*strength;
        float offset=sin(angle)*tail*tail*amp;
        float derivative=amp/uBounds.y*(4.0*cos(angle)*tail*tail-2.0*sin(angle)*tail);
        if(mode==1.0){p.x+=offset;n.z-=derivative*n.x;}
        else{p.y+=offset;n.z-=derivative*n.y;}
      } else if(mode==2.0) {
        float h=(p.y-uBounds.z)/uBounds.w, angle=phase+h*2.0;
        p.x+=sin(angle)*h*h*uBounds.w*strength;
        n.y-=(cos(angle)*h*h*2.0+sin(angle)*h*2.0)*strength*n.x;
      } else if(mode==3.0) {
        float pulse=1.0+sin(phase)*.09;
        p.xz*=pulse;n.xz/=pulse;
        p.y+=sin(phase+(p.y-uBounds.z)/uBounds.w*3.0)*uBounds.w*.025;
      } else if(mode==4.0) {
        float w=p.x/uDeform.w, angle=phase+abs(w)*1.3;
        p.y+=sin(angle)*w*w*uDeform.w*strength;
        n.x-=(cos(angle)*sign(w)*1.3*w*w+sin(angle)*2.0*w)*strength*n.y;
      }
      vWorld=uRotation*(p*uScale)+uPosition;
      vNormal=normalize(uRotation*n);
      vView=uView*vWorld+uTranslation;
      vUV=aUV;
      // +Z is forward in DEEP. Hardware clips triangles at the near plane.
      gl_Position=vec4(vView.xy*uProjection,1.0000533348*vView.z-16.00042668,vView.z);
    }`;
  const fragment = `
    precision highp float;
    uniform sampler2D uTexture, uShadow;
    uniform mat3 uShadowView;
    uniform float uHasShadow;
    uniform mat3 uView;
    uniform vec3 uFog, uTint, uFlat;
    uniform vec4 uMaterial;
    uniform vec4 uAtmosphere;
    uniform vec4 uFlags;
    uniform vec2 uLamp;
    varying vec3 vWorld, vNormal, vView;
    varying vec2 vUV;
    void main() {
      vec3 albedo=uFlat.x<0.0 ? texture2D(uTexture,vUV).rgb : uFlat;
      if(uFlags.x>0.5 && dot(albedo,vec3(1.0))<.118)discard;
      vec3 n=normalize(vNormal), l=normalize(vec3(.35,.75,-.55));
      vec3 eye=normalize(-vView), vn=uView*n;
      float diffuse=max(0.0,dot(n,l));
      float sky=.5+.5*n.y;
      vec3 shadowPosition=uShadowView*vWorld;
      vec2 shadowUV=shadowPosition.xy*.5+.5;
      float visibility=1.0;
      if(uHasShadow>.5 && all(greaterThan(shadowUV,vec2(.002))) && all(lessThan(shadowUV,vec2(.998)))){
        float blocked=0.0, z=shadowPosition.z*.5+.5-.0012;
        for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
          vec2 value=texture2D(uShadow,shadowUV+vec2(float(x),float(y))/2048.0).rg;
          blocked+=step(value.x+value.y/255.0,z);
        }
        visibility=1.0-blocked/9.0*.72;
      }
      float light=uMaterial.x*(.55+.45*visibility)+(1.0-uMaterial.x)*(.7*diffuse*visibility+.3*sky);
      float distance=length(vView);
      float cone=smoothstep(.65,.96,vView.z/max(1.0,distance));
      light+=uLamp.x*cone*max(.12,dot(vn,eye))/(1.0+distance*distance/uLamp.y);
      float spec=pow(max(0.0,dot(vn,normalize(uView*l+eye))),uMaterial.z)*uMaterial.y;
      float fresnel=pow(1.0-max(0.0,dot(vn,eye)),5.0)*uMaterial.y*.25;
      // Restrained moving caustics vanish with depth, never stripes at 5 km.
      vec2 q=vWorld.xz*.001;
      float wave=sin(q.x+q.y*.7+uAtmosphere.z*.65)*sin(q.y*1.4-q.x*.35-uAtmosphere.z*.45);
      light+=pow(max(0.0,wave),12.0)*.24*max(0.0,n.y)*exp(-uAtmosphere.w/110.0);
      // Emissive inserts are identified by the dedicated material atlas cells.
      float emit=uMaterial.w>0.5 && vUV.y>.5 && (vUV.x<.25 || vUV.x>.75) ? .6 : 0.0;
      vec3 color=albedo*uTint*max(light,emit)+vec3(.60,.82,.9)*(spec*visibility+fresnel);
      if(uFlags.x>1.5)color=albedo*uTint;
      float travel=max(0.0,distance-uAtmosphere.x);
      vec3 transmission=exp(-travel/max(1.0,uAtmosphere.y)*vec3(3.1,1.6,1.12));
      if(uFlags.y<.5)color=color*transmission+uFog*(1.0-transmission);
      gl_FragColor=vec4(clamp(color,0.0,1.0),uFlags.z);
    }`;
  const backgroundVertex = `
    attribute vec2 aPosition;
    varying vec2 vUV;
    void main(){vUV=aPosition*.5+.5;gl_Position=vec4(aPosition,1.0,1.0);}`;
  const backgroundFragment = `
    precision highp float;
    varying vec2 vUV;
    uniform vec3 uTop, uBottom;
    uniform vec4 uWater;
    uniform vec2 uSize;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
      return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
    void main(){
      vec2 uv=vUV, q=vec2((uv.x-.5)*uSize.x/uSize.y,uv.y-.5);
      float y=clamp(uv.y+uWater.w*.45,0.0,1.0);
      vec3 color=mix(uBottom,uTop,smoothstep(0.0,1.0,y));
      float veil=noise(q*3.0+vec2(uWater.z*.5,uWater.x*.008))*.65+noise(q*7.0-vec2(uWater.x*.012,0))*.35;
      float shallow=exp(-uWater.y/140.0);
      float ray=pow(max(0.0,sin((q.x+q.y*.2+uWater.z*.2)*17.0+uWater.x*.07)),14.0);
      color*=.85+veil*.26;
      color+=vec3(.12,.23,.24)*ray*shallow*y*y;
      // Broad forward backscatter and subtle grain break up the empty blue wash.
      color+=vec3(.009,.027,.031)*exp(-dot(q,q)*3.8);
      color*=1.0-.18*smoothstep(.25,1.0,length(q));
      color+=(hash(gl_FragCoord.xy)-.5)/255.0;
      gl_FragColor=vec4(color,1.0);
    }`;
  const particleVertex = `
    attribute vec3 aPosition, aColor;
    attribute vec2 aShape;
    uniform mat3 uView;
    uniform vec3 uTranslation;
    uniform vec2 uProjection;
    uniform float uFocal;
    varying vec3 vColor;
    varying vec2 vShape;
    void main(){vec3 p=uView*aPosition+uTranslation;vColor=aColor;vShape=aShape;
      gl_Position=vec4(p.xy*uProjection,1.0000533348*p.z-16.00042668,p.z);
      gl_PointSize=clamp(aShape.x*uFocal/max(p.z,8.0),1.0,64.0);}`;
  const particleFragment = `
    precision mediump float;
    varying vec3 vColor;
    varying vec2 vShape;
    void main(){vec2 p=gl_PointCoord*2.0-1.0;float q=dot(p,p);if(q>1.0)discard;
      float a=(1.0-q)*(1.0-q)*.45;
      if(vShape.y>0.0)a=(.07+pow(q,3.0)*.48)*(1.0-smoothstep(.7,1.0,q));
      gl_FragColor=vec4(vColor,a*abs(vShape.y));}`;

  const shadowVertex=`
    attribute vec3 aPosition;
    uniform mat3 uRotation,uShadowView;
    uniform vec3 uPosition;
    uniform float uScale;
    void main(){gl_Position=vec4(uShadowView*(uRotation*(aPosition*uScale)+uPosition),1.0);}`;
  const shadowFragment=`
    precision highp float;
    void main(){float d=gl_FragCoord.z*255.0;gl_FragColor=vec4(floor(d)/255.0,fract(d),0.0,1.0);}`;

  function create(canvas,onRestore) {
    let gl;
    try { gl=canvas.getContext('webgl',{alpha:false,antialias:true,depth:true,preserveDrawingBuffer:true}); }
    catch (_) { return null; }
    if(!gl || typeof gl.createShader!=='function')return null;
    let lost=false, meshes=new WeakMap(), textures=new WeakMap(), programs;
    const anisotropy=gl.getExtension('EXT_texture_filter_anisotropic');
    function program(vs,fs){
      const p=gl.createProgram();
      for(const [type,source] of [[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,fs]]){
        const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);
        if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));
        gl.attachShader(p,s);gl.deleteShader(s);
      }
      gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));
      return {p,u:{},a:{}};
    }
    let quad, particles, shadowFramebuffer, shadowTexture, shadowReady=false;
    const length=Math.hypot(.35,.75,-.55),l=[.35/length,.75/length,-.55/length];
    const sideLength=Math.hypot(l[0],l[2]),right=[-l[2]/sideLength,0,l[0]/sideLength];
    const up=[l[1]*right[2],l[2]*right[0]-l[0]*right[2],-l[1]*right[0]];
    const shadowView=[right[0]/24000,up[0]/24000,-l[0]/60000,right[1]/24000,up[1]/24000,-l[1]/60000,right[2]/24000,up[2]/24000,-l[2]/60000];
    function setup(){
      programs={mesh:program(vertex,fragment),water:program(backgroundVertex,backgroundFragment),point:program(particleVertex,particleFragment),shadow:program(shadowVertex,shadowFragment)};
      quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
      shadowTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,shadowTexture);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,2048,2048,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
      for(const parameter of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,parameter,gl.NEAREST);
      for(const parameter of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,parameter,gl.CLAMP_TO_EDGE);
      shadowFramebuffer=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,shadowFramebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,shadowTexture,0);
      const depthBuffer=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,depthBuffer);
      gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,2048,2048);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depthBuffer);
      shadowReady=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);
      particles=gl.createBuffer();gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.frontFace(gl.CCW);
    }
    try{setup();}catch(error){console.warn('WebGL unavailable; using software rendering.',error);return null;}
    if(canvas.addEventListener){
      canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;});
      canvas.addEventListener('webglcontextrestored',()=>{try{meshes=new WeakMap();textures=new WeakMap();setup();lost=false;if(onRestore)onRestore();}catch(_){lost=true;}});
    }
    let width=1,height=1,view=[1,0,0,0,1,0,0,0,1],translation=[0,0,0],projection=[1,1],focal=1;
    let fog=[.02,.1,.15],near=1200,far=9000,lamp=[0,1],time=0,depth=5000,pointData=[],queue=[];
    let top=[.03,.12,.17],bottom=[.005,.025,.04];
    const transpose=m=>[m[0],m[3],m[6],m[1],m[4],m[7],m[2],m[5],m[8]];
    function use(p){gl.useProgram(p.p);for(let i=0;i<3;i++)gl.disableVertexAttribArray(i);return p;}
    function uniform(p,n,kind,value){const u=p.u[n]??(p.u[n]=gl.getUniformLocation(p.p,n));if(kind==='Matrix3fv')gl.uniformMatrix3fv(u,false,value);else gl['uniform'+kind](u,value);}
    const u1=(p,n,v)=>uniform(p,n,'1f',v),u2=(p,n,v)=>uniform(p,n,'2fv',v),u3=(p,n,v)=>uniform(p,n,'3fv',v),u4=(p,n,v)=>uniform(p,n,'4fv',v),um=(p,n,v)=>uniform(p,n,'Matrix3fv',v);
    function attribute(p,n,size,stride,offset){const a=p.a[n]??(p.a[n]=gl.getAttribLocation(p.p,n));if(a<0)return;gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,size,gl.FLOAT,false,stride,offset);}
    function texture(tex){
      if(!tex)tex=white;
      let t=textures.get(tex);if(t){gl.bindTexture(gl.TEXTURE_2D,t);return;}
      t=gl.createTexture();textures.set(tex,t);gl.bindTexture(gl.TEXTURE_2D,t);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,tex.w,tex.h,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(tex.data.buffer,tex.data.byteOffset,tex.data.byteLength));
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      const pot=(tex.w&(tex.w-1))===0&&(tex.h&(tex.h-1))===0;
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,pot?gl.LINEAR_MIPMAP_LINEAR:gl.LINEAR);
      if(pot){gl.generateMipmap(gl.TEXTURE_2D);if(anisotropy)gl.texParameterf(gl.TEXTURE_2D,anisotropy.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(4,gl.getParameter(anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));}
    }
    const white={w:1,h:1,data:new Uint8Array([255,255,255,255])};
    function geometry(model,tex){
      let entry=meshes.get(model);if(entry)return entry;
      const groups=new Map();
      for(const tri of model.tris){
        const t=tri.emission||tri,key=(tri.emission?'e':'s')+(t.blend||0);
        let group=groups.get(key);if(!group){group={values:[],mode:t.blend||0,tex:tri.emission?model.emissionTexture:tex};groups.set(key,group);}
        const skin=group.tex||white;
        for(const [id,u,v] of [[tri.a,t.ua,t.va],[tri.b,t.ub,t.vb],[tri.c,t.uc,t.vc]]){
          group.values.push(...model.V.subarray(id*3,id*3+3),...(model.N?model.N.subarray(id*3,id*3+3):[0,1,0]),u/skin.w,v/skin.h);
        }
      }
      entry=Array.from(groups.values()).sort((a,b)=>a.mode-b.mode).map(g=>{
        const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(g.values),gl.STATIC_DRAW);
        return {buffer,count:g.values.length/8,mode:g.mode,tex:g.tex};
      });meshes.set(model,entry);return entry;
    }
    function common(p){um(p,'uView',view);u3(p,'uTranslation',translation);u2(p,'uProjection',projection);}
    function background(water){
      const p=use(programs.water);gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.disable(gl.BLEND);
      gl.bindBuffer(gl.ARRAY_BUFFER,quad);attribute(p,'aPosition',2,0,0);
      u3(p,'uTop',top);u3(p,'uBottom',bottom);u2(p,'uSize',[width,height]);u4(p,'uWater',water);
      gl.drawArrays(gl.TRIANGLE_STRIP,0,4);gl.enable(gl.DEPTH_TEST);
    }
    let hasShadow=false;
    return {
      canvas,get available(){return !lost;},
      resize(w,h){width=w;height=h;canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);},
      camera(m,f){view=[m[0],m[4],m[8],m[1],m[5],m[9],m[2],m[6],m[10]];translation=[m[3],m[7],m[11]];focal=f;projection=[2*f/width,2*f/height];},
      fog(r,g,b,n,f){fog=[r/255,g/255,b/255];near=n;far=f;},
      lamp(k,r){lamp=[k,r*r];},
      clear(a,b){pointData=[];queue=[];top=a.map(v=>v/255);bottom=(b||a).map(v=>v/255);gl.depthMask(true);gl.clear(gl.DEPTH_BUFFER_BIT);background([0,5000,0,0]);},
      water(t,d,yaw,pitch){time=t;depth=d;background([t,d,yaw,pitch]);},
      draw(...args){queue.push(args);},
      drawNow(model,x,y,z,rotation,scale,tex,opts={}){
        const p=use(programs.mesh),d=opts.deform,material=model.material||{specular:0,gloss:16};
        gl.enable(gl.CULL_FACE);common(p);um(p,'uShadowView',shadowView);u1(p,'uHasShadow',hasShadow?1:0);
        gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,shadowTexture);gl.uniform1i(gl.getUniformLocation(p.p,'uShadow'),1);gl.activeTexture(gl.TEXTURE0);um(p,'uRotation',transpose(rotation||[1,0,0,0,1,0,0,0,1]));
        u3(p,'uPosition',[x,y,z]);u1(p,'uScale',scale);u3(p,'uFog',fog);u3(p,'uTint',opts.tint||[1,1,1]);
        u3(p,'uFlat',opts.flatColour?opts.flatColour.map(v=>v/255):[-1,-1,-1]);
        u4(p,'uMaterial',[opts.ambient??.45,material.specular,material.gloss,model.texture?.w===512&&model.texture?.h===256?1:0]);
        u4(p,'uAtmosphere',[near,Math.max(1,far-near),opts.time??time,depth]);u2(p,'uLamp',lamp);
        u4(p,'uDeform',d?[d.mode,d.phase,d.strength,d.width]:[0,0,0,1]);u4(p,'uBounds',d?[d.lo,d.span,d.bottom,d.height]:[0,1,0,1]);
        for(const g of geometry(model,model.texture||tex)){
          const mode=opts.additive?2:g.mode;texture(g.tex);u4(p,'uFlags',[mode,opts.noFog?1:0,opts.alpha??1,0]);
          if(mode===2||opts.alpha<1){gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,mode===2?gl.ONE:gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);}
          else{gl.disable(gl.BLEND);gl.depthMask(true);}
          gl.bindBuffer(gl.ARRAY_BUFFER,g.buffer);attribute(p,'aPosition',3,32,0);attribute(p,'aNormal',3,32,12);attribute(p,'aUV',2,32,24);gl.drawArrays(gl.TRIANGLES,0,g.count);
        }
        gl.depthMask(true);
      },
      point(x,y,z,size,r,g,b,fade,bubble){
        const dz=view[2]*x+view[5]*y+view[8]*z+translation[2];
        if(dz<8)return;const a=fade===false?1:Math.max(0,Math.min(1,1-(dz-near)/(far-near)));
        if(a>0)pointData.push(x,y,z,r/255,g/255,b/255,size,bubble?a:-a);
      },
      flush(){
        const casters=queue.filter(args=>args[0].name?.startsWith('station_'));
        hasShadow=shadowReady&&casters.length>0;
        if(hasShadow){
          const p=use(programs.shadow);gl.bindFramebuffer(gl.FRAMEBUFFER,shadowFramebuffer);gl.viewport(0,0,2048,2048);
          gl.depthMask(true);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.disable(gl.BLEND);gl.clearColor(1,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
          um(p,'uShadowView',shadowView);
          for(const [model,x,y,z,rotation,scale,tex] of casters){
            um(p,'uRotation',transpose(rotation||[1,0,0,0,1,0,0,0,1]));u3(p,'uPosition',[x,y,z]);u1(p,'uScale',scale);
            for(const g of geometry(model,model.texture||tex))if(g.mode===0){gl.bindBuffer(gl.ARRAY_BUFFER,g.buffer);attribute(p,'aPosition',3,32,0);gl.drawArrays(gl.TRIANGLES,0,g.count);}
          }
          gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,width,height);
        }
        for(const args of queue)this.drawNow(...args);
        if(pointData.length){const p=use(programs.point);common(p);u1(p,'uFocal',focal);
          gl.disable(gl.CULL_FACE);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
          gl.bindBuffer(gl.ARRAY_BUFFER,particles);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(pointData),gl.DYNAMIC_DRAW);
          attribute(p,'aPosition',3,32,0);attribute(p,'aColor',3,32,12);attribute(p,'aShape',2,32,24);gl.drawArrays(gl.POINTS,0,pointData.length/8);gl.depthMask(true);
        }gl.flush();
      }
    };
  }
  return {create};
})();
