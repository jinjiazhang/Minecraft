const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const hooks={}, joined=[], left=[], registered=[], placed=[];
const signal = name => ({ subscribe: fn => hooks[name]=fn });
class Player { constructor(id) { this.id=id; this.isValid=true; } addEffect() {} }
const player = new Player('online'); let initialized=0;
const api={ Direction:{Up:'Up',Down:'Down',North:'North',South:'South',East:'East',West:'West'}, Player, CommandPermissionLevel:{Any:0}, CustomCommandStatus:{Failure:1,Success:0},
  world:{ getAllPlayers:()=>[player], afterEvents:{worldLoad:signal('load'),playerSpawn:signal('spawn'),playerLeave:signal('leave')},beforeEvents:{explosion:signal('explosion'),playerInteractWithBlock:signal('interact'),playerBreakBlock:signal('break')} },
  system:{run:fn=>fn(),runInterval:()=>{},beforeEvents:{startup:signal('startup')},afterEvents:{scriptEventReceive:signal('script')}} };
const mod={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(`${__dirname}/../src/main.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{
  exports:mod.exports,module:mod,require:id=>id==='@minecraft/server'?api:id==='./menu'?{requestMenu:()=>{}}:{isBombItem:item=>item?.typeId==='minecraft:tnt',placeBombItem:(p,at,slot)=>placed.push([at,slot]),setRoundEndHandler:()=>{},initializeArena:()=>initialized++,joinBomber:p=>joined.push(p.id),leaveBomber:id=>left.push(id),bomberTick:()=>{}}
});
hooks.startup({customCommandRegistry:{registerCommand:spec=>registered.push(spec.name)}});
assert.deepEqual(registered,['bomber:menu']); hooks.load(); assert.equal(initialized,1); assert.deepEqual(joined,['online']);
hooks.spawn({player:new Player('new')}); assert.deepEqual(joined,['online','new']);
hooks.spawn({player}); assert.deepEqual(joined,['online','new','online']);
hooks.leave({playerId:'new'}); assert.deepEqual(left,['new']);
const manifest=JSON.parse(fs.readFileSync(`${__dirname}/../pack/manifest.json`));
const active=JSON.parse(fs.readFileSync(`${__dirname}/../world_behavior_packs.json`));
assert.equal(active.length,1); assert.equal(active[0].pack_id,manifest.header.uuid);
assert.notEqual(manifest.header.uuid,'e6dbce40-9abb-4353-a632-cbde68a206d0');
console.log('PASS Standalone startup: independent pack, auto-entry on world load, login and respawn, disconnect');

player.selectedSlotIndex=2;
const event={player,block:{location:{x:10203,y:80,z:10003}},blockFace:'Up',isFirstEvent:true,itemStack:{typeId:'minecraft:tnt'}};
hooks.interact(event); assert(event.cancel); assert.equal(JSON.stringify(placed),JSON.stringify([[{x:10203,y:81,z:10003},2]]));
hooks.interact({...event,isFirstEvent:false}); assert.equal(placed.length,1);
hooks.interact({...event,itemStack:{typeId:'minecraft:stone'}}); assert.equal(placed.length,1);
console.log('PASS Item placement: clicked face target, held-input debounce and non-bomb rejection');

const nativeExplosion={cancel:false}; hooks.explosion(nativeExplosion); assert(nativeExplosion.cancel);
console.log("PASS Native explosion is canceled; only scripted cross-shaped damage is allowed");
