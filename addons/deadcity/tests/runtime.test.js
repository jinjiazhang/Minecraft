import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import * as rules from '../pack/scripts/rules.js';
function setup(){
 const hooks={},commands={},players=[],props=new Map(),timeouts=[],intervals=[],hits=[];let wall=true;
 class ItemStack{constructor(typeId){this.typeId=typeId;}setLore(){}}
 class Player{constructor(id){this.id=id;this.isValid=true;this.location={...rules.BASE};this.dimension={id:'minecraft:overworld'};this.props=new Map();this.messages=[];this.inventory=Array(36);this.selectedSlotIndex=0;players.push(this);}
 getDynamicProperty(k){return this.props.get(k);}setDynamicProperty(k,v){this.props.set(k,v);}removeTag(){}addTag(){}setGameMode(){}setSpawnPoint(){}teleport(p){this.location={...p};}removeEffect(){}addEffect(){}playSound(){}sendMessage(m){this.messages.push(m);}
 getHeadLocation(){return{...this.location,y:this.location.y+1.6};}getViewDirection(){return{x:1,y:0,z:0};}
 getComponent(id){if(id==='minecraft:health')return{effectiveMax:20,currentValue:20,setCurrentValue(){}};if(id==='minecraft:inventory')return{container:{size:36,getItem:i=>this.inventory[i],setItem:(i,v)=>this.inventory[i]=v,addItem:v=>{const i=this.inventory.findIndex(x=>!x);if(i<0)return v;this.inventory[i]=v;}}};}
 }
 const enemy={id:'enemy',typeId:'dead:walker',isValid:true,hp:24,getComponent(){const e=this;return{get currentValue(){return e.hp;},setCurrentValue(v){e.hp=v;}};},applyDamage(v){hits.push(v);/* Simulate immunity: runtime must apply the missing damage. */},applyKnockback(){}};
 const d={getBlockFromRay(h){return wall?{block:{location:{x:h.x+2,y:h.y,z:h.z}},faceLocation:{x:0,y:0,z:0}}:undefined;},getEntitiesFromRay(h,v,o){return o.maxDistance<8?[]:[{entity:enemy,distance:8}];}};
 const world={getAllPlayers:()=>players,getDimension:()=>d,getDynamicProperty:k=>props.get(k),setDynamicProperty:(k,v)=>props.set(k,v),afterEvents:{}};
 for(const n of ['itemStartUse','itemStopUse','playerSpawn','playerLeave','entityHurt','entityDie','entityLoad','worldLoad'])world.afterEvents[n]={subscribe:f=>hooks[n]=f};
 const system={currentTick:1000,run:f=>f(),runTimeout:f=>timeouts.push(f),runInterval:f=>intervals.push(f),beforeEvents:{startup:{subscribe:f=>f({customCommandRegistry:{registerCommand:(s,f)=>commands[s.name]={s,f}}})}},afterEvents:{scriptEventReceive:{subscribe(){}}}};
 const context=vm.createContext({...rules,world,system,Player,ItemStack,ItemLockMode:{inventory:1},GameMode:{Adventure:2},EntityDamageCause:{entityAttack:1},CommandPermissionLevel:{Any:0},CustomCommandStatus:{Success:0,Failure:1},ActionFormData:class{},console});
 const src=fs.readFileSync(new URL('../pack/scripts/main.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
 vm.runInContext(src+'\nglobalThis.api={raids,start,shoot,finish,base,points,second,ready(){prepared=true;}};',context);
 return{...context.api,world,system,Player,hooks,commands,hits,enemy,setWall:v=>wall=v};
}
test('gun cannot hit through walls, does consume ammo; repeat damage survives native immunity',()=>{
 const t=setup(),p=new t.Player('p');t.ready();t.start(p);p.location.x+=50;const r=t.raids.get(p.id);t.shoot(p);assert.equal(t.hits.length,0);assert.equal(r.ammo,11);
 t.setWall(false);t.system.currentTick+=10;t.shoot(p);assert.equal(t.enemy.hp,17);t.system.currentTick+=10;t.shoot(p);assert.equal(t.enemy.hp,10);
});
test('shotgun pellets aggregate into one damage application',()=>{
 const t=setup(),p=new t.Player('p');p.setDynamicProperty('dead:profile','{"tier":1}');t.ready();t.start(p);p.location.x+=50;t.setWall(false);t.shoot(p);assert.deepEqual(t.hits,[30]);
});
test('success pays once; abort, logout and death never bank loot',()=>{
 const t=setup(),p=new t.Player('p');t.ready();t.start(p);rules.collect(t.raids.get(p.id),'c1');t.finish(p);t.finish(p);assert.equal(rules.profile(p.getDynamicProperty('dead:profile')).scrap,22);
 t.start(p);rules.collect(t.raids.get(p.id),'c2');t.base(p);assert.equal(rules.profile(p.getDynamicProperty('dead:profile')).scrap,22);
 t.start(p);rules.collect(t.raids.get(p.id),'c3');t.hooks.playerLeave({playerId:p.id});assert.equal(t.raids.size,0);assert.equal(rules.profile(p.getDynamicProperty('dead:profile')).scrap,22);
 t.start(p);rules.collect(t.raids.get(p.id),'c4');t.hooks.entityDie({deadEntity:p});assert.equal(t.raids.size,0);
});
test('kit preserves existing inventory and does not duplicate tools',()=>{
 const t=setup(),p=new t.Player('p');p.inventory[0]={typeId:'minecraft:diamond'};t.base(p);t.base(p);assert.equal(p.inventory[0].typeId,'minecraft:diamond');assert.equal(p.inventory.filter(v=>v?.typeId?.startsWith('dead:')).length,5);
});
test('ordinary players can access gameplay commands but not console entities',()=>{
 const t=setup();assert.equal(t.commands['dead:menu'].s.permissionLevel,0);assert.equal(t.commands['dead:start'].f({sourceEntity:{}}).status,1);
});
