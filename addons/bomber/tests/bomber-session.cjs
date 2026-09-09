const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const cache = new Map(), pending = [], commands = [], particles = [];
const system = { currentTick: 0, runTimeout: fn => pending.push(fn) };
const dimension = { id: 'minecraft:overworld', spawnParticle: (id, location) => particles.push({id,location}), runCommand: cmd => commands.push(cmd) };
class ItemStack { constructor(typeId,amount) { this.typeId=typeId; this.amount=amount; } setLore() {} setCanPlaceOn(blocks) { this.canPlaceOn=blocks; } }
const api = { ItemStack, system, world: { getDimension: () => dimension, setDefaultSpawnLocation: p => { assert.equal(p.x,10229.5); } }, GameMode: { Adventure: 'adventure' } };
function load(name) {
  if (cache.has(name)) return cache.get(name);
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(`${__dirname}/../src/${name}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText;
  vm.runInNewContext(code, { exports: mod.exports, module: mod, console, require: id => id.startsWith('.') ? load(id.slice(2)) : api });
  cache.set(name, mod.exports); return mod.exports;
}
function player(id) {
  const inventory = { size:36, items:[], getItem(i) { return this.items[i]; }, setItem(i,item) { this.items[i]=item; } };
  inventory.items[8]=new ItemStack('minecraft:diamond',3);
  return { inventory, selectedSlotIndex:0, getComponent:()=>({container:inventory}), id, name: id, isValid: true, isSneaking: false, mode: 'creative', dimension, location: {x:10020,y:81,z:10020}, messages: [],
    getGameMode() { return this.mode; }, setGameMode(mode) { this.mode=mode; },
    teleport(pos,opts) { this.location={...pos}; this.dimension=opts.dimension; },
    sendMessage(msg) { this.messages.push(msg); }, addEffect() {}, playSound() {}, onScreenDisplay: { setTitle() {}, setActionBar() {} }
  };
}
const b=load('bomber'), a=player('a'), friend=player('b'), third=player('c');
const shown=[]; b.setRoundEndHandler(p=>shown.push(p.id));
const tick = n => { for(let i=0;i<n;i++) { system.currentTick++; b.bomberTick(); } };
b.joinBomber(a); b.joinBomber(friend); b.joinBomber(third);
assert(b.inBomber(a)); assert(b.inBomber(friend)); assert(!b.inBomber(third)); assert.equal(pending.length,1);
pending.shift()(); assert.equal(a.location.x,10203); assert.equal(friend.location.x,10223);
assert.equal(a.mode,'adventure'); assert.equal(third.location.x,10229.5); assert.equal(a.inventory.items.filter(x=>x?.typeId==='minecraft:tnt').reduce((n,x)=>n+x.amount,0),256);
assert.equal(a.inventory.getItem(8).typeId,'minecraft:diamond'); assert(a.inventory.getItem(0).canPlaceOn.includes('minecraft:white_concrete'));
assert(!b.placeBombItem(a,a.location,0)); assert.equal(a.inventory.getItem(0).amount,64);
tick(60); assert(b.placeBombItem(a,a.location,0)); assert.equal(a.inventory.getItem(0).amount,63);
assert(!b.placeBombItem(a,a.location,0)); assert.equal(a.inventory.getItem(0).amount,63);
assert(commands.some(c=>c==='fill 10202 81 10002 10202 81 10002 minecraft:red_concrete'));
tick(99); assert(!a.messages.some(m=>m.includes('b 获胜'))); tick(1);
assert(a.messages.some(m=>m.includes('b 获胜')));
assert.equal(particles.filter(p=>p.id==='minecraft:large_explosion').length,1);
assert(particles.some(p=>p.id==='minecraft:basic_flame_particle'));
assert(particles.some(p=>p.id==='minecraft:basic_smoke_particle'));
assert.equal(pending.length,1); pending.shift()(); assert.deepEqual(shown,['a','b']); tick(10); assert.equal(pending.length,0);
b.rematch(a); assert(b.bomberStatus().includes('本局结束')); b.rematch(friend); assert(b.bomberStatus().includes('对战中')); assert.equal(a.inventory.getItem(0).amount,64);
b.leaveBomber(a.id); assert(!b.inBomber(a)); assert.equal(a.mode,'adventure'); assert(b.bomberStatus().includes('等待伙伴'));
tick(1); assert(b.inBomber(third)); assert(b.bomberStatus().includes('对战中'));
friend.isValid=false; tick(1); assert(!b.inBomber(friend)); assert(b.bomberStatus().includes('等待伙伴'));
third.location={x:0,y:80,z:0}; b.joinBomber(third); assert.equal(third.location.x,10203);
b.leaveBomber(third.id); assert(!b.inBomber(third));
for(const command of commands.filter(c=>c.startsWith('fill '))) {
  const parts=command.split(' '), nums=parts.slice(1,7).map(Number);
  const [x,y,z,xx,yy,zz]=nums;
  assert(x>=10200 && xx<=10231 && z>=10000 && zz<=10021 && y>=80 && yy<=84);
  assert((xx-x+1)*(yy-y+1)*(zz-z+1)<=32768);
  assert(!command.includes('minecraft:tnt'), 'Never place native TNT');
  assert(!command.includes('minecraft:redstone_block'), 'Never power a native explosive');
}
console.log('PASS Session: capacity, build, countdown, winner, mutual rematch, disconnect cleanup, disconnect, arena boundaries');

const { BomberMatch }=load('bomber-model'), { explosionEffects }=load('bomber-effects');
const m=new BomberMatch(['x','y'],()=>1), base={x:10200,y:80,z:10000};
m.bombs.set('1,1',{x:1,z:1,owner:'x',range:2,due:1});
m.bombs.set('3,1',{x:3,z:1,owner:'y',range:2,due:50});
const bombs=[...m.bombs.values()]; m.step(); const effects=[];
explosionEffects({spawnParticle:(id,location)=>effects.push({id,location})},base,m,bombs);
assert.equal(effects.filter(p=>p.id==='minecraft:large_explosion').length,2);
for(const p of effects.filter(p=>p.id==='minecraft:basic_flame_particle')) {
  const k=`${Math.floor((p.location.x-base.x)/2)},${Math.floor((p.location.z-base.z)/2)}`;
  assert(m.flames.has(k)); assert(!m.walls.has(k));
}
assert.doesNotThrow(()=>explosionEffects({spawnParticle:()=>{throw Error('Unavailable particle');}},base,m,bombs));
assert.equal(m.winner,'y');
console.log('PASS Effects: detonation and chain flashes, smoke, flame cells match damage, cosmetic failure isolation');
