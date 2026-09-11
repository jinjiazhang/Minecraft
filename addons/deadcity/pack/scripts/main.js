import {world,system,Player,ItemStack,ItemLockMode,GameMode,EntityDamageCause,CommandPermissionLevel,CustomCommandStatus} from '@minecraft/server';
import {ActionFormData} from '@minecraft/server-ui';
import {survey} from './survey.js';
import {ROUTES} from './routes.js';
import {barricade,clearBarriers} from './barriers.js';
import {BASE,LIMITS,ROUND_SECONDS,WEAPONS,SITES,EXITS,TYPES,dist,inside,profile,newRaid,collect,settle,purchase,reload,finishReload,takeShot,detectionRadius,extraction} from './rules.js';
const raids=new Map(),mobs=new Map(),points=new Map(),busy=new Set(),lures=[],lastShooter=new Map();
let prepared=false,seconds=0,lastError=-10000;
const dim=()=>world.getDimension('overworld');
const now=()=>system.currentTick;
function fault(e){if(now()-lastError>200){console.warn('DEADCITY_ERROR '+e);lastError=now();}}
const data=p=>profile(String(p.getDynamicProperty('dead:profile')||''));
const save=(p,v)=>p.setDynamicProperty('dead:profile',JSON.stringify(v));
function health(p){const h=p.getComponent('minecraft:health');if(h)h.setCurrentValue(h.effectiveMax);}
function sound(p,id,pitch=1){try{p.playSound(id,{pitch,volume:.7});}catch{}}
function container(p){return p.getComponent('minecraft:inventory')?.container;}
function selected(p){return container(p)?.getItem(p.selectedSlotIndex)?.typeId;}
function equipGun(p){
 const c=container(p);if(!c)return false;
 for(let i=0;i<c.size;i++)if(c.getItem(i)?.typeId==='dead:gun'){
  if(i<9)p.selectedSlotIndex=i;
  else{const slot=p.selectedSlotIndex,old=c.getItem(slot),gun=c.getItem(i);c.setItem(slot,gun);c.setItem(i,old);}
  return true;
 }
 p.sendMessage('§e请先在背包留出空位，再打开无线电领取枪械。');return false;
}
function kit(p){
 const c=container(p);if(!c)return;
 for(const [id,name] of [['gun',WEAPONS[data(p).tier].name],['radio','无线电 · 任务 / 升级'],['reload','弹匣 · 使用换弹'],['medkit','医疗包 · 使用治疗'],['lure','诱饵 · 使用投掷']]){
  let slot=-1;for(let i=0;i<c.size;i++)if(c.getItem(i)?.typeId==='dead:'+id){slot=i;break;}
  const item=new ItemStack('dead:'+id);item.nameTag=name;item.keepOnDeath=true;item.lockMode=ItemLockMode.inventory;
  item.setLore(['末日赫尔辛基','右键 / 长按使用；也可通过无线电操作']);
  if(slot>=0)c.setItem(slot,item);else if(c.addItem(item))p.sendMessage('§e背包已满，请留出 5 个空位后输入 /dead:menu 领取工具。');
 }
}
function base(p,message=''){
 if(!p.isValid)return;
 const was=raids.get(p.id);if(was)save(p,settle(data(p),was,false));
 raids.delete(p.id);p.setDynamicProperty('dead:inRaid',false);p.removeTag('dead_active');
 p.setGameMode(GameMode.Adventure);p.teleport(BASE,{dimension:dim()});p.setSpawnPoint({...BASE,dimension:dim()});
 p.removeEffect('slowness');
 p.addEffect('resistance',100,{amplifier:4,showParticles:false});health(p);kit(p);
 if(message)p.sendMessage(message);
}
function start(p){
 if(!prepared){p.sendMessage('§e城区正在准备，请稍后重试。');return;}
 if(raids.has(p.id))return;
 base(p);if(!equipGun(p))return;const r=newRaid(data(p).tier,now());raids.set(p.id,r);p.setDynamicProperty('dead:inRaid',true);p.addTag('dead_active');
 p.sendMessage('§b枪械已装备。iPad：按住「开火」按钮，松开停止；电脑：按住右键。基地内禁止开火。');
 p.sendMessage('§6行动开始 · 20 分钟\n§f潜行停在补给标记旁 3 秒搜集。搜集 3 处可获额外奖励；到任一绿色撤离点停留 12 秒带回物资。\n§e枪声会引来尸群；无线电可查看目标和退出。');
}
function finish(p){const r=raids.get(p.id);if(!r)return;const before=data(p),after=settle(before,r,true);save(p,after);raids.delete(p.id);base(p,`§a撤离成功！带回 ${after.scrap-before.scrap} 零件，累计 ${after.scrap}。`);sound(p,'random.levelup');}
function heal(p){const r=raids.get(p.id),h=p.getComponent('minecraft:health');if(!r||r.meds<=0||!h||h.currentValue>=h.effectiveMax)return;h.setCurrentValue(Math.min(h.effectiveMax,h.currentValue+10));r.meds--;sound(p,'random.drink');}
function lure(p){
 const r=raids.get(p.id);if(!r||r.lures<=0)return;
 const h=p.getHeadLocation(),v=p.getViewDirection(),hit=dim().getBlockFromRay(h,v,{maxDistance:14,includeLiquidBlocks:false,includePassableBlocks:false});
 const n=hit?Math.max(2,dist(h,hit.block.location)-1):12;
 const q={x:h.x+v.x*n,z:h.z+v.z*n};let top;try{top=dim().getTopmostBlock(q);}catch{}
 if(!top)return;r.lures--;lures.push({...q,y:top.y+1,until:now()+180});sound(p,'random.orb');
 p.sendMessage('§b诱饵开始发声，附近尸群将被吸引约 9 秒。');
}
function blockEscape(p){const r=raids.get(p.id);if(!r||r.barriers<=0||dist(p.location,BASE)<30)return;if(barricade(p)){r.barriers--;p.sendMessage('§b身后已放置临时路障，18 秒后移除。');}else p.sendMessage('§e身后空间不足，换一处平坦位置再试。');}
function shoot(p){
 const r=raids.get(p.id);if(!r||dist(p.location,BASE)<26)return;
 if(!r.ammo){reload(r,now());return;}
 if(!takeShot(r,now()))return;
 const w=WEAPONS[r.tier],head=p.getHeadLocation(),view=p.getViewDirection();
 sound(p,'crossbow.shoot',r.tier===1?.7:1.2);
 const damage=new Map();
 for(let i=0;i<w.pellets;i++){
  const spread=w.pellets>1?.11:0,v={x:view.x+(Math.random()-.5)*spread,y:view.y+(Math.random()-.5)*spread,z:view.z+(Math.random()-.5)*spread};
  const norm=Math.hypot(v.x,v.y,v.z);v.x/=norm;v.y/=norm;v.z/=norm;
  // Entity rays are clipped explicitly by the first solid block: no shooting through walls.
  const block=dim().getBlockFromRay(head,v,{maxDistance:w.range,includeLiquidBlocks:false,includePassableBlocks:false});
  let max=w.range;if(block){const b=block.block.location,f=block.faceLocation;max=Math.hypot(b.x+f.x-head.x,b.y+f.y-head.y,b.z+f.z-head.z);}
  const hits=dim().getEntitiesFromRay(head,v,{maxDistance:max,ignoreBlockCollision:false}).filter(h=>h.entity.typeId.startsWith('dead:')).sort((a,b)=>a.distance-b.distance);
  const hit=hits[0];if(hit){const prior=damage.get(hit.entity.id);damage.set(hit.entity.id,{entity:hit.entity,value:(prior?.value||0)+w.damage});}
 }
 for(const {entity,value} of damage.values()){
  lastShooter.set(entity.id,{id:p.id,tick:now()});
  const h=entity.getComponent('minecraft:health'),expected=Math.max(0,(h?.currentValue||0)-value);
  entity.applyDamage(value,{cause:EntityDamageCause.entityAttack,damagingEntity:p});
  // Bedrock hurt immunity must not erase automatic fire or shotgun pellets.
  if(entity.isValid&&h&&h.currentValue>expected)h.setCurrentValue(expected);
  const m=mobs.get(entity.id);if(m)m.alertUntil=now()+160;
  try{entity.applyKnockback({x:view.x*.18,z:view.z*.18},.03);}catch{}
  sound(p,'random.orb',1.8);
 }
}
async function menu(p){
 if(!p.isValid||busy.has(p.id))return;busy.add(p.id);
 const active=raids.get(p.id);if(active)active.holding=false;
 try{
 kit(p);const r=raids.get(p.id),d=data(p),w=WEAPONS[d.tier];
 const form=new ActionFormData().title('末日赫尔辛基').body(r?`行动中 · 物资 ${r.bag} / 已搜集 ${r.looted.length}/5\n医疗 ${r.meds} · 诱饵 ${r.lures}\n蹲下搜索补给；绿色标记处等待撤离。`:`Linnanmäki 幸存者基地\n零件 ${d.scrap} · 成功撤离 ${d.wins} 次\n当前武器：${w.name}\n\n开火：持枪按住使用；空弹匣自动换弹。\n跑步消耗体力，蹲行更安静，绕墙可脱离追踪。\n死亡或放弃丢失本轮物资，永久升级保留。`);
 if(r){form.button('查看补给与撤离坐标').button('换弹').button(`治疗（${r.meds}）`).button(`投掷诱饵（${r.lures}）`).button(`身后放置路障（${r.barriers}）`).button('放弃本轮 · 返回基地');}
 else{form.button('开始搜集行动 · 20 分钟').button(d.tier<4?`升级：${WEAPONS[d.tier+1].name} · ${WEAPONS[d.tier+1].cost} 零件`:'火力已升至最高').button('玩法说明');}
 const answer=await form.show(p);if(answer.canceled||!p.isValid)return;
 // A form can outlive death, disconnect or another command; reject stale state.
 if(raids.get(p.id)!==r)return;
 if(r){switch(answer.selection){
  case 0:p.sendMessage([...SITES.map(s=>`${r.looted.includes(s.id)?'§8已搜集':'§e补给'} ${s.name}：${s.x}, ${s.z}`),...EXITS.map(s=>`§a${s.name}：${s.x}, ${s.z}`)].join('\n'));break;
  case 1:reload(r,now());break;case 2:heal(p);break;case 3:lure(p);break;
  case 4:blockEscape(p);break;case 5:base(p,'§e本轮已放弃，未带出的物资已丢失。');break;
 }}else if(answer.selection===0)start(p);else if(answer.selection===1){const upgraded=purchase(data(p));if(upgraded){save(p,upgraded);kit(p);p.sendMessage('§a已升级为 '+WEAPONS[upgraded.tier].name);}else p.sendMessage('§e零件不足或已达到最高等级。');}
 else p.sendMessage('§f1. 出城搜集零件。2. 按住使用开火；用弹匣换弹。3. 蹲行避敌，诱饵引开追兵。4. 搜集三处后前往绿色撤离点，停留 12 秒。\n§e失败只丢本轮物资；/dead:menu 随时打开无线电。');
 }catch(e){fault(e);}finally{busy.delete(p.id);}
}
function control(p,id){if(id==='dead:radio'){void menu(p);return;}const r=raids.get(p.id);if(!r)return;
 if(id==='dead:gun'){r.holding=true;shoot(p);}if(id==='dead:reload')reload(r,now());if(id==='dead:medkit')heal(p);if(id==='dead:lure')lure(p);
}
world.afterEvents.itemStartUse.subscribe(e=>{try{control(e.source,e.itemStack.typeId);}catch(e){fault(e);}});
world.afterEvents.itemStopUse.subscribe(e=>{const r=raids.get(e.source.id);if(r)r.holding=false;});
system.beforeEvents.startup.subscribe(e=>{
 /** @type {Array<[string,string,(p:Player)=>void]>} */
 const commands=[['menu','打开末日无线电',p=>void menu(p)],['start','从基地开始搜集行动',p=>start(p)],['fire','持枪开火（备用操作）',p=>{if(selected(p)==='dead:gun')shoot(p);}],['reload','换弹',p=>{const r=raids.get(p.id);if(r)reload(r,now());}],['barricade','在身后放置临时路障',p=>blockEscape(p)],['base','放弃本轮并返回基地',p=>base(p,'§e已返回基地；本轮未带出物资丢失。')]];
 for(const [name,description,action] of commands){
 e.customCommandRegistry.registerCommand({name:'dead:'+name,description,permissionLevel:CommandPermissionLevel.Any,cheatsRequired:false},o=>{if(!(o.sourceEntity instanceof Player))return{status:CustomCommandStatus.Failure,message:'请由玩家执行'};const p=o.sourceEntity;system.run(()=>{if(p.isValid)action(p);});return{status:CustomCommandStatus.Success};});
 }
});
world.afterEvents.playerSpawn.subscribe(e=>system.runTimeout(()=>{try{base(e.player,'§6欢迎来到末日赫尔辛基。使用无线电或输入 /dead:menu 开始。');}catch(e){fault(e);}},40));
world.afterEvents.playerLeave.subscribe(e=>{raids.delete(e.playerId);busy.delete(e.playerId);});
world.afterEvents.entityLoad.subscribe(e=>system.run(()=>{try{if(e.entity.isValid&&e.entity.typeId.startsWith('dead:')&&!mobs.has(e.entity.id))e.entity.remove();}catch{}}));
world.afterEvents.entityHurt.subscribe(e=>{if(e.hurtEntity instanceof Player){const r=raids.get(e.hurtEntity.id);if(r)r.lastHit=now();}});
world.afterEvents.entityDie.subscribe(e=>{
 if(e.deadEntity instanceof Player){raids.delete(e.deadEntity.id);return;}
 if(!e.deadEntity.typeId.startsWith('dead:'))return;
 mobs.delete(e.deadEntity.id);const shot=lastShooter.get(e.deadEntity.id);lastShooter.delete(e.deadEntity.id);
 const p=e.damageSource.damagingEntity instanceof Player?e.damageSource.damagingEntity:shot&&now()-shot.tick<40?world.getAllPlayers().find(p=>p.id===shot.id):null;
 if(p instanceof Player){const r=raids.get(p.id);if(r){r.kills++;if(r.kills<=20)r.bag+=1;}}
});
system.afterEvents.scriptEventReceive.subscribe(e=>{if(e.id==='dead:base'&&e.sourceEntity instanceof Player)base(e.sourceEntity,'§e已放弃本轮并返回基地。');});
system.afterEvents.scriptEventReceive.subscribe(e=>{if(e.id==='dead:survey'&&!e.sourceEntity)survey();});
system.afterEvents.scriptEventReceive.subscribe(e=>{
 if(e.id!=='dead:smoke'||e.sourceEntity)return;
 try{
  const report=[];
  for(const id of ['gun','radio','reload','medkit','lure']){const item=new ItemStack('dead:'+id);report.push(item.typeId);}
  for(const type of TYPES){const mob=dim().spawnEntity('dead:'+type,{x:BASE.x+3,y:BASE.y+2,z:BASE.z});try{const h=mob.getComponent('minecraft:health');const before=h.currentValue;mob.triggerEvent('dead:alert');mob.applyDamage(1);if(h.currentValue!==before-1)throw Error('Damage check '+type);mob.triggerEvent('dead:calm');report.push(type+':'+before);}finally{mob.remove();}}
  console.warn('DEADCITY_SMOKE_PASS '+JSON.stringify(report));
 }catch(e){console.warn('DEADCITY_SMOKE_FAIL '+e);}
});
function visible(a,b){const h={x:a.x,y:a.y+1.4,z:a.z},t={x:b.x,y:b.y+1,z:b.z},len=Math.hypot(t.x-h.x,t.y-h.y,t.z-h.z);if(len<1)return true;return !dim().getBlockFromRay(h,{x:(t.x-h.x)/len,y:(t.y-h.y)/len,z:(t.z-h.z)/len},{maxDistance:len-.4,includeLiquidBlocks:false,includePassableBlocks:false});}
function spawnNear(p){
 if(mobs.size>=48)return;
 for(let tries=0;tries<6;tries++){
  const theta=Math.random()*Math.PI*2,n=24+Math.random()*16,q={x:Math.floor(p.location.x+Math.cos(theta)*n),z:Math.floor(p.location.z+Math.sin(theta)*n)};
  if(!inside(q)||dist(q,BASE)<38||EXITS.some(s=>dist(q,s)<8))continue;
  let top;try{top=dim().getTopmostBlock(q);}catch{continue;}
  if(!top||Math.abs(top.y+1-p.location.y)>5||top.typeId.includes('water')||top.typeId.includes('leaves'))continue;
  const v=Math.random(),type=v<.6?'walker':v<.8?'runner':v<.93?'screamer':'armored';
  const mob=dim().spawnEntity('dead:'+type,{...q,y:top.y+1});mob.nameTag={walker:'感染者',runner:'奔跑者',screamer:'尖叫者',armored:'重甲感染者'}[type];
  mobs.set(mob.id,{entity:mob,type,alertUntil:0,alert:false,scream:0,stunUntil:0,lastSeen:now()});return;
 }
}
function ai(){
 const players=world.getAllPlayers().filter(p=>raids.has(p.id));
 while(lures.length&&lures[0].until<now())lures.shift();
 for(const lure of lures){try{dim().spawnParticle('minecraft:basic_flame_particle',lure);}catch{}}
 for(const [id,m] of mobs){
  try{
   const e=m.entity;if(!e.isValid){mobs.delete(id);lastShooter.delete(id);continue;}
   if(dist(e.location,BASE)<26||!players.some(p=>dist(p.location,e.location)<85)){e.remove();mobs.delete(id);lastShooter.delete(id);continue;}
   const bait=lures.find(l=>dist(l,e.location)<30);
   if(bait){if(m.alert){e.triggerEvent('dead:calm');m.alert=false;}m.alertUntil=0;
    const d=dist(bait,e.location);if(d>2)e.applyImpulse({x:(bait.x-e.location.x)/d*.09,y:0,z:(bait.z-e.location.z)/d*.09});continue;}
   let heard=null;
   for(const p of players){const r=raids.get(p.id),d=dist(e.location,p.location);if(dist(p.location,BASE)<26)continue;
    if(d<detectionRadius(p.isSneaking,p.isSprinting)&&visible(e.location,p.location)){m.alertUntil=now()+100;heard=p;break;}
    if(d<58&&r.noiseUntil>now()){m.alertUntil=now()+100;heard=p;}
   }
   const alert=m.alertUntil>now();if(alert!==m.alert){e.triggerEvent(alert?'dead:alert':'dead:calm');m.alert=alert;}
   if(alert&&heard&&!visible(e.location,heard.location)){const d=dist(e.location,heard.location);if(d>2)e.applyImpulse({x:(heard.location.x-e.location.x)/d*.06,y:0,z:(heard.location.z-e.location.z)/d*.06});}
   if(alert&&m.type==='screamer'&&now()-m.scream>240){m.scream=now();if(heard){sound(heard,'mob.ghast.scream',1.6);raids.get(heard.id).noiseUntil=now()+180;spawnNear(heard);spawnNear(heard);heard.sendMessage('§c尖叫者正在召集尸群！');}}
  }catch{mobs.delete(id);}
 }
}
function tick(){
 for(const p of world.getAllPlayers()){
  try{const r=raids.get(p.id);if(!r)continue;finishReload(r,now());if(r.holding&&selected(p)==='dead:gun')shoot(p);else r.holding=false;}catch(e){fault(e);}
 }
}
function second(){
 seconds++;
 if(seconds%3===0)clearBarriers();
 for(const p of world.getAllPlayers()){
  try{
   if(dist(p.location,BASE)<26){p.addEffect('resistance',40,{amplifier:4,showParticles:false});p.addEffect('saturation',40,{amplifier:1,showParticles:false});}
   const r=raids.get(p.id);if(!r){if(seconds%5===0)p.onScreenDisplay.setActionBar('§6Linnanmäki 幸存者基地 §f| /dead:menu 开始行动');continue;}
   if(now()-r.start>=ROUND_SECONDS*20){base(p,'§c行动超时，未带出物资已丢失。');continue;}
   r.stamina=Math.max(0,Math.min(100,r.stamina+(r.exhausted?8:p.isSprinting?-13:p.isSneaking?10:6)));
   if(r.stamina===0)r.exhausted=true;if(r.stamina>=48)r.exhausted=false;
   if(r.exhausted)p.addEffect('slowness',25,{amplifier:3,showParticles:false});
   p.addEffect('saturation',40,{amplifier:1,showParticles:false});
   if(!inside(p.location)||p.dimension.id!=='minecraft:overworld'){r.boundary++;p.sendMessage('§c离开了开放城区，请在 10 秒内返回，否则本轮失败。');if(r.boundary>=10){base(p,'§c已离开任务区，本轮结束。');continue;}}else r.boundary=0;
   const site=SITES.find(s=>!r.looted.includes(s.id)&&dist(p.location,s)<5&&Math.abs(p.location.y-(points.get(s.id)?.y??-999))<4);
   if(site&&p.isSneaking){r.search=r.site===site.id?r.search+1:1;r.site=site.id;if(r.search>=3&&collect(r,site.id)){p.sendMessage(`§a搜集 ${site.name}：+${site.value} 零件 / +24 弹药 / +1 医疗包`);sound(p,'random.levelup');r.search=0;}}else{r.search=0;r.site='';}
   const exit=EXITS.find(s=>dist(p.location,s)<6&&Math.abs(p.location.y-(points.get(s.id)?.y??-999))<4);
   const eligible=!!exit&&r.bag>0&&!p.isSprinting;
   if(extraction(r,eligible,now()-r.lastHit<40)){finish(p);continue;}
   const candidates=r.looted.length>=3||r.looted.length===SITES.length?EXITS:SITES.filter(s=>!r.looted.includes(s.id));
   const target=[...candidates].sort((a,b)=>dist(a,p.location)-dist(b,p.location))[0];
   const path=ROUTES[target.id];let waypoint;
   if(path){let index=0,best=Infinity;for(let i=0;i<path.length;i++){const v=path[i],d=Math.hypot(v[0]-p.location.x,v[2]-p.location.z);if(d<best){best=d;index=i;}}
    const v=path[Math.min(path.length-1,index+(best<8?7:0))];waypoint={x:v[0]+.5,y:v[1]+.8,z:v[2]+.5};
    if(seconds%2===0)try{dim().spawnParticle('minecraft:endrod',waypoint);}catch{}
   }
   const remain=Math.ceil((ROUND_SECONDS*20-now()+r.start)/20);
   p.onScreenDisplay.setActionBar(`§e${WEAPONS[r.tier].name} ${r.reloadUntil?'换弹中':r.ammo+'/'+r.reserve} §f| 体力 ${r.stamina} | 物资 ${r.bag} | ${Math.floor(remain/60)}:${String(remain%60).padStart(2,'0')}\n${r.extract?`§a撤离 ${r.extract}/12` : r.search?`§e搜集 ${r.search}/3`:`§b${target.name} ${Math.round(dist(target,p.location))}m · 路标 ${Math.floor(waypoint?.x??target.x)},${Math.floor(waypoint?.z??target.z)}`}`);
   if(seconds%6===0&&dist(p.location,BASE)>32){const nearby=[...mobs.values()].filter(m=>m.entity.isValid&&dist(m.entity.location,p.location)<55).length;const cap=Math.min(14,5+Math.floor((now()-r.start)/3600));if(nearby<cap)spawnNear(p);}
  }catch(e){fault(e);}
 }
 if(seconds%3===0)for(const s of [...SITES,...EXITS]){const q=points.get(s.id);if(q)try{dim().spawnParticle(s.id.startsWith('e')?'minecraft:totem_particle':'minecraft:basic_flame_particle',{...q,y:q.y+1});}catch{}}
}
world.afterEvents.worldLoad.subscribe(()=>system.runTimeout(()=>{
 try{
 world.setDynamicProperty('dead:installed',true);
 clearBarriers(true);
 for(const command of ['gamerule doMobSpawning false','gamerule mobGriefing false','gamerule doDaylightCycle false','gamerule doWeatherCycle false','gamerule keepInventory true','gamerule pvp false','gamerule naturalRegeneration false','time set 12500','weather clear'])dim().runCommand(command);
 // Remove only our old session entities; interrupted raids never pay out.
 for(const e of dim().getEntities())if(e.typeId.startsWith('dead:')||e.hasTag('dead_marker'))e.remove();
 let i=0;
 function preparePoint(){
  const list=[...SITES,...EXITS];if(i>=list.length){prepared=points.size===list.length;console.warn('DEADCITY_READY points='+points.size+' cap=48');for(const p of world.getAllPlayers())base(p,'§6末日赫尔辛基已启动，使用无线电开始。');return;}
  const s=list[i++],area='dead_site_'+s.id;
  try{dim().runCommand(`tickingarea add circle ${s.x} 60 ${s.z} 1 ${area} true`);}catch{}
  system.runTimeout(()=>{try{
   const top=dim().getTopmostBlock(s);if(!top)throw Error('No ground at '+s.id);const q={x:s.x+.5,y:top.y+1,z:s.z+.5};points.set(s.id,q);
   const marker=dim().spawnEntity('minecraft:armor_stand',q);marker.addTag('dead_marker');marker.nameTag=(s.id.startsWith('e')?'§a撤离 · 停留12秒':'§e补给 · 蹲下3秒')+'\n'+s.name;marker.addEffect('resistance',20000000,{amplifier:4,showParticles:false});
   console.warn('DEADCITY_POINT '+s.id+' '+JSON.stringify(q)+' '+top.typeId);
  }catch(e){fault(e);}preparePoint();},35);
 }
 preparePoint();system.runInterval(tick,1);system.runInterval(()=>{try{ai();}catch(e){fault(e);}},10);system.runInterval(second,20);
 }catch(e){fault(e);}
},60));
