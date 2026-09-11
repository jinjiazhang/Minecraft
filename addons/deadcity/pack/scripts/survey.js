import {system,world} from '@minecraft/server';
let active=false;
export function survey(){
 if(active)return;active=true;let tile=0;
 const d=world.getDimension('overworld'),stamp=system.currentTick;
 function next(){
  if(tile>=56){active=false;console.warn('DEADCITY_SURVEY_DONE');return;}
  const i=tile++,x=-7100+i%8*64,z=-6800+Math.floor(i/8)*64,name='dead_audit_'+stamp+'_'+i;
  try{d.runCommand(`tickingarea add circle ${x+32} 64 ${z+32} 3 ${name} true`);}catch(e){active=false;console.warn('DEADCITY_SURVEY_FAIL '+e);return;}
  system.runTimeout(()=>{
   let col=0;
   function read(){
    for(let step=0;step<8&&col<64;step++,col++){
     if(x+col>-6650)continue;const heights=[];
     for(let k=0;k<64&&z+k<=-6400;k++){try{const b=d.getTopmostBlock({x:x+col,z:z+k});heights.push(b?b.y:-999);}catch{heights.push(-999);}}
     if(heights.length)console.warn('DEADCITY_HEIGHT '+JSON.stringify([x+col,z,heights]));
    }
    if(col<64)system.runTimeout(read,1);else{d.runCommand('tickingarea remove '+name);system.runTimeout(next,1);}
   }read();
  },20);
 }next();
}
