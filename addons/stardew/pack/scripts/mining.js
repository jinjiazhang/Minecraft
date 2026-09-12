export const PICKAXES=[{name:'基础镐',damage:1,cost:0},{name:'铜镐',damage:2,cost:100},{name:'钢镐',damage:4,cost:300},{name:'铱级镐',damage:7,cost:900}];
export const BAG_COSTS=[0,80,200,500];
export const ORES={dirt:{name:'泥土',block:'dirt',hp:1,sell:1},stone:{name:'石块',block:'stone',hp:4,sell:2},copper:{name:'铜矿',block:'copper_ore',hp:5,sell:5},iron:{name:'铁矿',block:'iron_ore',hp:8,sell:10},gold:{name:'金矿',block:'gold_ore',hp:12,sell:25},amethyst:{name:'紫水晶',block:'amethyst_block',hp:16,sell:100},diamond:{name:'钻石',block:'diamond_ore',hp:22,sell:150}};
export const ROOMS=[{name:'浅层矿道',x:140,z:36,tier:0,ores:['dirt','stone','copper','dirt','stone','copper']},{name:'铁矿层',x:156,z:36,tier:1,ores:['copper','iron','iron','stone','iron','gold']},{name:'黄金矿层',x:172,z:36,tier:2,ores:['iron','gold','gold','amethyst','gold','amethyst']},{name:'晶洞深层',x:156,z:56,tier:3,ores:['gold','amethyst','diamond','diamond','amethyst','diamond']}];
export const NODES=ROOMS.flatMap((r,room)=>r.ores.map((ore,i)=>({key:`${room}:${i}`,room,ore,x:r.x+3+i%3*3,y:171,z:r.z+4+Math.floor(i/3)*4,amount:i===5?3:1})));
export const newMiner=()=>({pick:0,bagLevel:0,bag:{},broken:0,earned:0});
export function miner(raw){try{const m=JSON.parse(raw);if(m&&Number.isInteger(m.pick)&&m.pick>=0&&m.pick<4&&Number.isInteger(m.bagLevel)&&m.bagLevel>=0&&m.bagLevel<4&&m.bag&&Object.entries(m.bag).every(([id,n])=>ORES[id]&&Number.isInteger(n)&&n>=0))return m;}catch{}return newMiner();}
export const capacity=m=>20+m.bagLevel*20;
export const load=m=>Object.values(m.bag).reduce((a,b)=>a+b,0);
export const value=m=>Object.entries(m.bag).reduce((sum,[id,n])=>sum+ORES[id].sell*n,0);
export const stamp=s=>(((s.year-1)*112+s.season*28+s.day-1)*1440+s.minute);
export function hitNode(m,node,deposit,energy,time){
 if(m.pick<ROOMS[node.room].tier)return {ok:false,message:'镐子等级不足。'};
 if(deposit.hp<=0)return {ok:false,message:'矿脉恢复中，去挖旁边的矿石。'};
 if(load(m)+node.amount>capacity(m))return {ok:false,message:'矿包空间不足，打开日记回收或存入农场背包。'};
 if(energy<1)return {ok:false,message:'体力不足，回农舍休息。'};
 deposit.hp=Math.max(0,deposit.hp-PICKAXES[m.pick].damage);
 if(deposit.hp>0)return {ok:true,broken:false,message:`${ORES[node.ore].name} 硬度 ${deposit.hp}/${ORES[node.ore].hp}`};
 m.bag[node.ore]=(m.bag[node.ore]||0)+node.amount;m.broken++;deposit.regen=time+60;
 return {ok:true,broken:true,message:`获得${ORES[node.ore].name} ×${node.amount}（${ORES[node.ore].sell*node.amount}g）· 矿包 ${load(m)}/${capacity(m)}`};
}
export function upgrade(m,farm,kind){const level=kind==='pick'?m.pick:m.bagLevel,cost=kind==='pick'?PICKAXES[level+1]?.cost:BAG_COSTS[level+1];if(!cost||farm.gold<cost)return false;farm.gold-=cost;if(kind==='pick')m.pick++;else m.bagLevel++;return true;}
export function sell(m,farm){const income=value(m);farm.gold+=income;m.earned+=income;m.bag={};return income;}
export function unload(m,farm){for(const [id,n]of Object.entries(m.bag))farm.bag[id]=(farm.bag[id]||0)+n;m.bag={};}
export function roomAt(p){if(p.y<170||p.y>179)return -1;return ROOMS.findIndex(r=>p.x>=r.x&&p.x<=r.x+13&&p.z>=r.z&&p.z<=r.z+13);}
export function chamberCommands(){const list=[];for(const r of ROOMS){list.push(`fill ${r.x} 169 ${r.z} ${r.x+13} 178 ${r.z+13} bedrock`,`fill ${r.x+1} 170 ${r.z+1} ${r.x+12} 177 ${r.z+12} air`,`fill ${r.x+1} 170 ${r.z+1} ${r.x+12} 170 ${r.z+12} polished_andesite`,`fill ${r.x+1} 177 ${r.z+1} ${r.x+12} 177 ${r.z+12} sea_lantern`);}return list;}
