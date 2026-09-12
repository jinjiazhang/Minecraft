// Hand-built industrial mining courtyard. All construction stays outside excavatable strata.
export function courtyard(){
 const q=[],f=(x,y,z,a,b,c,block)=>q.push(`fill ${x} ${y} ${z} ${a} ${b} ${c} ${block}`);
 for(let x=0;x<80;x+=16){f(x,185,0,x+15,185,39,'bedrock');f(x,186,0,x+15,186,39,'polished_andesite');f(x,187,0,x+15,205,39,'air');}
 f(0,187,0,79,189,0,'deepslate_tiles');f(0,187,0,0,195,39,'deepslate_bricks');f(79,187,0,79,195,39,'deepslate_bricks');
 // Warm perimeter lighting, alternating paving and central approach.
 f(35,186,2,45,186,35,'smooth_stone');
 for(let z=4;z<38;z+=6)for(const x of [3,76]){f(x,187,z,x,191,z,'dark_oak_fence');f(x,192,z,x,192,z,'lantern');}
 for(let z=5;z<35;z+=6)for(const x of [32,48])f(x,186,z,x,186,z,'sea_lantern');
 for(const [rawX,color]of [[24,'cyan'],[40,'orange'],[56,'purple']]){const x=Number(rawX);
  f(x-7,187,32,x+7,202,39,'deepslate_bricks');f(x-5,190,32,x+5,200,38,'stone');
  f(x-2,187,32,x+2,191,39,'air');f(x-3,187,32,x-3,192,35,'stripped_dark_oak_log');f(x+3,187,32,x+3,192,35,'stripped_dark_oak_log');
  f(x-3,192,32,x+3,192,35,'dark_oak_planks');f(x-2,194,31,x+2,194,31,color+'_concrete');
  f(x,193,33,x,193,33,'lantern');f(x-1,186,20,x+1,186,39,'dark_oak_planks');
  for(let z=22;z<39;z++)f(x,187,z,x,187,z,'rail');
  for(const xx of [x-5,x+5]){f(xx,187,31,xx,188,31,'polished_blackstone_bricks');f(xx,189,31,xx,189,31,'lantern');}
 }
 // Exchange machine at the west, tool shop at the east. Walk-in counters with colored displays.
 for(const [rawX,color]of [[12,'yellow'],[66,'light_blue']]){const x=Number(rawX);
  f(x-6,186,8,x+6,186,22,'dark_oak_planks');f(x-6,187,8,x-6,192,22,'stripped_spruce_log');f(x+6,187,8,x+6,192,22,'stripped_spruce_log');
  f(x-6,193,8,x+6,193,22,'dark_oak_planks');f(x-7,194,7,x+7,194,23,'deepslate_tile_slab');
  f(x-4,187,12,x+4,189,14,'polished_blackstone');f(x-3,190,13,x+3,192,13,'iron_block');
  f(x-2,190,12,x+2,191,12,color+'_stained_glass');f(x-2,190,13,x+2,191,13,'sea_lantern');
  f(x,187,11,x,187,11,'hopper');f(x-4,190,14,x-4,190,14,'lantern');f(x+4,190,14,x+4,190,14,'lantern');
 }
 f(9,187,19,10,188,20,'barrel');f(15,187,20,16,187,21,'gold_block');f(62,187,19,63,188,20,'smithing_table');f(69,187,19,70,187,20,'anvil');
 // Timber stacks, ore carts, chain hoist and competition podium.
 for(const x of [7,70]){f(x,187,27,x+2,188,29,'oak_log');f(x,189,28,x+2,189,28,'stripped_oak_log');}
 f(36,187,3,44,187,5,'quartz_block');f(39,188,3,41,188,5,'gold_block');
 for(const x of [18,62]){f(x,196,34,x,201,34,'iron_chain');f(x,195,34,x,195,34,'lantern');}
 return q;
}
