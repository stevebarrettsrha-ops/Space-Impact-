// Passed to Playwright's page.evaluate: use the actual game renderer and models.
// A green solid inside each red hull must be occluded from every viewing axis.
function checkShipHulls(){
 const builder=MeshKit.create();builder.box([0,0,0],[160,160,160],0);
 const probe=builder.finish('interior-probe',null,{specular:0,gloss:1});
 const failures=[],pixels=new Uint8Array(4),views=[[0,0,-1],[0,0,1],[-1,0,0],[1,0,0],[0,1,0],[0,-1,0]];
 let checks=0;
 for(let i=0;i<11;i++)for(const detail of ['high','low']){
  const model=detail==='high'?Game.MODELS['u'+i]:Game.MODELS['u'+i].lod;
  for(const [x,y,z] of views){
   const distance=model.radius*2.5;
   Gfx.clearTo(0,0,0);Gfx.setFog(0,0,0,1e7,2e7);Gfx.setLamp(0,0);
   Gfx.setCamera(x*distance,y*distance,z*distance,Math.atan2(-x,-z),Math.atan2(-y,Math.hypot(x,z)),0,1);
   Gfx.drawModel(model,0,0,0,null,1,null,{flatColour:[255,0,0],ambient:1,noFog:true});
   Gfx.drawModel(probe,0,0,0,null,1,null,{flatColour:[0,255,0],ambient:1,noFog:true});
   Gfx.flush();
   sceneGL.readPixels(Math.floor(sceneGL.drawingBufferWidth/2),Math.floor(sceneGL.drawingBufferHeight/2),1,1,sceneGL.RGBA,sceneGL.UNSIGNED_BYTE,pixels);
   checks++;
   if(pixels[0]<=pixels[1]||pixels[0]<32)failures.push({ship:i,detail,view:[x,y,z],pixel:Array.from(pixels)});
  }
 }
 return {checks,failures,error:sceneGL.getError()};
}
module.exports={checkShipHulls};
