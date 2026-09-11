import {world} from '@minecraft/server';
const key='dead:barriers';
function read(){try{return JSON.parse(String(world.getDynamicProperty(key)||'[]'));}catch{return[];}}
export function clearBarriers(force=false){
 const keep=[];for(const b of read()){
  if(!force&&b.until>Date.now()){keep.push(b);continue;}
  try{const block=world.getDimension('overworld').getBlock(b);if(!block){keep.push(b);continue;}if(block.typeId==='minecraft:nether_brick_fence')block.setType('minecraft:air');}catch{keep.push(b);}
 }
 world.setDynamicProperty(key,JSON.stringify(keep));
}
export function barricade(p){
 const d=world.getDimension('overworld'),v=p.getViewDirection(),alongX=Math.abs(v.x)>=Math.abs(v.z),records=read();
 if(records.length>=48)return false;
 const cx=Math.floor(p.location.x)-(alongX?Math.sign(v.x)*2:0),cz=Math.floor(p.location.z)-(alongX?0:Math.sign(v.z)*2),cells=[];
 for(let i=-1;i<=1;i++){
  const x=cx+(alongX?0:i),z=cz+(alongX?i:0),top=d.getTopmostBlock({x,z});if(!top||Math.abs(top.y+1-p.location.y)>2)return false;
  const pos={x,y:top.y+1,z},block=d.getBlock(pos);if(!block||!block.isAir)return false;cells.push(pos);
 }
 // Persist air-only restoration before mutation; restarts clean these placements.
 const pending=cells.map(p=>({...p,until:Date.now()+18000}));world.setDynamicProperty(key,JSON.stringify([...records,...pending]));
 for(const pos of cells)d.getBlock(pos).setType('minecraft:nether_brick_fence');
 return true;
}
