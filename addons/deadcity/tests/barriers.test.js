import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
function setup(){
 const props=new Map(),blocks=new Map();const get=p=>{const k=p.x+','+p.y+','+p.z;if(!blocks.has(k))blocks.set(k,{typeId:'minecraft:air',get isAir(){return this.typeId==='minecraft:air';},setType(id){this.typeId=id;}});return blocks.get(k);};
 const world={getDynamicProperty:k=>props.get(k),setDynamicProperty:(k,v)=>props.set(k,v),getDimension:()=>({getTopmostBlock:()=>({y:30}),getBlock:get})};
 const ctx=vm.createContext({world,Date});const source=fs.readFileSync(new URL('../pack/scripts/barriers.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export function/g,'function');vm.runInContext(source+'\nglobalThis.api={barricade,clearBarriers};',ctx);
 return{...ctx.api,blocks,get,props,p:{location:{x:10,y:31,z:10},getViewDirection:()=>({x:1,z:0})}};
}
test('barriers restore only air placements and preserve subsequent player changes',()=>{
 const t=setup();assert.ok(t.barricade(t.p));assert.equal([...t.blocks.values()].filter(b=>b.typeId.includes('fence')).length,3);
 const changed=[...t.blocks.values()][0];changed.setType('minecraft:diamond_block');t.clearBarriers(true);
 assert.equal(changed.typeId,'minecraft:diamond_block');assert.equal([...t.blocks.values()].filter(b=>b.typeId==='minecraft:air').length,2);assert.equal(t.props.get('dead:barriers'),'[]');
});
test('occupied positions reject the entire placement without overwriting blocks',()=>{
 const t=setup();t.get({x:8,y:31,z:9}).setType('minecraft:stone');assert.equal(t.barricade(t.p),false);assert.equal(t.props.size,0);assert.equal([...t.blocks.values()][0].typeId,'minecraft:stone');
});
