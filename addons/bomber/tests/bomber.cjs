const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const moduleRules = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(`${__dirname}/../src/bomber-model.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText, { exports: moduleRules.exports, module: moduleRules });
const { BomberMatch, FUSE, FLAME, WIDTH, HEIGHT, ROUND, key } = moduleRules.exports;
let count = 0;
const test = (name, fn) => { fn(); count++; console.log('PASS', name); };
const empty = () => new BomberMatch(['a', 'b'], () => 1);
const advance = (m, n) => { for (let i=0;i<n;i++) m.step(); };
test('Seeded arenas are symmetric and both corners have two escape tiles', () => {
  for(let seed=1;seed<=100;seed++) {
    let state=seed; const m=new BomberMatch(['a','b'],()=>((state=(state*1664525+1013904223)>>>0)/2**32));
    for(const k of m.crates) { const [x,z]=k.split(',').map(Number); const mirror=key({x:WIDTH-1-x,z:HEIGHT-1-z}); assert(m.crates.has(mirror)); assert.equal(m.hidden.get(k),m.hidden.get(mirror)); }
    for(const p of [{x:1,z:1},{x:2,z:1},{x:1,z:2},{x:11,z:9},{x:10,z:9},{x:11,z:8}]) { assert(!m.walls.has(key(p))); assert(!m.crates.has(key(p))); }
  }
});
test('Bomb limit, fuse, owner escape and blocked re-entry', () => {
  const m=empty(); assert(m.place('a')); assert(!m.place('a')); assert(m.move('a',{x:2,z:1})); assert(!m.move('a',{x:1,z:1}));
  assert(m.move('a',{x:3,z:1})); assert(m.move('a',{x:3,z:2}));
  advance(m,FUSE-1); assert.equal(m.bombs.size,1); m.step(); assert.equal(m.bombs.size,0); assert(m.flames.has('1,1')); assert(m.players[0].alive);
  advance(m,FLAME); assert.equal(m.flames.size,0); assert(m.place('a'));
});
test('Blast stops at pillars and first crate; drops remain until flame ends', () => {
  const m=empty(); m.players[0].x=3; m.players[0].z=3; m.players[0].range=6; m.place('a');
  m.crates.add('5,3'); m.hidden.set('5,3','range'); m.players[0].x=1; m.players[0].z=7;
  advance(m,FUSE); assert(m.flames.has('5,3')); assert(!m.flames.has('6,3')); assert(!m.crates.has('5,3')); assert.equal(m.gifts.get('5,3'),'range');
  assert(!m.flames.has('2,2')); advance(m,FLAME); m.players[0].x=5; m.players[0].z=3; m.step(); assert.equal(m.players[0].range,6); assert(!m.gifts.has('5,3'));
});
test('A newer bomb chain-detonates in the same tick', () => {
  const m=empty(); m.place('a'); advance(m,10); m.players[1].x=3; m.players[1].z=1; m.place('b');
  m.players[0].x=1; m.players[0].z=7; m.players[1].x=11; m.players[1].z=9;
  advance(m,FUSE-10); assert.equal(m.bombs.size,0); assert(m.flames.has('5,1'));
});
test('Simultaneous bombs cannot pierce a crate destroyed that tick', () => {
  const m=empty(); m.bombs.set('1,3',{x:1,z:3,owner:'a',range:6,due:1}); m.bombs.set('3,1',{x:3,z:1,owner:'b',range:6,due:1}); m.crates.add('3,3');
  m.step(); assert(!m.flames.has('4,3')); assert(!m.flames.has('3,4'));
});
test('Mutual elimination draws; eliminated players cannot place or move', () => {
  const m=empty(); m.players[1].x=2; m.players[1].z=1; m.place('a'); advance(m,FUSE);
  assert(m.ended); assert.equal(m.winner,undefined); assert(!m.players[0].alive); assert(!m.players[1].alive); assert(!m.place('a')); assert(!m.move('b',{x:3,z:1}));
});
test('Self elimination awards the surviving player', () => {
  const m=empty(); m.place('a'); advance(m,FUSE); assert.equal(m.winner,'b');
});
test('Lingering flames kill on entry; gifts do not protect players', () => {
  const m=empty(); m.flames.set('2,1',20); m.gifts.set('2,1','range'); m.move('a',{x:2,z:1}); m.step(); assert(!m.players[0].alive); assert.equal(m.players[0].range,2);
});
test('Upgrades increase and cap capacity and firepower', () => {
  const m=empty(); for(let i=0;i<10;i++) { m.gifts.set('1,1','range'); m.step(); m.gifts.set('1,1','capacity'); m.step(); }
  assert.equal(m.players[0].range,6); assert.equal(m.players[0].capacity,4);
});
test('Round time limit ends in draw and blocks further simulation', () => {
  const m=empty(); advance(m,ROUND); assert(m.ended); assert.equal(m.winner,undefined); m.step(); assert.equal(m.time,ROUND);
});
test('Invalid roster and impossible movement rejected', () => {
  assert.throws(()=>new BomberMatch(['a','a'])); const m=empty(); assert(!m.move('a',{x:11,z:9})); assert(!m.move('a',{x:0,z:1})); assert(!m.move('a',{x:-1,z:1}));
});


test('Placement target must be adjacent, empty and inside arena', () => {
  const m=empty(); assert.equal(FUSE,100); assert(!m.place('a',{x:0,z:1})); assert(!m.place('a',{x:3,z:1}));
  m.crates.add('2,1'); assert(!m.place('a',{x:2,z:1})); m.crates.delete('2,1');
  assert(m.place('a',{x:2,z:1})); assert(m.bombs.has('2,1')); assert(!m.move('a',{x:2,z:1}));
});

console.log(`${count} bomber rule checks passed.`);
