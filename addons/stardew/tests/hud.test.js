import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=path=>JSON.parse(fs.readFileSync(new URL('../'+path,import.meta.url),'utf8'));
test('top status label renders the title binding instead of leaving text empty',()=>{
 const ui=read('resource_pack/ui/hud_screen.json');
 const panel=ui.hud_title_text;
 const labels=panel.controls.flatMap(c=>Object.values(c)).filter(c=>c.type==='label');
 assert.ok(labels.length);
 for(const label of labels){
  const binding=label.bindings.find(b=>b.binding_name==='#hud_title_text_string');
  assert.ok(binding,'status label must receive title data');
  assert.equal(label.text,binding.binding_name_override,'receiving a binding alone does not render its text');
  assert.equal(label.localize,false);
 }
 assert.equal(panel.anchor_from,'top_middle');
 assert.equal(panel.anchor_to,'top_middle');
});
test('behavior pack requests exactly the shipped HUD resource pack version',()=>{
 const bp=read('pack/manifest.json'),rp=read('resource_pack/manifest.json');
 const dependency=bp.dependencies.find(d=>d.uuid===rp.header.uuid);
 assert.ok(dependency);
 assert.deepEqual(dependency.version,rp.header.version);
});
