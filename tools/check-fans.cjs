// The centre crop encloses one real fan aperture. Only simulation phase changes.
function checkFans(){
 const names=Array.from({length:11},(_,i)=>'u'+i).concat('tanker1','torpedo'),failures=[];
 const size=160,first=new Uint8Array(size*size*4),second=new Uint8Array(first.length);
 let checks=0;
 for(const name of names)for(const detail of ['high','low']){
  const model=detail==='high'?Game.MODELS[name]:Game.MODELS[name].lod;
  for(let index=0;index<model.rotors.length;index++){
   const rotor=model.rotors[index],[x,y,z]=rotor.position;
   function draw(phase,pixels){
    Gfx.clearTo(0,0,0);Gfx.setLamp(0,0);Gfx.setFog(0,0,0,1e7,2e7);
    Gfx.setCamera(x,y,z-rotor.radius*Gfx.H/70,0,0,0,1);
    Gfx.drawModel(model,0,0,0,null,1,null,{ambient:1,noFog:true,rotorPhase:phase});Gfx.flush();
    sceneGL.readPixels(Math.floor((sceneGL.drawingBufferWidth-size)/2),Math.floor((sceneGL.drawingBufferHeight-size)/2),size,size,sceneGL.RGBA,sceneGL.UNSIGNED_BYTE,pixels);
   }
   draw(0,first);draw(Math.PI/4,second);
   let changed=0;for(let i=0;i<first.length;i+=4)if(first[i]!==second[i]||first[i+1]!==second[i+1]||first[i+2]!==second[i+2])changed++;
   checks++;if(changed<60)failures.push({name,detail,index,changed});
  }
 }
 return {checks,failures,error:sceneGL.getError()};
}
module.exports={checkFans};
