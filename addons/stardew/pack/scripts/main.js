import {world,system,ItemStack,ItemLockMode,GameMode,BlockPermutation,CommandPermissionLevel,CustomCommandStatus} from '@minecraft/server';
import {ActionFormData} from '@minecraft/server-ui';
import {fresh,SEASONS,CROPS,GOODS,NPCS,add,price,plant,harvest,buySeeds,ship,withdraw,nextDay,talk,gift,donate} from './rules.js';
import {Y,HOME,LOCATIONS,isPlot,commands} from './map.js';
let s=fresh(),ready=false,dirty=false,seconds=0;
const sleepers=new Set(),forms=new Set(),fishers=new Map(),cooldown=new Map(),hints=new Map();
const dim=()=>world.getDimension('overworld');
const pos=(x,z)=>({x:x+.5,y:Y+1,z:z+.5});
const near=(p,x,z,r=10)=>p.dimension.id==='minecraft:overworld'&&Math.hypot(p.location.x-x,p.location.z-z)<r;
const notify=(p,msg)=>p.sendMessage('§e'+msg);
function hint(p,msg){hints.set(p.id,{text:msg,until:system.currentTick+50});p.onScreenDisplay.setActionBar(msg);}
function cropHint(p){
 const h=hints.get(p.id);if(h&&h.until>system.currentTick)return h.text;
 const b=p.getBlockFromViewDirection({maxDistance:6,includeLiquidBlocks:true})?.block;
 if(b&&isPlot(b.location.x,b.location.z)&&b.y>=Y&&b.y<=Y+1){const plot=s.plots[`${b.location.x},${b.location.z}`],c=CROPS[plot?.crop];
  if(c)return `${c.name} · ${plot.age>=c.days?'§a已成熟，使用收获篮':`还需${c.days-plot.age}个浇水日`} §f· ${plot.water?'§b已浇水':'§e今天未浇水'}`;
  const id=String(p.getDynamicProperty('valley:seed')||'parsnip');return plot?`空耕地 · ${CROPS[id]?.name||'未选种'}种子 ${s.seeds[id]||0}包 · ${plot.water?'已浇水':'未浇水'}`:'可开垦土地 · 使用锄头';
 }
 return '农场日记：附近交互 / 背包 / 地图';
}
const itemIcon=id=>'textures/items/'+({parsnip:'carrot',potato:'potato',cauliflower:'beetroot',melon:'melon',blueberry:'sweet_berries',pumpkin:'seeds_pumpkin',cranberry:'sweet_berries',wood:'stick',stone:'brick',fish:'fish_raw',carp:'fish_raw',egg:'egg',milk:'bucket_milk'}[id]||'book_normal');
function save(){const text=JSON.stringify(s),chunks=Math.ceil(text.length/16000);for(let i=0;i<chunks;i++)world.setDynamicProperty('valley:state_'+i,text.slice(i*16000,(i+1)*16000));world.setDynamicProperty('valley:chunks',chunks);dirty=false;}
function buttonIcon(label){for(const [id,c]of Object.entries({...CROPS,...GOODS}))if(label.includes(c.name))return itemIcon(id);if(label.includes('种子'))return 'textures/items/seeds_wheat';if(label.includes('地图'))return 'textures/items/map_filled';return 'textures/items/book_normal';}
function energy(p){return Number(p.getDynamicProperty('valley:energy')??270);}
function spend(p,n){if(energy(p)<n){notify(p,'体力不足，回农舍休息，或去餐吧购买沙拉。');return false;}p.setDynamicProperty('valley:energy',energy(p)-n);return true;}
function kit(p){const c=p.getComponent('minecraft:inventory')?.container;if(!c)return;for(const id of ['journal','hoe','seeds','water','harvest','axe','pick','rod']){let found=false;for(let i=0;i<c.size;i++)if(c.getItem(i)?.typeId==='valley:'+id)found=true;if(found)continue;const item=new ItemStack('valley:'+id);item.keepOnDeath=true;item.lockMode=ItemLockMode.inventory;c.addItem(item);}}
function enter(p){if(!ready||!p.isValid)return;p.setGameMode(GameMode.Adventure);p.teleport(HOME,{dimension:dim()});p.setSpawnPoint({...HOME,dimension:dim()});kit(p);if(p.getDynamicProperty('valley:restDay')!==`${s.year}:${s.season}:${s.day}`){p.setDynamicProperty('valley:energy',270);p.setDynamicProperty('valley:restDay',`${s.year}:${s.season}:${s.day}`);}notify(p,'欢迎来到星露谷农场！使用「农场日记」查看玩法。农具对准土地使用；iPad 点击对应动作按钮。');}
function redraw(key){const [x,z]=key.split(',').map(Number),plot=s.plots[key];const ground=dim().getBlock({x,y:Y,z}),top=dim().getBlock({x,y:Y+1,z});if(!ground||!top)return;if(!plot){ground.setType('minecraft:dirt');top.setType('minecraft:air');return;}ground.setPermutation(BlockPermutation.resolve('minecraft:farmland',{moisturized_amount:plot.water?7:0}));const c=CROPS[plot.crop];if(c)top.setPermutation(BlockPermutation.resolve('minecraft:'+c.block,{growth:Math.min(7,Math.floor(plot.age/c.days*7))}));else top.setType('minecraft:air');}
function clock(){return `${s.year}年 ${SEASONS[s.season]}${s.day}日 ${Math.floor(s.minute/60)%24}:${String(s.minute%60).padStart(2,'0')} ${s.rain?'雨':'晴'}`;}
async function form(p,title,body,buttons){if(forms.has(p.id))return;forms.add(p.id);try{const f=new ActionFormData().title(title).body(body);for(const [label,,icon]of buttons)f.button(label,icon||buttonIcon(label));const a=await f.show(p);if(!a.canceled&&a.selection!==undefined&&p.isValid)buttons[a.selection]?.[1]();}catch{notify(p,'菜单暂时无法打开，请关闭聊天窗口后再使用日记。');}finally{forms.delete(p.id);}}
// Form callbacks open their follow-up on the next tick, after releasing the UI lock.
const later=fn=>{system.run(fn);};
function menu(p){if(!ready){notify(p,'地图正在搭建，请稍候。');return;}fishers.delete(p.id);kit(p);const b=[['种子袋 · 选择要播种的作物',()=>later(()=>seedMenu(p))],['背包 / 日志',()=>later(()=>bagMenu(p))],['地图与操作说明',()=>later(()=>guide(p))]];
 if(near(p,32,24,15))b.push(['睡觉 · 等待所有在线玩家就寝',()=>{if(!near(p,32,24,15)){notify(p,'请回农舍再睡觉。');return;}sleepers.add(p.id);notify(p,'已准备睡觉，离开农舍或使用工具可取消。');checkSleep();}]);
 if(near(p,45,30,8))b.push(['出货箱 · 放入物品',()=>later(()=>shipping(p))]);
 if(near(p,124,46,17))b.push(['皮埃尔 · 购买种子',()=>later(()=>shop(p))]);
 if(near(p,96,12,16))b.push(['罗宾 · 建筑与动物',()=>later(()=>animals(p))]);
 if(near(p,124,72,15))b.push(['餐吧 · 沙拉 220g / 恢复113体力',()=>{if(!near(p,124,72,15))return;if(energy(p)>=270){notify(p,'体力已满，无需购买沙拉。');return;}if(s.gold>=220){s.gold-=220;p.setDynamicProperty('valley:energy',Math.min(270,energy(p)+113));dirty=true;}else notify(p,'金币不足。');}]);
 if(near(p,149,18,16))b.push(['社区中心 · 春季作物收集包',()=>later(()=>bundle(p))]);
 if(near(p,169,12,18))b.push([`矿洞 · 第${s.mine}层 / 开采`,()=>mine(p)]);
 if(near(p,65,23,15))b.push(['动物院 · 添饲料 20g',()=>{if(!s.feed&&s.gold>=20){s.gold-=20;s.feed=true;dirty=true;notify(p,'已喂食，明早产物进入农场背包。');}}]);
 const npc=NPCS.find(n=>{const e=dim().getEntities({tags:['valley_npc_'+n[0]]})[0];return e&&near(p,e.location.x,e.location.z,8);});if(npc)b.push([`与${npc[1]}交谈 / 送礼`,()=>later(()=>villager(p,npc))]);
 form(p,'星露谷 · 农场日记',`${clock()}\n共同资金 ${s.gold}g · 体力 ${energy(p)}/270\n${sleepers.size}人准备睡觉 · /valley:menu 随时打开`,b);
}
function guide(p){form(p,'山谷地图与操作','北：山地、罗宾的木匠商店、矿洞\n西：标准农场；东：鹈鹕镇；南：森林与海滩\n\n农场土地：锄头 → 种子袋选种 → 播种 → 每天浇水 → 成熟后收获。\n出货箱隔夜结算；所有玩家共享作物、金币与背包。\n钓鱼：对准水使用鱼竿。咬钩后按住/松开使用按钮控制绿条，让它跟住鱼。\n斧头砍农场杂物及森林树干；镐开采矿洞矿石。\n农舍里打开日记可睡觉；全员同意后过夜。凌晨2点会昏倒。\n原版布局的方块改编；本版暂未包含婚姻、完整剧情和节日。',LOCATIONS.map(([name,x,z])=>[`${name}  (${x}, ${z})`,()=>notify(p,`目的地 ${name}：X ${x} / Z ${z}，沿小路步行。`)]));}
function seedMenu(p){form(p,'种子袋','选择后，对准已开垦土地使用「播种」。',Object.entries(CROPS).filter(([,c])=>c.season===s.season).map(([id,c])=>[`${c.name} ×${s.seeds[id]||0} · ${c.days}天成熟`,()=>{p.setDynamicProperty('valley:seed',id);notify(p,'已选择 '+c.name);} ]));}
function bagMenu(p){const items=Object.entries(s.bag).map(([id,n])=>`${CROPS[id]?.name??GOODS[id]?.name??id} ×${n}`).join('\n');form(p,'农场背包',`${items||'背包为空'}\n\n收获 ${s.harvests} 次；社区收集 ${s.bundle.length}/3\n技能经验：种植${s.xp.farming} / 钓鱼${s.xp.fishing} / 采矿${s.xp.mining} / 采集${s.xp.foraging}\n任务：收获第一棵防风草（奖励100g）`,[['领取入门任务奖励',()=>{if(s.harvests&&!s.quest){s.quest=true;s.gold+=100;dirty=true;notify(p,'任务完成，获得100g。');}else notify(p,s.quest?'奖励已领取。':'先种植并收获一棵作物。');}]]);}
function shop(p){if(!near(p,124,46,17))return;if(s.minute<540||s.minute>=1020||(s.day-1)%7===2){notify(p,'皮埃尔营业时间9:00—17:00，周三休息。');return;}form(p,'皮埃尔杂货店',`资金 ${s.gold}g · 每组5包`,Object.entries(CROPS).filter(([,c])=>c.season===s.season).map(([id,c])=>[`${c.name}种子 ×5 · ${c.seed*5}g`,()=>{if(!near(p,124,46,17)||s.minute<540||s.minute>=1020||(s.day-1)%7===2)return;notify(p,buySeeds(s,id)?'购买成功。':'金币不足。');dirty=true;} ]));}
function shipping(p){
 const total=Object.entries(s.shipping).reduce((sum,[id,n])=>sum+price(id)*n,0);
 const buttons=Object.entries(s.bag).map(([id,n])=>[`${CROPS[id]?.name??GOODS[id]?.name??id} ×${n} · 选择出货数量`,()=>later(()=>shippingItem(p,id,false)),itemIcon(id)]);
 for(const [id,n]of Object.entries(s.shipping))buttons.push([`取回 ${CROPS[id]?.name??GOODS[id]?.name??id} ×${n}`,()=>later(()=>shippingItem(p,id,true)),itemIcon(id)]);
 buttons.push(['返回日记',()=>later(()=>menu(p)),'textures/items/book_normal']);
 form(p,'出货箱',`预计明早收入 ${total}g\n可以按数量出货；过夜前可取回，避免误卖种植和收集包所需物品。`,buttons);
}
function shippingItem(p,id,take){const count=(take?s.shipping:s.bag)[id]||0;const day=`${s.year}:${s.season}:${s.day}`;
 const choices=[...new Set([1,5,count])].filter(n=>n>0&&n<=count);
 form(p,(take?'取回 ':'出货 ')+(CROPS[id]?.name??GOODS[id]?.name??id),`当前数量 ${count} · 单价 ${price(id)}g`,choices.map(n=>[`${take?'取回':'放入'} ${n}个 · ${n*price(id)}g`,()=>{
  if(!near(p,45,30,8)){notify(p,'请回到出货箱旁。');return;}if(day!==`${s.year}:${s.season}:${s.day}`){notify(p,'已经过夜，请重新打开出货箱。');return;}
  const ok=(take?withdraw:ship)(s,id,n);if(ok){dirty=true;notify(p,take?'物品已取回。':'已放入，明早结算。');}else notify(p,'数量已变化，请重新选择。');later(()=>shipping(p));
 },itemIcon(id)]));}
function bundle(p){form(p,'社区中心 · 春季作物收集包','捐赠防风草、土豆、花椰菜各1个。完成奖励1000g（本版简化奖励）。',['parsnip','potato','cauliflower'].map(id=>[`${CROPS[id].name} ${s.bundle.includes(id)?'✓':'待捐赠'}`,()=>{if(near(p,149,18,16)){notify(p,donate(s,id)?'谢谢你的贡献！':'已经捐赠或背包中没有该作物。');dirty=true;}}]));}
function villager(p,n){const id=String(n[0]);if(talk(s,id))dirty=true;form(p,String(n[1]),`${n[4]}\n好感 ${Math.floor((s.friends[id]||0)/250)}/10心\n每天可交谈、送礼各一次（当前简化规则）。`,Object.entries(s.bag).map(([item,n])=>[`${CROPS[item]?.name??GOODS[item]?.name??item} ×${n} · 送礼`,()=>{notify(p,gift(s,id,item)?'谢谢你的礼物！':'今天已送过礼物，或物品不足。');dirty=true;}]));}
function animals(p){form(p,'罗宾 · 农场建设','简化版养殖：购买建筑和动物；动物院每日添加饲料，次日产出。',[
 ['建造鸡舍 · 4000g + 木材300 + 石头100',()=>buildAnimal(p,'coop',4000,300,100)],['建造畜棚 · 6000g + 木材350 + 石头150',()=>buildAnimal(p,'barn',6000,350,150)],
 ['购买小鸡 · 800g',()=>{if(s.coop&&s.gold>=800&&s.chickens<4){s.gold-=800;s.chickens++;dirty=true;spawnAnimals();}else notify(p,'需要鸡舍、800g和空余位置。');}],['购买奶牛 · 1500g',()=>{if(s.barn&&s.gold>=1500&&s.cows<4){s.gold-=1500;s.cows++;dirty=true;spawnAnimals();}else notify(p,'需要畜棚、1500g和空余位置。');}]]);}
function buildAnimal(p,id,cost,wood,stone){if(s[id]||s.gold<cost||(s.bag.wood||0)<wood||(s.bag.stone||0)<stone){notify(p,'已建造或材料不足。');return;}s.gold-=cost;add(s.bag,'wood',-wood);add(s.bag,'stone',-stone);s[id]=true;dirty=true;renderBuildings();notify(p,'建筑完成。');}
function renderBuildings(){for(const [id,x]of [['coop',58],['barn',66]])if(s[id]){dim().runCommand(`fill ${x} 201 16 ${Number(x)+4} 204 20 oak_planks`);dim().runCommand(`fill ${Number(x)+1} 201 17 ${Number(x)+3} 203 20 air`);dim().runCommand(`fill ${Number(x)-1} 205 15 ${Number(x)+5} 205 21 red_terracotta`);}}
function spawnAnimals(){for(const e of dim().getEntities({tags:['valley_animal']}))e.remove();for(const [type,n]of [['chicken',s.chickens],['cow',s.cows]])for(let i=0;i<Number(n);i++){const e=dim().spawnEntity('minecraft:'+type,pos(60+i*2,26));e.addTag('valley_animal');e.addEffect('resistance',20000000,{amplifier:4,showParticles:false});}}
function mine(p){if(!near(p,169,12,20)||!spend(p,4))return;const ore=s.mine>80?'gold':s.mine>40?'iron':'copper';add(s.bag,ore,1);add(s.bag,'stone',2);s.xp.mining+=5;if(Math.random()<.28){s.mine=Math.min(120,s.mine+1);notify(p,`发现下一层入口！现在第${s.mine}层。`);}else notify(p,`开采获得 ${GOODS[ore].name} 与石头。`);dirty=true;}
function checkSleep(){const players=world.getAllPlayers();if(players.length&&players.every(p=>sleepers.has(p.id)&&near(p,32,24,15)))dawn(false);}
function dawn(faint){if(!ready)return;if(faint)s.gold-=Math.min(1000,Math.floor(s.gold*.1));const income=nextDay(s);sleepers.clear();fishers.clear();for(const key of Object.keys(s.plots))redraw(key);for(const p of world.getAllPlayers()){p.setDynamicProperty('valley:energy',faint?135:270);p.setDynamicProperty('valley:restDay',`${s.year}:${s.season}:${s.day}`);p.teleport(HOME,{dimension:dim()});notify(p,`${clock()} · 昨日出货 ${income}g${faint?' · 凌晨昏倒，扣除部分医疗费。':''}`);}dim().runCommand(s.rain?'weather rain':'weather clear');save();}
function use(p,id){if(!ready)return;sleepers.delete(p.id);if(id==='journal'){menu(p);return;}if(id==='rod'&&fishers.has(p.id)){fishers.get(p.id).hold=true;return;}if((cooldown.get(p.id)||0)>system.currentTick)return;cooldown.set(p.id,system.currentTick+5);
 const hit=p.getBlockFromViewDirection({maxDistance:6,includeLiquidBlocks:true}),b=hit?.block;
 if(id==='rod'){if(!b||b.typeId!=='minecraft:water'){notify(p,'对准海水或池塘使用鱼竿。');return;}if(spend(p,8)){fishers.set(p.id,{wait:40+Math.floor(Math.random()*60),bar:.3,fish:.5,progress:.25,t:0,hold:true,sea:p.location.z>130});notify(p,'浮标入水。咬钩后按住抬升绿条，松开下降。');}return;}
 if(!b){hint(p,'§e请对准6格以内的目标。');return;}const {x,z}=b.location,key=`${x},${z}`;
 if(isPlot(x,z)&&b.y>=Y&&b.y<=Y+1){let changed=false;
  if(id==='hoe'&&!s.plots[key]&&spend(p,2)){s.plots[key]={age:0,water:s.rain};changed=true;}
  if(id==='seeds'){const seed=String(p.getDynamicProperty('valley:seed')||'parsnip');changed=plant(s,key,seed);if(!changed)hint(p,'§e需要空耕地和当季种子；在日记里切换种子。');}
  if(id==='water'&&s.plots[key]&&!s.plots[key].water&&spend(p,2)){s.plots[key].water=true;changed=true;}
  if(id==='harvest')changed=harvest(s,key);
  if(changed){redraw(key);dirty=true;hint(p,({hoe:'§a开垦完成',seeds:'§a播种完成，记得每天浇水',water:'§b浇水完成',harvest:'§a收获已放入农场背包'})[id]||'§a完成');}
  else if(id==='water')hint(p,!s.plots[key]?'§e请先用锄头开垦。':s.plots[key].water?'§b这格今天已经浇过水。':'§e体力不足，请休息或补充食物。');
  else if(id==='harvest')hint(p,s.plots[key]?.crop?'§e作物尚未成熟，继续每天浇水。':'§e这格没有可以收获的作物。');
  else if(id==='hoe')hint(p,s.plots[key]?'§e这格已开垦，下一步播种。':'§e体力不足，请休息或补充食物。');return;
 }
 if(id==='axe'&&b.typeId==='minecraft:oak_log'&&x<78&&z>35&&spend(p,2)){b.setType('air');add(s.bag,'wood',5);s.xp.foraging+=2;dirty=true;}
 if(id==='pick'&&near(p,170,10,24)){mine(p);return;}
 if(id==='pick'&&b.typeId==='minecraft:cobblestone'&&x<78&&z>35&&spend(p,2)){b.setType('air');add(s.bag,'stone',5);dirty=true;}
}
function fishingTick(){for(const [id,f]of fishers){const p=world.getAllPlayers().find(p=>p.id===id);if(!p){fishers.delete(id);continue;}const selected=p.getComponent('minecraft:inventory')?.container?.getItem(p.selectedSlotIndex)?.typeId;if(selected!=='valley:rod'){fishers.delete(id);continue;}if(f.wait-->0){p.onScreenDisplay.setActionBar('§b等待鱼儿咬钩…… · 切换农具可取消');continue;}if(f.t===0)notify(p,'咬钩了！按住抬杆，松开下降，让绿条跟住黄色鱼标。');f.t++;f.fish=.5+Math.sin(f.t*.075)*.32;f.bar=Math.max(0,Math.min(1,f.bar+(f.hold?.035:-.022)));f.progress+=Math.abs(f.bar-f.fish)<.19?.009:-.007;
 const line=Array.from({length:21},(_,i)=>Math.abs(i/20-f.fish)<.025?'§e◆':Math.abs(i/20-f.bar)<.15?'§a█':'§8─').join('');p.onScreenDisplay.setActionBar(`§b咬钩！按住升 / 松开降\n${line} §f${Math.max(0,Math.floor(f.progress*100))}%`);
 if(f.progress>=1){add(s.bag,f.sea?'fish':'carp');s.xp.fishing+=10;dirty=true;notify(p,'钓鱼成功！鱼已放入农场背包。');fishers.delete(id);}else if(f.progress<=0||f.t>600){notify(p,'鱼儿逃走了。');fishers.delete(id);}
}}
function second(){if(!ready)return;seconds++;const players=world.getAllPlayers();if(players.length&&seconds%7===0){s.minute+=10;dirty=true;if(s.minute>=1560)dawn(true);dim().runCommand(`time set ${Math.floor(((s.minute-360)%1440)/1440*24000)}`);}
 for(const p of players){if(sleepers.has(p.id)&&!near(p,32,24,15))sleepers.delete(p.id);p.addEffect('saturation',60,{amplifier:1,showParticles:false});p.addEffect('resistance',60,{amplifier:4,showParticles:false});if(p.location.y<195)enter(p);p.onScreenDisplay.setTitle(`§6${clock().replace(/ /g,'')} §e${s.gold}g §f| 体力 ${energy(p)}/270 | XYZ ${Math.floor(p.location.x)} ${Math.floor(p.location.y)} ${Math.floor(p.location.z)}`,{fadeInDuration:0,stayDuration:60,fadeOutDuration:0});if(!fishers.has(p.id))p.onScreenDisplay.setActionBar(`§f${cropHint(p)}`);}
 if(seconds%15===0&&dirty)save();if(seconds%60===0){for(const [i,n]of NPCS.entries()){const e=dim().getEntities({tags:['valley_npc_'+n[0]]})[0];if(e)e.teleport(pos(s.minute>=1080?119+i:Number(n[2]),s.minute>=1080?76:Number(n[3])));}}
 checkSleep();
}
world.afterEvents.itemStartUse.subscribe(e=>{if(e.itemStack.typeId.startsWith('valley:'))try{use(e.source,e.itemStack.typeId.slice(7));}catch(err){console.warn('VALLEY_ERROR '+err);}});
world.afterEvents.itemStopUse.subscribe(e=>{const f=fishers.get(e.source.id);if(f)f.hold=false;});
world.afterEvents.playerSpawn.subscribe(e=>system.runTimeout(()=>enter(e.player),40));
world.afterEvents.playerLeave.subscribe(e=>{sleepers.delete(e.playerId);fishers.delete(e.playerId);forms.delete(e.playerId);cooldown.delete(e.playerId);hints.delete(e.playerId);});
system.beforeEvents.startup.subscribe(e=>e.customCommandRegistry.registerCommand({name:'valley:menu',description:'打开星露谷农场日记',permissionLevel:CommandPermissionLevel.Any},origin=>{const p=origin.sourceEntity;if(p?.typeId==='minecraft:player')system.run(()=>menu(p));return {status:CustomCommandStatus.Success};}));
world.afterEvents.worldLoad.subscribe(()=>system.runTimeout(()=>{
 try{const n=Number(world.getDynamicProperty('valley:chunks')||0);if(n){let text='';for(let i=0;i<n;i++)text+=world.getDynamicProperty('valley:state_'+i)||'';s=JSON.parse(text);}
 for(const c of ['gamerule doMobSpawning false','gamerule doDaylightCycle false','gamerule doWeatherCycle false','gamerule keepInventory true','gamerule pvp false','gamerule mobGriefing false','gamerule randomTickSpeed 0','gamerule doFireTick false'])dim().runCommand(c);
 for(const [x,end,name]of [[0,95,'valley_west'],[96,191,'valley_east']])try{dim().runCommand(`tickingarea add ${x} 200 0 ${end} 210 159 ${name} true`);}catch{}
 system.runTimeout(()=>{
 const queue=world.getDynamicProperty('valley:built')?[]:commands();const invalid=[];for(const id of new Set(queue.map(c=>c.split(' ').slice(-1)[0])))try{BlockPermutation.resolve('minecraft:'+id);}catch{invalid.push(id);}if(invalid.length){console.warn('VALLEY_BUILD_ERROR invalid blocks '+invalid.join(','));return;}let index=0;
 const job=system.runInterval(()=>{try{for(let j=0;j<6&&index<queue.length;j++,index++)dim().runCommand(queue[index]);if(index<queue.length)return;system.clearRun(job);world.setDynamicProperty('valley:built',true);
 for(const e of dim().getEntities({tags:['valley_marker']}))e.remove();
 for(const [name,x,z]of LOCATIONS){const e=dim().spawnEntity('minecraft:armor_stand',pos(Number(x),Number(z)));e.nameTag='§e'+name+'\n§f使用农场日记';e.addTag('valley_marker');}
 for(const n of NPCS){const e=dim().spawnEntity('minecraft:villager_v2',pos(Number(n[2]),Number(n[3])));e.nameTag='§a'+n[1];e.addTag('valley_marker');e.addTag('valley_npc_'+n[0]);e.addEffect('slowness',20000000,{amplifier:10,showParticles:false});}
 for(const key of Object.keys(s.plots))redraw(key);renderBuildings();spawnAnimals();ready=true;save();dim().runCommand('setworldspawn 32 201 27');dim().runCommand(s.rain?'weather rain':'weather clear');for(const p of world.getAllPlayers())enter(p);console.warn('VALLEY_READY buildings=10 crops=7');
 }catch(err){system.clearRun(job);console.warn('VALLEY_BUILD_ERROR index='+index+' '+err);}},1);
 },100);
 }catch(err){console.warn('VALLEY_LOAD_ERROR '+err);}
},60));
system.runInterval(second,20);system.runInterval(fishingTick,2);
system.afterEvents.scriptEventReceive.subscribe(e=>{if(e.id!=='valley:smoke'||e.sourceEntity)return;try{if(!ready)throw Error('not ready');for(const id of ['journal','hoe','seeds','water','harvest','axe','pick','rod'])new ItemStack('valley:'+id);for(const c of Object.values(CROPS))BlockPermutation.resolve('minecraft:'+c.block,{growth:7});BlockPermutation.resolve('minecraft:farmland',{moisturized_amount:7});if(dim().getBlock({x:32,y:200,z:27})?.typeId!=='minecraft:oak_planks')throw Error('farmhouse missing');if(dim().getEntities({tags:['valley_marker']}).length!==17)throw Error('markers missing');console.warn('VALLEY_SMOKE_PASS tools=8 crops=7 markers=17');}catch(err){console.warn('VALLEY_SMOKE_FAIL '+err);}});
