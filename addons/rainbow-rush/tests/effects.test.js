import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {MinecraftBlockTypes} from '@minecraft/vanilla-data';
import {details} from '../pack/scripts/scenery.js';
import {MINING_EFFECTS} from '../pack/scripts/effects.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'));
test('every custom item icon resolves through our explicit atlas, including all six picks',()=>{
 const atlas=read('resource_pack/textures/item_texture.json').texture_data;
 for(const id of ['pick_0','pick_1','pick_2','pick_3','pick_4','pick_5','guide','return','rainbow_gem']){
  const c=read(`pack/items/${id}.json`)['minecraft:item'].components;
  assert.ok(atlas[c['minecraft:icon'].textures.default],id);
  if(id.startsWith('pick_'))assert.match(atlas[c['minecraft:icon'].textures.default].textures,/pickaxe$/);
 }
 assert.equal(read('pack/items/pick_5.json')['minecraft:item'].components['minecraft:glint'],true);
});
test('material particles all resolve and swing terminates before the next strike',()=>{
 for(const kind of Object.keys(MINING_EFFECTS))for(const phase of ['hit','break'])assert.equal(read(`resource_pack/particles/${kind}_${phase}.json`).particle_effect.description.identifier,`rush:${kind}_${phase}`);
 const swing=read('resource_pack/animations/mining.animation.json').animations['animation.rush.pick_swing'];assert.equal(swing.loop,false);assert.ok(swing.animation_length<.3);
});
test('detail migration stays outside mining cells and uses real fine-profile blocks',()=>{
 const ids=new Set(Object.values(MinecraftBlockTypes));let slabs=0;
 for(const command of details()){const t=command.split(' ');assert.ok(Number(t[3])>=0&&Number(t[6])<40,command);assert.ok(ids.has('minecraft:'+t[7]),command);if(t[7].endsWith('_slab'))slabs++;}
 assert.ok(slabs>=10);
});
test('every tier has native digging speeds and stronger picks always mine each material faster',()=>{
 let previous;
 for(let tier=0;tier<6;tier++){
  const c=read(`pack/items/pick_${tier}.json`)['minecraft:item'].components,d=c['minecraft:digger'].destroy_speeds;
  for(const key of ['minecraft:interact_button','minecraft:food','minecraft:use_modifiers','minecraft:use_animation'])assert.equal(c[key],undefined);assert.ok(d.length>=8);
  for(const entry of d){assert.ok(entry.speed>0);if(previous)assert.ok(entry.speed>previous.find(p=>p.block===entry.block).speed);}
  previous=d;
 }
});
