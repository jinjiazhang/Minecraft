const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const cache = new Map();
function load(name) {
  if (cache.has(name)) return cache.get(name);
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', name + '.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText;
  vm.runInNewContext(code, { exports: module.exports, module, require: id => id.startsWith('.') ? load(id.slice(2)) : {}, console });
  cache.set(name, module.exports); return module.exports;
}
const { freshQuest, act, validQuest } = load('quest');
let checks = 0;
function test(name, fn) { fn(); checks++; console.log('PASS', name); }
test('Two children complete all six scenes, with disconnect serialization between every action', () => {
  let q = freshQuest(); q.roster = ['child1', 'child2'];
  const click = (who, id) => { const out = act(q, who, id); q = JSON.parse(JSON.stringify(q)); assert(validQuest(q)); return out; };
  click('child1', 'ready0'); click('child1', 'ready1'); assert.equal(q.stage, 0);
  click('child2', 'ready1'); assert.equal(q.stage, 1);
  click('child1', 'engine0'); assert.equal(Object.keys(q.pairs).length, 0);
  for (const id of ['gear', 'lens', 'battery']) click('child1', id);
  click('child1','gear'); assert.equal(q.parts.length,3);
  click('child1','engine0'); click('child2','engine1'); assert.equal(q.stage,2);
  for (const id of ['red','blue','yellow']) {
    click('child2',id); assert.equal(q.reader,'');
    click('child1','read'); const step=q.step; click('child1',id); assert.equal(q.step,step);
    click('child2','violet'); assert.equal(q.step,step);
    click('child2',id);
  }
  assert.equal(q.stage,3);
  click('child2','valve1'); click('child2','valve0'); assert.equal(q.stage,3);
  click('child1','valve0'); assert.equal(q.stage,4);
  for (const id of ['violet','cyan','pink']) { click('child2','read'); click('child1',id); }
  assert.equal(q.stage,5);
  click('child1','plant0'); click('child2','plant1'); assert.equal(q.stage,6);
  assert.equal(Object.keys(q.pairs).length,0);
});
test('Spectators cannot progress and incorrect color keeps the current step', () => {
  const q=freshQuest(); q.roster=['a','b']; q.stage=4; q.step=1;
  act(q,'spectator','read'); assert.equal(q.reader,'');
  act(q,'a','read'); act(q,'b','pink'); assert.equal(q.step,1); assert.equal(q.reader,'a');
});
test('Malformed saves rejected', () => {
  assert(!validQuest(null)); assert(!validQuest({...freshQuest(),stage:7}));
  assert(!validQuest({...freshQuest(),roster:['a','a']})); assert(!validQuest({...freshQuest(),step:3}));
});
const { buildPlan, visualPlan, stations, spawn, at, roomOf, BASE } = load('scenes');
const jobs=buildPlan();
test('Every build operation is bounded, and all six spawns map to correct rooms', () => {
  for (const j of jobs) {
    if(j.kind!=='fill') continue;
    assert(j.a.x<=j.b.x && j.a.y<=j.b.y && j.a.z<=j.b.z);
    assert((j.b.x-j.a.x+1)*(j.b.y-j.a.y+1)*(j.b.z-j.a.z+1)<=32768);
    assert(j.a.x>=BASE.x && j.b.x<=BASE.x+143 && j.a.z>=BASE.z && j.b.z<=BASE.z+95);
  }
  for(let r=0;r<6;r++) assert.equal(roomOf(spawn(r)),r);
  assert.equal(roomOf({x:0,y:80,z:0}),-1);
});
// Replay final block geometry, then flood-fill walkable ground from each spawn.
const blocks=new Map(); const key=(x,y,z)=>`${x},${y},${z}`;
for (const j of jobs) {
  if(j.kind==='sign') { blocks.set(key(j.p.x,j.p.y,j.p.z),'standing_sign'); continue; }
  // Walking and interaction need only floor, feet, head and sign layers.
  for(let x=j.a.x;x<=j.b.x;x++) for(let z=j.a.z;z<=j.b.z;z++) for(let y=Math.max(79,j.a.y);y<=Math.min(82,j.b.y);y++) blocks.set(key(x,y,z),j.block);
}
const passable = b => ['air','standing_sign','red_tulip','lantern','lightning_rod'].includes(b);
test('All 37+ stations have intact markers/signs and a reachable interaction position', () => {
  assert(stations.length>=37);
  for(let r=0;r<6;r++) {
    const s=spawn(r), queue=[[Math.floor(s.x),Math.floor(s.z)]], seen=new Set();
    for(let i=0;i<queue.length;i++) {
      const [x,z]=queue[i], k=`${x},${z}`; if(seen.has(k)) continue;
      if(!passable(blocks.get(key(x,80,z))) || !passable(blocks.get(key(x,81,z))) || !blocks.has(key(x,79,z)) || blocks.get(key(x,79,z))==='air') continue;
      seen.add(k); for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]) if(Math.abs(x+dx-s.x)<23 && Math.abs(z+dz-at(r).z)<22) queue.push([x+dx,z+dz]);
    }
    assert(seen.size>100,`Room ${r} spawn blocked`);
    for(const station of stations.filter(x=>x.room===r)) {
      const p=at(r,station.x,0,station.z);
      assert.equal(blocks.get(key(p.x,81,p.z)),station.block,station.id);
      assert.equal(blocks.get(key(p.x,82,p.z)),'standing_sign',station.id);
      assert([[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dz])=>seen.has(`${p.x+dx},${p.z+dz}`)),`Station ${r}:${station.id} unreachable`);
    }
  }
});
test('Build uses Bedrock block ids, not Java-only names', () => {
  const javaOnly = new Set(['flowering_azalea_leaves', 'rooted_dirt', 'grass_block']);
  const q = freshQuest(); q.stage = 6; q.pairs = { valve0: true, valve1: true };
  for (const j of [...jobs, ...visualPlan(q)]) {
    if (j.kind !== 'fill') continue;
    assert(!javaOnly.has(j.block), j.block);
  }
});
test('Progress and finale visual operations are bounded and preserve station controls', () => {
  for(let stage=0;stage<=6;stage++) {
    const q=freshQuest(); q.stage=stage;
    for(const j of visualPlan(q)) {
      if(j.kind!=='fill') continue;
      assert((j.b.x-j.a.x+1)*(j.b.y-j.a.y+1)*(j.b.z-j.a.z+1)<=32768);
      for(const s of stations) { const p=at(s.room,s.x,1,s.z); assert(!(p.x>=j.a.x && p.x<=j.b.x && p.y>=j.a.y && p.y<=j.b.y && p.z>=j.a.z && p.z<=j.b.z),`Visual overwrites ${s.id}`); }
    }
  }
});
console.log(`${checks} checks passed; ${jobs.length} build jobs; ${stations.length} stations.`);
