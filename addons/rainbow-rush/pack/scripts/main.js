import {world,system,ItemStack,ItemLockMode,GameMode,BlockPermutation,CommandPermissionLevel,CustomCommandStatus} from '@minecraft/server';
import {ActionFormData} from '@minecraft/server-ui';
import {HOME,MINE,ENTRANCES,MATERIALS,PICKS,newRound,inMine,segmentOf,cellIndex,entranceAir,materialAt,emptyBits,wasDug,markDug,encodeBits,decodeBits,newProfile,upgrade,claimWinner,signal,targets} from './rules.js';
import {courtyard} from './scenery.js';

let round,ready=false,generating=false,failed=false,courtyardReady=false,requestedSegments=4,extensionProbe=0;
const held=new Set(),busy=new Set(),votes=new Set(),returning=new Map(),feedback=new Map(),damage=new Map(),bitsCache=new Map(),dirtyBits=new Set(),nextHit=new Map(),perms=new Map();
const dim=()=>world.getDimension('overworld');
const inventory=p=>p.getComponent('minecraft:inventory')?.container;
const message=(p,t)=>p.sendMessage('§e'+t);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const itemToMaterial=new Map(Object.entries(MATERIALS).map(([id,m])=>[m.item,id]));
const blockToMaterial=new Map(Object.entries(MATERIALS).map(([id,m])=>[m.block,id]));
blockToMaterial.set('minecraft:flowing_water','water');blockToMaterial.set('minecraft:flowing_lava','lava');blockToMaterial.set('minecraft:obsidian','rock');blockToMaterial.set('minecraft:cobblestone','stone');
function hint(p,t){feedback.set(p.id,{text:t,until:system.currentTick+45});p.onScreenDisplay.setActionBar(t);}
function saveRound(){world.setDynamicProperty('rush:round',JSON.stringify(round));}
function bits(index){if(!bitsCache.has(index))bitsCache.set(index,decodeBits(String(world.getDynamicProperty('rush:dug_'+index)||'')));return bitsCache.get(index);}
function flush(){for(const index of dirtyBits)world.setDynamicProperty('rush:dug_'+index,encodeBits(bits(index)));dirtyBits.clear();}
function savePlayer(p,d){p.setDynamicProperty('rush:profile',JSON.stringify(d));}
function data(p){
 let d;try{d=JSON.parse(String(p.getDynamicProperty('rush:profile')||''));}catch{}
 if(!d||d.round!==round.id){const wins=d?.wins||0;d=newProfile(round.id);d.wins=wins;const c=inventory(p);if(c)for(let i=0;i<c.size;i++){const id=c.getItem(i)?.typeId;if(id&&(itemToMaterial.has(id)||id.startsWith('rush:')))c.setItem(i,undefined);}savePlayer(p,d);}
 return d;
}
function kit(p){
 const d=data(p),c=inventory(p);if(!c)return;
 let pickSlot=-1;for(let i=0;i<c.size;i++)if(c.getItem(i)?.typeId.startsWith('rush:pick_')){if(pickSlot<0)pickSlot=i;c.setItem(i,undefined);}
 const pick=new ItemStack('rush:pick_'+d.tier);pick.keepOnDeath=true;pick.lockMode=ItemLockMode.inventory;pick.setLore(['按住采矿 · 松开停止',`力量 ${PICKS[d.tier].damage} · 通道宽度 ${PICKS[d.tier].area}`]);
 if(pickSlot>=0)c.setItem(pickSlot,pick);else c.addItem(pick);
 for(let i=0;i<c.size;i++)if(c.getItem(i)?.typeId==='rush:pick_'+d.tier){if(i<9)p.selectedSlotIndex=i;else{const slot=p.selectedSlotIndex,old=c.getItem(slot);c.setItem(slot,c.getItem(i));c.setItem(i,old);}break;}
 for(const id of ['guide','return']){let has=false;for(let i=0;i<c.size;i++)if(c.getItem(i)?.typeId==='rush:'+id)has=true;if(!has){const item=new ItemStack('rush:'+id);item.keepOnDeath=true;item.lockMode=ItemLockMode.inventory;c.addItem(item);}}
}
function lobby(p,explain=false){
 if(!p.isValid)return;held.delete(p.id);returning.delete(p.id);p.setGameMode(GameMode.Adventure);p.teleport(HOME,{dimension:dim()});p.setSpawnPoint({...HOME,dimension:dim()});
 if(round)kit(p);p.removeEffect('slowness');p.addEffect('resistance',60,{amplifier:4,showParticles:false});
 if(explain)message(p,'彩虹矿井竞赛：选一条入口，按住镐子挖矿 → 左侧机器卖矿 → 右侧购买更好的镐子。第一个挖到彩虹矿石的人获胜！使用回城器可返回大厅。');
}
function atMachine(p,kind){return p.dimension.id==='minecraft:overworld'&&distance(p.location,{x:kind==='sell'?12:66,y:187,z:17})<10;}
function bagSummary(p){const c=inventory(p),counts={};if(c)for(let i=0;i<c.size;i++){const item=c.getItem(i),id=item&&itemToMaterial.get(item.typeId);if(id)counts[id]=(counts[id]||0)+item.amount;}return counts;}
function bagValue(counts){return Object.entries(counts).reduce((n,[id,count])=>n+MATERIALS[id].value*count,0);}
async function form(p,title,body,buttons){
 if(busy.has(p.id))return;held.delete(p.id);busy.add(p.id);
 try{const f=new ActionFormData().title(title).body(body);for(const [label, ,icon]of buttons)f.button(label,icon||'textures/items/book_normal');const r=await f.show(p);if(!r.canceled&&r.selection!==undefined&&p.isValid)buttons[r.selection]?.[1]();}
 catch{message(p,'请关闭聊天窗口后再打开菜单。');}finally{busy.delete(p.id);}
}
const later=fn=>{system.run(fn);};
function guide(p){
 if(!round)return;const d=data(p),bag=bagSummary(p);
 const buttons=[['矿石价目表',()=>later(()=>prices(p)),'textures/items/diamond'],['回到大厅 · 站定3秒',()=>recall(p),'textures/items/compass_item']];
 if(atMachine(p,'sell'))buttons.unshift(['使用矿石兑换机',()=>later(()=>exchange(p)),'textures/items/gold_ingot']);
 if(atMachine(p,'shop'))buttons.unshift(['使用镐子升级机',()=>later(()=>shop(p)),'textures/items/diamond_pickaxe']);
 if(round.winner)buttons.push([`再来一局 · 在线玩家全员同意 (${votes.size}/${world.getAllPlayers().length})`,()=>vote(p)]);
 form(p,'彩虹矿井 · 百万竞赛',`${round.winner?'本局冠军：'+round.winner.name:'目标：先挖到价值1,000,000金币的彩虹矿石'}\n\n你的金币 ${d.coins} · ${PICKS[d.tier].name} · 本局挖掘 ${d.mined}块\n背包矿物回收价值 ${bagValue(bag)}金币\n\n① 大厅三条入口通往同一矿井。\n② 对准矿层按住采矿，松开停止；平挖自动形成两格高通道。\n③ 左侧黄色机器兑换矿物，右侧蓝色机器升级镐子。\n④ 稀有矿位于深处，留意顶部彩虹信号。\n\n水会流动，岩浆会灼伤。矿物直接进入Minecraft背包；死亡保留材料。金币与装备各自独立。`,buttons);
}
function prices(p){form(p,'材料 · 硬度 / 单价',Object.values(MATERIALS).map(m=>`${m.name}：硬度 ${m.hardness} · ${m.value.toLocaleString()}金币`).join('\n')+'\n\n高阶镐子伤害更高，扩幅镐可同时开采三格宽通道。',['返回指南'].map(t=>[t,()=>later(()=>guide(p))]));}
function exchange(p){
 if(!atMachine(p,'sell')){message(p,'请前往大厅左侧黄色兑换机。');return;}
 const bag=bagSummary(p),id=round.id;
 form(p,'矿物兑换机',`${Object.entries(bag).map(([k,n])=>`${MATERIALS[k].name} ×${n} = ${MATERIALS[k].value*n}金币`).join('\n')||'背包里还没有可兑换的材料。'}\n\n合计 ${bagValue(bag)}金币`,[['兑换背包中的全部矿物',()=>{
  if(!atMachine(p,'sell')||round.id!==id)return;const c=inventory(p);if(!c)return;let total=0;for(let i=0;i<c.size;i++){const item=c.getItem(i),key=item&&itemToMaterial.get(item.typeId);if(key){total+=MATERIALS[key].value*item.amount;c.setItem(i,undefined);}}
  const d=data(p);d.coins+=total;savePlayer(p,d);message(p,`兑换成功！+${total}金币，余额 ${d.coins}。`);try{p.playSound('random.levelup',{volume:.6});}catch{}
 },'textures/items/gold_ingot']]);
}
function shop(p){
 if(!atMachine(p,'shop')){message(p,'请前往大厅右侧蓝色升级机。');return;}
 const d=data(p),next=PICKS[d.tier+1],id=round.id;
 form(p,'镐子升级机',`当前：${PICKS[d.tier].name} · 力量 ${PICKS[d.tier].damage} · ${PICKS[d.tier].area}格宽\n金币 ${d.coins}\n\n${next?`下一级：${next.name}\n力量 ${next.damage} · ${next.area}格宽\n价格 ${next.cost}金币`:'已达到最高等级，前往深层寻找彩虹矿石！'}`,next?[[`购买 ${next.name}`,()=>{
  if(!atMachine(p,'shop')||round.id!==id)return;const current=data(p);if(current.tier!==d.tier)return;if(!upgrade(current)){message(p,'金币不足，先去兑换矿石。');return;}savePlayer(p,current);kit(p);message(p,'升级成功！已装备 '+PICKS[current.tier].name);
 },'textures/items/'+next.icon]]:[['返回',()=>later(()=>guide(p))]]);
}
function recall(p){held.delete(p.id);returning.set(p.id,{start:{...p.location},until:system.currentTick+60});hint(p,'§b回城中：站定3秒，移动或开采会取消。');}
function vote(p){if(!round.winner)return;votes.add(p.id);world.sendMessage(`§e${p.name}同意开始新一局 (${votes.size}/${world.getAllPlayers().length})。`);const all=world.getAllPlayers();if(all.length&&all.every(q=>votes.has(q.id)))startRound();}
function startRound(){
 ready=false;requestedSegments=4;extensionProbe=0;held.clear();votes.clear();damage.clear();returning.clear();
 for(const area of round?.areas||[])try{dim().runCommand('tickingarea remove '+area);}catch{}const old=round?.generated||0;for(let i=0;i<=old;i++)world.setDynamicProperty('rush:dug_'+i,undefined);bitsCache.clear();dirtyBits.clear();
 round=newRound((round?.id||0)+1,Math.floor(Math.random()*0x7fffffff));saveRound();for(const p of world.getAllPlayers())lobby(p);
 world.sendMessage('§b新一局正在准备。金币、镐子与矿物重新开始，累计胜场保留。');grow();
}
function permutation(id){if(!perms.has(id))perms.set(id,BlockPermutation.resolve(id));return perms.get(id);}
function* fillSegment(index){
 const z0=40+index*16;
 for(const cmd of [`fill 15 179 ${z0} 64 179 ${z0+16} bedrock`,`fill 15 196 ${z0} 64 196 ${z0+16} bedrock`,`fill 15 180 ${z0} 15 195 ${z0+16} bedrock`,`fill 64 180 ${z0} 64 195 ${z0+16} bedrock`,`fill 16 180 ${z0+16} 63 195 ${z0+16} bedrock`])dim().runCommand(cmd);
 let count=0;const dug=bits(index);
 for(const z of [...Array.from({length:15},(_,i)=>z0+i+1),z0])for(let y=180;y<196;y++)for(let x=16;x<64;x++){
  const q={x,y,z};if(entranceAir(q)){markDug(dug,cellIndex(q));dirtyBits.add(index);}const air=wasDug(dug,cellIndex(q)),id=air?'minecraft:air':MATERIALS[materialAt(q,round)].block;
  let block=dim().getBlock(q);for(let wait=0;!block&&wait<200;wait++){yield;block=dim().getBlock(q);}if(!block)throw Error('Mine chunk unavailable at '+JSON.stringify(q));block.setPermutation(permutation(id));
  if(++count%128===0)yield;
 }
}
function grow(){
 if(generating||failed||!courtyardReady)return;const furthest=Math.max(40,...world.getAllPlayers().filter(p=>inMine(p.location)).map(p=>p.location.z));
 if(round.generated>=requestedSegments&&40+round.generated*16>furthest+48)return;
 generating=true;const index=round.generated,z=40+index*16,epoch=round.id;
 try{round.areas??=[];round.areaCounter=(round.areaCounter||0)+1;const area=`rush_gen_${round.id}_${round.areaCounter}`;dim().runCommand(`tickingarea add 15 179 ${z} 64 196 ${z+16} ${area} true`);round.areas.push(area);while(round.areas.length>3){const old=round.areas.shift();try{dim().runCommand('tickingarea remove '+old);}catch{}}saveRound();}catch(e){fail(e);return;}
 system.runTimeout(()=>{
  if(round.id!==epoch){generating=false;grow();return;}const work=fillSegment(index);const job=system.runInterval(()=>{try{
   if(round.id!==epoch){system.clearRun(job);generating=false;grow();return;}if(!work.next().done)return;system.clearRun(job);round.generated++;saveRound();generating=false;
   if(!ready&&round.generated>=4){ready=true;world.sendMessage('§a矿井已开放！选择任一入口开始比赛。');console.warn('RUSH_READY segments='+round.generated);for(const p of world.getAllPlayers())kit(p);}
   grow();
  }catch(e){system.clearRun(job);fail(e);}},1);
 },80);
}
function fail(e){failed=true;generating=false;console.warn('RUSH_BUILD_ERROR '+e);world.sendMessage('§c矿井生成遇到问题，请暂时留在大厅。');}
function mine(p){
 if(!ready||round.winner){hint(p,round?.winner?'§d比赛结束！打开指南可以投票再来一局。':'§e矿井准备中……');return;}
 returning.delete(p.id);const c=inventory(p);if(!c)return;const profile=data(p),selected=c.getItem(p.selectedSlotIndex)?.typeId;if(selected!=='rush:pick_'+profile.tier){held.delete(p.id);return;}
 const hit=p.getBlockFromViewDirection({maxDistance:5,includeLiquidBlocks:true});if(!hit)return;
 if(inMine(hit.block.location)&&segmentOf(hit.block.location.z)>=round.generated){hint(p,'§b前方矿层正在生成，请稍候片刻。');return;}
 if(!inMine(hit.block.location)){hint(p,'§7请对准矿层。大厅、支护墙和边界不可挖。');return;}
 const candidates=targets(hit.block.location,p.getViewDirection(),p.location,PICKS[profile.tier].area);
 for(const q of candidates){
  if(!inMine(q)||segmentOf(q.z)>=round.generated||distance(p.location,q)>6)continue;
  const b=dim().getBlock(q),kind=b&&blockToMaterial.get(b.typeId);if(!b||!kind)continue;
  const index=segmentOf(q.z),dug=bits(index),cell=cellIndex(q);if(wasDug(dug,cell)){if(b.isLiquid)b.setType('minecraft:air');continue;}
  const key=`${q.x},${q.y},${q.z}`,m=MATERIALS[kind];let state=damage.get(key);if(!state||state.kind!==kind)state={kind,hp:m.hardness,tick:system.currentTick};
  state.hp-=PICKS[profile.tier].damage;state.tick=system.currentTick;damage.set(key,state);
  if(state.hp>0){hint(p,`§b${m.name} §f${Math.ceil(state.hp)}/${m.hardness} · 价值 ${m.value}金币`);continue;}
  // Inventory insertion must succeed before changing the block or claiming the win.
  const item=new ItemStack(m.item);item.keepOnDeath=true;const left=c.addItem(item);if(left){state.hp=1;held.delete(p.id);hint(p,'§e背包已满！使用回城器，到兑换机卖矿。');break;}
  markDug(dug,cell);dirtyBits.add(index);b.setType('minecraft:air');damage.delete(key);profile.mined++;
  hint(p,`§a+${m.name} · ${m.value.toLocaleString()}金币 · 已进入背包`);
  try{p.playSound('dig.stone',{volume:.25,pitch:kind==='gem'?1.5:1});}catch{}
  if(kind==='rainbow'&&claimWinner(round,p.id,p.name)){
   profile.wins++;saveRound();flush();held.clear();world.sendMessage(`§d§l${p.name} 挖到了价值1,000,000金币的彩虹矿石，赢得本局！§r\n§e打开矿工指南，全员同意即可再来一局。`);
   for(const other of world.getAllPlayers())try{other.playSound('random.levelup',{volume:1,pitch:1.4});}catch{}break;
  }
 }
 savePlayer(p,profile);
}
function interact(p,id){
 if(!round)return;if(id==='rush:guide'){guide(p);return;}if(id==='rush:return'){recall(p);return;}
 if(id.startsWith('rush:pick_')){if(atMachine(p,'sell')){exchange(p);return;}if(atMachine(p,'shop')){shop(p);return;}held.add(p.id);returning.delete(p.id);mine(p);nextHit.set(p.id,system.currentTick+6);}
}
function second(){
 if(!round)return;const players=world.getAllPlayers();for(const p of players){
  p.addEffect('saturation',60,{amplifier:1,showParticles:false});if(inMine(p.location))p.addEffect('night_vision',400,{showParticles:false});
  if(p.dimension.id!=='minecraft:overworld'||p.location.y<175||(!inMine(p.location)&&(p.location.z>39||p.location.x<1||p.location.x>78)))lobby(p);
  if(!ready&&inMine(p.location)){lobby(p);continue;}
  const d=data(p),ret=returning.get(p.id);if(ret){if(distance(p.location,ret.start)>.7){returning.delete(p.id);hint(p,'§e移动取消了回城。');}else if(system.currentTick>=ret.until){lobby(p);message(p,'已返回大厅，左侧卖矿、右侧升级。');}}
  p.onScreenDisplay.setTitle(`§e${d.coins}金币 §f| ${PICKS[d.tier].name} | 深度${Math.max(0,Math.floor(p.location.z-40))}m | 彩虹信号${signal(p.location,round.rainbow)} §f| XYZ ${Math.floor(p.location.x)} ${Math.floor(p.location.y)} ${Math.floor(p.location.z)}`,{fadeInDuration:0,stayDuration:60,fadeOutDuration:0});
  const tip=feedback.get(p.id);if(!tip||tip.until<system.currentTick)p.onScreenDisplay.setActionBar(round.winner?'§d冠军 '+round.winner.name+' · 矿工指南：再来一局':!ready?'§b矿井准备中……':inMine(p.location)?'§f按住采矿 · 回城器返回大厅 · 先挖到彩虹矿石获胜':'§e左侧兑换矿物 ← 选择入口开始挖矿 → 右侧升级镐子');
 }
 grow();if(extensionProbe&&round.generated>=extensionProbe&&!generating){const q={x:20,y:180,z:40+(extensionProbe-1)*16+5};if(dim().getBlock(q)){console.warn('RUSH_EXTENSION_PASS segments='+round.generated);extensionProbe=0;requestedSegments=4;}}flush();for(const [k,d]of damage)if(system.currentTick-d.tick>600)damage.delete(k);
 // Unloaded segments are retained on disk, not held forever in script memory.
 if(bitsCache.size>24)for(const key of bitsCache.keys())if(!dirtyBits.has(key)&&Math.abs(key-round.generated)>8&&!players.some(p=>Math.abs(segmentOf(p.location.z)-key)<3))bitsCache.delete(key);
}
system.runInterval(()=>{for(const p of world.getAllPlayers())if(held.has(p.id)&&system.currentTick>=(nextHit.get(p.id)||0)){nextHit.set(p.id,system.currentTick+6);try{mine(p);}catch(e){held.delete(p.id);console.warn('RUSH_MINE_ERROR '+e);}}},2);
system.runInterval(second,20);
world.afterEvents.itemStartUse.subscribe(e=>{if(e.itemStack.typeId.startsWith('rush:'))interact(e.source,e.itemStack.typeId);});
world.afterEvents.itemStopUse.subscribe(e=>held.delete(e.source.id));
world.beforeEvents.playerInteractWithBlock.subscribe(e=>{if(atMachine(e.player,'sell')||atMachine(e.player,'shop')){e.cancel=true;const p=e.player;system.run(()=>atMachine(p,'sell')?exchange(p):shop(p));}});
world.afterEvents.playerSpawn.subscribe(e=>system.runTimeout(()=>lobby(e.player,true),40));
world.afterEvents.playerLeave.subscribe(e=>{held.delete(e.playerId);busy.delete(e.playerId);returning.delete(e.playerId);feedback.delete(e.playerId);nextHit.delete(e.playerId);votes.delete(e.playerId);});
system.beforeEvents.startup.subscribe(e=>{for(const [name,fn]of Object.entries({menu:guide,return:recall}))e.customCommandRegistry.registerCommand({name:'rush:'+name,description:name==='menu'?'矿工指南':'站定3秒返回大厅',permissionLevel:CommandPermissionLevel.Any},o=>{if(o.sourceEntity?.typeId==='minecraft:player')system.run(()=>fn(o.sourceEntity));return {status:CustomCommandStatus.Success};});});
world.afterEvents.worldLoad.subscribe(()=>system.runTimeout(()=>{
 try{
  const raw=world.getDynamicProperty('rush:round');round=raw?JSON.parse(String(raw)):newRound(1,Math.floor(Math.random()*0x7fffffff));saveRound();
  for(const cmd of ['gamerule doMobSpawning false','gamerule doDaylightCycle false','gamerule doWeatherCycle false','gamerule doFireTick false','gamerule keepInventory true','gamerule pvp false','gamerule mobGriefing false','gamerule naturalRegeneration true','time set 6000','weather clear','setworldspawn 40 187 9'])dim().runCommand(cmd);
  try{dim().runCommand('tickingarea remove rush_generation');}catch{}
  try{dim().runCommand('tickingarea add 0 180 0 79 205 39 rush_lobby true');}catch{}
  system.runTimeout(()=>{
   const list=world.getDynamicProperty('rush:lobbyBuilt')?[]:courtyard();let i=0;
   const job=system.runInterval(()=>{try{
    for(let n=0;n<5&&i<list.length;n++,i++)dim().runCommand(list[i]);if(i<list.length)return;system.clearRun(job);world.setDynamicProperty('rush:lobbyBuilt',true);
    for(const e of dim().getEntities({tags:['rush_marker']}))e.remove();
    for(const [name,x,z]of [['§6矿物兑换机 · 使用镐子/指南',12,17],['§b镐子升级机 · 使用镐子/指南',66,17],['§b一号矿口',24,30],['§6二号矿口',40,30],['§d三号矿口',56,30],['§d百万彩虹矿石 · 首个挖到者获胜',40,6]]){const e=dim().spawnEntity('minecraft:armor_stand',{x:Number(x)+.5,y:187,z:Number(z)+.5});e.nameTag=String(name);e.addTag('rush_marker');}
    courtyardReady=true;for(const p of world.getAllPlayers())lobby(p,true);if(round.generated>=4){ready=true;console.warn('RUSH_READY segments='+round.generated);}else grow();
   }catch(e){system.clearRun(job);fail(e);}},1);
  },60);
 }catch(e){fail(e);}
},60));
system.afterEvents.scriptEventReceive.subscribe(e=>{if(e.sourceEntity)return;if(e.id==='rush:extendcheck'&&ready){extensionProbe=round.generated+2;requestedSegments=extensionProbe;grow();return;}if(e.id!=='rush:smoke')return;try{
 if(!ready||!round||round.generated<4)throw Error('not ready');for(const m of Object.values(MATERIALS)){BlockPermutation.resolve(m.block);new ItemStack(m.item);}for(let i=0;i<PICKS.length;i++)new ItemStack('rush:pick_'+i);
 if(dim().getEntities({tags:['rush_marker']}).length!==6)throw Error('lobby markers missing');if(dim().getBlock({x:40,y:186,z:9})?.typeId!=='minecraft:smooth_stone')throw Error('lobby floor missing');
 console.warn('RUSH_SMOKE_PASS materials=10 picks=6 entrances=3 segments='+round.generated);
 }catch(err){console.warn('RUSH_SMOKE_FAIL '+err);}});
