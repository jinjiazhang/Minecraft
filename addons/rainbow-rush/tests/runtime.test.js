import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as rules from '../pack/scripts/rules.js';
import {courtyard,details} from '../pack/scripts/scenery.js';
import {swing,miningEffect,MINING_EFFECTS} from '../pack/scripts/effects.js';
function harness(){
 const properties=new Map(),players=[],blocks=new Map(),events={};let currentRound=rules.newRound(1,77);currentRound.generated=32;
 class ItemStack{constructor(id,n=1){this.typeId=id;this.amount=n;}setLore(){}setCanDestroy(){}}
 class Form{title(){return this}body(){return this}button(){return this}async show(){return {canceled:false,selection:0}}}
 const event=n=>({subscribe:fn=>events[n]=fn});
 const dim={id:'minecraft:overworld',getBlock:q=>{const k=`${q.x},${q.y},${q.z}`;if(!blocks.has(k))blocks.set(k,{location:q,typeId:rules.MATERIALS[rules.materialAt(q,currentRound)].block,isLiquid:false,setType(id){this.typeId=id;},setPermutation(p){this.typeId=p.typeId;}});return blocks.get(k)},getEntities:()=>[],runCommand(){}};
 const world={getDimension:()=>dim,getAllPlayers:()=>players,getDynamicProperty:k=>properties.get(k),setDynamicProperty:(k,v)=>properties.set(k,v),sendMessage(){},afterEvents:{itemStartUse:event('start'),itemStopUse:event('stop'),playerSpawn:event('spawn'),playerLeave:event('leave'),worldLoad:event('load')},beforeEvents:{itemUse:event('beforeUse'),playerInteractWithBlock:event('block'),playerBreakBlock:event('break')}};
 const system={currentTick:0,run:fn=>fn(),runTimeout(){},runInterval(){return 1},clearRun(){},beforeEvents:{startup:event('startup')},afterEvents:{scriptEventReceive:event('script')}};
 const ctx=vm.createContext({...rules,courtyard,details,swing,miningEffect,world,system,ItemStack,ActionFormData:Form,ItemLockMode:{inventory:'inventory'},GameMode:{Survival:'survival'},BlockPermutation:{resolve:id=>({typeId:id})},console});
 const source=fs.readFileSync(new URL('../pack/scripts/main.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
 vm.runInContext(source+'\nglobalThis.api={lobby,fillSegment,mine,interact,exchange,flush,held,round:()=>round,enable(r){round=r;ready=true},data};',ctx);ctx.api.enable(currentRound);
 function player(id,target=currentRound.rainbow){const props=new Map();props.set('rush:profile',JSON.stringify({...rules.newProfile(1),tier:5}));const slots=[new ItemStack('rush:pick_5')];const c={size:36,getItem:i=>slots[i],setItem:(i,v)=>slots[i]=v,addItem:item=>{const slot=Array.from({length:36},(_,i)=>i).find(i=>!slots[i]);if(slot===undefined)return item;slots[slot]=item;return undefined;}};
  const p={id,name:id,isValid:true,dimension:dim,location:{x:target.x,y:target.y,z:target.z-2},selectedSlotIndex:0,getDynamicProperty:k=>props.get(k),setDynamicProperty:(k,v)=>props.set(k,v),getComponent:()=>({container:c}),getBlockFromViewDirection:()=>({block:dim.getBlock(target)}),getViewDirection:()=>({x:0,y:0,z:1}),sendMessage(t){this.lastMessage=t},playSound(){},onScreenDisplay:{setActionBar(){},setTitle(){}},teleport(q){this.location=q},setGameMode(mode){this.mode=mode},setSpawnPoint(){},addEffect(){},removeEffect(){}};players.push(p);return {p,c,slots};}
 const basePlayer=player;
 function withEffects(...args){const result=basePlayer(...args),p=result.p;p.sounds=[];p.animations=[];p.particles=[];p.playSound=(id)=>p.sounds.push(id);p.playAnimation=(id)=>p.animations.push(id);p.getHeadLocation=()=>({...p.location,y:p.location.y+1.6});p.dimension={...dim,spawnParticle:(id,q)=>p.particles.push({id,q})};return result;}
 return {api:ctx.api,player:withEffects,players,dim,blocks,properties,events,round:currentRound};
}
test('full inventory prevents rainbow removal and victory; space permits exactly one winner',()=>{const h=harness(),a=h.player('Alice'),b=h.player('Bob');for(let i=1;i<36;i++)a.slots[i]={typeId:'minecraft:apple',amount:64};for(let i=0;i<4;i++)h.api.mine(a.p);assert.equal(h.api.round().winner,null);assert.equal(h.dim.getBlock(h.round.rainbow).typeId,'rush:rainbow_ore');a.slots[35]=undefined;h.api.mine(a.p);assert.equal(h.api.round().winner.id,'Alice');h.api.mine(b.p);assert.equal(b.slots.filter(i=>i?.typeId==='rush:rainbow_gem').length,0);assert.equal(a.slots.filter(i=>i?.typeId==='rush:rainbow_gem').length,1);});
test('exchanged items disappear and cannot pay twice',async()=>{const h=harness(),a=h.player('Alice');a.p.location={x:12,y:187,z:17};a.slots[1]={typeId:'minecraft:gold_block',amount:4};h.api.exchange(a.p);await new Promise(setImmediate);assert.equal(h.api.data(a.p).coins,480,a.p.lastMessage);assert.equal(a.slots[1],undefined);h.api.exchange(a.p);await new Promise(setImmediate);assert.equal(h.api.data(a.p).coins,480,a.p.lastMessage);});
test('quick touch release clears mining state without queued ghost input',()=>{const h=harness(),a=h.player('Alice');h.events.start({source:a.p,itemStack:{typeId:'rush:pick_5'}});h.events.stop({source:a.p});assert.equal(h.api.held.has(a.p.id),false);});
test('dug cells are persisted and replacement blocks cannot be farmed again',()=>{const h=harness(),q={x:30,y:188,z:60},a=h.player('Alice',q);h.dim.getBlock(q).setType('minecraft:dirt');h.api.mine(a.p);h.api.flush();const saved=h.properties.get('rush:dug_'+rules.segmentOf(q.z));assert.ok(rules.wasDug(rules.decodeBits(saved),rules.cellIndex(q)));h.dim.getBlock(q).setType('minecraft:gold_block');h.api.mine(a.p);assert.equal(a.slots.filter(i=>i?.typeId==='minecraft:gold_block').length,0);});

test('segment fills the old frontier last and marks entry air as already cleared',()=>{const h=harness(),work=h.api.fillSegment(0);work.next();assert.ok(h.blocks.has('16,180,41'));assert.equal(h.blocks.has('16,180,40'),false);let steps=1;while(!work.next().done){assert.ok(++steps<200);}assert.ok(h.blocks.has('16,180,40'));h.api.flush();const dug=rules.decodeBits(h.properties.get('rush:dug_0'));assert.ok(rules.wasDug(dug,rules.cellIndex({x:24,y:188,z:40})));assert.equal(h.dim.getBlock({x:24,y:188,z:40}).typeId,'minecraft:air');});

test('hard ore has hit feedback before breaking; wide swings play only one strike sound',()=>{
 const h=harness(),q={x:30,y:188,z:60},a=h.player('Alice',q);
 h.dim.getBlock(q).setType('rush:rainbow_ore');h.api.mine(a.p);
 assert.equal(a.p.animations.length,1);assert.equal(a.p.sounds.length,1);assert.equal(a.p.sounds[0],'hit.amethyst_cluster');
 assert.ok(a.p.particles.some(p=>p.id==='rush:rainbow_hit'));
 assert.equal(h.dim.getBlock(q).typeId,'rush:rainbow_ore');
 for(let i=0;i<3;i++)h.api.mine(a.p);
 assert.ok(a.p.sounds.includes('break.amethyst_cluster'));assert.ok(a.p.particles.some(p=>p.id==='rush:rainbow_break'));
});

test('each material produces its own collection particles and the configured sound',()=>{
 for(const [kind,m]of Object.entries(rules.MATERIALS)){
  const h=harness(),q={x:30,y:188,z:60},a=h.player('Alice',q);h.dim.getBlock(q).setType(m.block);
  for(let i=0;i<Math.ceil(m.hardness/50);i++)h.api.mine(a.p);
  assert.ok(a.p.particles.some(p=>p.id===`rush:${kind}_break`),kind);
  assert.ok(a.p.sounds.includes(MINING_EFFECTS[kind].break),kind);
  assert.ok(a.p.particles.every(p=>Object.values(p.q).every(Number.isFinite)));
 }
});

test('protected scenery and exhausted cells have no swing or mining reward effects',()=>{
 const h=harness(),a=h.player('Alice',{x:40,y:186,z:9});h.api.mine(a.p);assert.equal(a.p.animations.length,0);assert.equal(a.p.sounds.length,0);
});

test('native break uses the event block instead of a later ray target and never creates native drops',()=>{
 const h=harness(),q={x:30,y:188,z:60},a=h.player('Alice',q);h.dim.getBlock(q).setType('minecraft:gold_block');
 a.p.getBlockFromViewDirection=()=>undefined;
 const e={cancel:false,player:a.p,block:h.dim.getBlock(q),itemStack:a.slots[0]};h.events.break(e);
 assert.equal(e.cancel,true);assert.equal(h.dim.getBlock(q).typeId,'minecraft:air');assert.equal(a.slots.filter(i=>i?.typeId==='minecraft:gold_block').length,1);
 assert.equal(a.p.animations.length,0,'native hand animation must not be doubled');
});

test('native break preserves full-bag minerals and cannot break courtyard blocks',()=>{
 const h=harness(),q={x:30,y:188,z:60},a=h.player('Alice',q);h.dim.getBlock(q).setType('minecraft:gold_block');
 for(let i=1;i<36;i++)a.slots[i]={typeId:'minecraft:apple',amount:64};
 h.events.break({player:a.p,block:h.dim.getBlock(q),itemStack:a.slots[0]});assert.equal(h.dim.getBlock(q).typeId,'minecraft:gold_block');
 const lobby={x:40,y:188,z:10};h.dim.getBlock(lobby).setType('minecraft:gold_block');
 const e={cancel:false,player:a.p,block:h.dim.getBlock(lobby),itemStack:a.slots[0]};h.events.break(e);assert.equal(e.cancel,true);assert.equal(h.dim.getBlock(lobby).typeId,'minecraft:gold_block');
});

test('using the pick on solid blocks does not start automatic mining; liquids cannot harvest nearby solids',()=>{
 const h=harness(),q={x:30,y:188,z:60},a=h.player('Alice',q);h.dim.getBlock(q).setType('minecraft:stone');h.events.start({source:a.p,itemStack:a.slots[0]});
 assert.equal(h.api.held.has(a.p.id),false);assert.equal(h.dim.getBlock(q).typeId,'minecraft:stone');
 h.dim.getBlock(q).setType('minecraft:water');h.dim.getBlock(q).isLiquid=true;
 const near={...q,x:31};h.dim.getBlock(near).setType('minecraft:gold_block');
 a.slots[0]={typeId:'rush:siphon',amount:1};h.events.start({source:a.p,itemStack:a.slots[0]});assert.equal(h.dim.getBlock(q).typeId,'minecraft:air');assert.equal(h.dim.getBlock(near).typeId,'minecraft:gold_block');
 h.events.stop({source:a.p});assert.equal(h.api.held.has(a.p.id),false);
});

test('joining applies unrestricted native mining mode and supplies a separate liquid tool',()=>{
 const h=harness(),a=h.player('Alice');h.api.lobby(a.p);
 assert.equal(a.p.mode,'survival');assert.ok(a.slots.some(i=>i?.typeId==='rush:siphon'));
 assert.equal(a.slots[a.p.selectedSlotIndex].typeId,'rush:pick_5');
});

test('native mining mode still blocks building and bucket use but permits game tools',()=>{
 const h=harness(),a=h.player('Alice',{x:30,y:188,z:60});
 const place={cancel:false,player:a.p,itemStack:{typeId:'minecraft:gold_block'}};h.events.block(place);assert.equal(place.cancel,true);
 const bucket={cancel:false,source:a.p,itemStack:{typeId:'minecraft:lava_bucket'}};h.events.beforeUse(bucket);assert.equal(bucket.cancel,true);
 const guide={cancel:false,source:a.p,itemStack:{typeId:'rush:guide'}};h.events.beforeUse(guide);assert.equal(guide.cancel,false);
});
