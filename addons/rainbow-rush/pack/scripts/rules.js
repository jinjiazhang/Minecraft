export const HOME={x:40.5,y:187,z:9.5};
export const MINE={minX:16,maxX:63,minY:180,maxY:195,startZ:40,segment:16,cells:12288};
export const ENTRANCES=[24,40,56];
export const MATERIALS={
 dirt:{name:'泥土',block:'minecraft:dirt',item:'minecraft:dirt',hardness:1,value:1},
 stone:{name:'石头',block:'minecraft:stone',item:'minecraft:cobblestone',hardness:4,value:3},
 rock:{name:'坚硬岩石',block:'minecraft:deepslate',item:'minecraft:cobbled_deepslate',hardness:10,value:8},
 wood:{name:'古木',block:'minecraft:oak_log',item:'minecraft:oak_log',hardness:3,value:5},
 iron:{name:'铁块',block:'minecraft:iron_block',item:'minecraft:iron_block',hardness:16,value:35},
 gold:{name:'黄金',block:'minecraft:gold_block',item:'minecraft:gold_block',hardness:28,value:120},
 gem:{name:'宝石',block:'minecraft:diamond_ore',item:'minecraft:diamond',hardness:48,value:500},
 water:{name:'地下水',block:'minecraft:water',item:'minecraft:water_bucket',hardness:1,value:2},
 lava:{name:'岩浆',block:'minecraft:lava',item:'minecraft:lava_bucket',hardness:3,value:15},
 rainbow:{name:'彩虹矿石',block:'rush:rainbow_ore',item:'rush:rainbow_gem',hardness:180,value:1000000}
};
export const PICKS=[
 {name:'矿工木镐',damage:1,area:1,cost:0,icon:'wood_pickaxe'},
 {name:'精钢镐',damage:3,area:1,cost:120,icon:'iron_pickaxe'},
 {name:'金刚镐',damage:7,area:1,cost:650,icon:'diamond_pickaxe'},
 {name:'扩幅矿镐',damage:10,area:3,cost:3000,icon:'gold_pickaxe'},
 {name:'重型破岩镐',damage:24,area:3,cost:12000,icon:'netherite_pickaxe'},
 {name:'彩虹勘探镐',damage:50,area:3,cost:40000,icon:'netherite_pickaxe'}
];
export function hash(x,y,z,seed){let n=Math.imul(x+17,374761393)^Math.imul(y+43,668265263)^Math.imul(z+73,2147483647)^seed;n=Math.imul(n^(n>>>13),1274126177);return (n^(n>>>16))>>>0;}
export function newRound(id,seed){return {id,seed,generated:0,winner:null,rainbow:{x:20+hash(1,2,3,seed)%40,y:183+hash(3,2,1,seed)%8,z:240+hash(7,8,9,seed)%96}};}
export const inMine=q=>q.x>=16&&q.x<64&&q.y>=180&&q.y<196&&q.z>=40;
export const segmentOf=z=>Math.floor((z-40)/16);
export const cellIndex=q=>(q.z-40)%16*768+(q.y-180)*48+q.x-16;
export function entranceAir(q){return q.z<49&&q.y>=187&&q.y<=189&&ENTRANCES.some(x=>Math.abs(q.x-x)<=1);}
export function materialAt(q,r){
 if(q.x===r.rainbow.x&&q.y===r.rainbow.y&&q.z===r.rainbow.z)return 'rainbow';
 const depth=q.z-40,coarse=hash(Math.floor(q.x/3),Math.floor(q.y/3),Math.floor(q.z/3),r.seed)%1000;
 // Contiguous 3-block mineral pockets, with tougher and richer strata deeper in the mine.
 if(depth>80&&coarse<4)return 'lava';
 if(coarse>=4&&coarse<9)return 'water';
 if(depth>90&&coarse<30)return 'gem';
 if(depth>32&&coarse>=30&&coarse<65)return 'gold';
 if(coarse>=65&&coarse<130)return 'iron';
 if(coarse>=130&&coarse<160)return 'wood';
 if(depth<50)return coarse<630?'dirt':'stone';
 if(depth<130)return coarse<420?'dirt':coarse<810?'stone':'rock';
 return coarse<270?'dirt':coarse<580?'stone':'rock';
}
export const emptyBits=()=>new Uint32Array(384);
export const wasDug=(bits,index)=>(bits[index>>>5]&(1<<(index&31)))!==0;
export function markDug(bits,index){bits[index>>>5]|=1<<(index&31);}
export const encodeBits=bits=>JSON.stringify(Array.from(bits));
export function decodeBits(raw){if(!raw)return emptyBits();const a=JSON.parse(raw);if(!Array.isArray(a)||a.length!==384||a.some(n=>!Number.isInteger(n)))throw Error('Invalid mine persistence');return new Uint32Array(a);}
export const newProfile=round=>({round,coins:0,tier:0,mined:0,wins:0});
export function upgrade(p){const next=PICKS[p.tier+1];if(!next||p.coins<next.cost)return false;p.coins-=next.cost;p.tier++;return true;}
export function claimWinner(round,playerId,name){if(round.winner)return false;round.winner={id:playerId,name};return true;}
export function signal(q,target){const d=Math.hypot(q.x-target.x,q.y-target.y,q.z-target.z);return d<12?'§d极强':d<35?'§b强烈':d<80?'§e增强':'§7微弱';}
export function targets(hit,view,feet,area){
 const result=[],radius=area===3?1:0;
 if(Math.abs(view.y)>.72){for(let a=-radius;a<=radius;a++)for(let b=-radius;b<=radius;b++)result.push({x:hit.x+a,y:hit.y,z:hit.z+b});}
 else {const foot=Math.floor(feet.y),ys=hit.y===foot||hit.y===foot+1?[foot,foot+1]:[hit.y];for(let a=-radius;a<=radius;a++)for(const y of ys)result.push({x:hit.x+(Math.abs(view.z)>=Math.abs(view.x)?a:0),y,z:hit.z+(Math.abs(view.x)>Math.abs(view.z)?a:0)});}
 return result.sort((a,b)=>(a.x-hit.x)**2+(a.y-hit.y)**2+(a.z-hit.z)**2-((b.x-hit.x)**2+(b.y-hit.y)**2+(b.z-hit.z)**2));
}
