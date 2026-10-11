/* Pre-rendered pictures of the live models, packed into one local atlas. */
'use strict';
const Catalog = (() => {
  const PATH='previews/catalog.webp',COLS=12,CELL_W=128,CELL_H=96,ENTRIES=[];
  for(let i=0;i<11;i++)for(const view of ['a','b'])ENTRIES.push({key:'equipment/u'+i+view,model:'u'+i,
    yaw:view==='a'?2.4:1.4,w:view==='a'?60:30,h:view==='a'?36:18});
  for(let i=0;i<44;i++)ENTRIES.push({key:'equipment/slot_'+i,model:'equipment_'+i,yaw:2.4,w:32,h:24});
  for(let i=0;i<42;i++)ENTRIES.push({key:'cargo_'+i,model:i<18?'creature_'+i:'goods_'+i,yaw:2.4,w:32,h:24});
  async function load(images){
    const atlas=await Assets.picture(PATH);
    if(atlas.width!==COLS*CELL_W||atlas.height!==Math.ceil(ENTRIES.length/COLS)*CELL_H)
      throw new Error('Catalogue atlas dimensions do not match its entries');
    ENTRIES.forEach((entry,i)=>{
      const canvas=document.createElement('canvas');canvas.width=CELL_W;canvas.height=CELL_H;
      canvas.uiWidth=entry.w;canvas.uiHeight=entry.h;
      canvas.getContext('2d').drawImage(atlas,i%COLS*CELL_W,Math.floor(i/COLS)*CELL_H,CELL_W,CELL_H,0,0,CELL_W,CELL_H);
      images[entry.key]=canvas;
    });
  }
  return {PATH,COLS,CELL_W,CELL_H,ENTRIES,load};
})();
