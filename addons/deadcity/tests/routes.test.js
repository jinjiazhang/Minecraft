import test from 'node:test';import assert from 'node:assert/strict';
import {ROUTES} from '../pack/scripts/routes.js';import {BASE,SITES,EXITS,inside} from '../pack/scripts/rules.js';
test('all objectives have measured contiguous routes from the base',()=>{
 for(const s of [...SITES,...EXITS]){
  const path=ROUTES[s.id];assert.ok(path.length>1);assert.equal(path[0][0],Math.floor(BASE.x));assert.equal(path[0][2],Math.floor(BASE.z));
  const end=path.at(-1);assert.equal(end[0],s.x);assert.equal(end[2],s.z);
  for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i];assert.ok(inside({x:b[0],z:b[2]}));assert.equal(Math.abs(a[0]-b[0])+Math.abs(a[2]-b[2]),1);assert.ok(Math.abs(a[1]-b[1])<=1);}
 }
});
