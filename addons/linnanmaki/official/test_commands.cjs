const fs=require('fs'),vm=require('vm'),assert=require('assert');
const cmds={},messages=[],logs=[],jobs=[];
class Player {constructor(id){this.id=id;this.isValid=true;}sendMessage(m){messages.push(m);}}
const system={currentTick:0,beforeEvents:{startup:{subscribe(fn){fn({customCommandRegistry:{registerCommand(s,f){assert.equal(s.permissionLevel,2);cmds[s.name]=f;}}});}}},run:f=>f(),runTimeout:f=>jobs.push(f)};
const world={sendMessage:m=>messages.push(m),afterEvents:{worldLoad:{subscribe(){}},playerSpawn:{subscribe(){}}}};
vm.runInNewContext(fs.readFileSync(__dirname+'/pack/scripts/main.js','utf8').replace(/^import .*;\r?\n/gm,''),{system,world,Player,gameplayEnabled:false,CommandPermissionLevel:{Admin:2},CustomCommandStatus:{Failure:1,Success:0},console:{warn:m=>logs.push(m)}});
const a=new Player('a'),b=new Player('b'),run=(name,p=a)=>cmds['lintsi:'+name]({sourceEntity:p});
run('confirm');assert.equal(logs.length,0);
run('reset');run('confirm',b);assert.equal(logs.length,0);
system.currentTick=601;run('confirm');assert.equal(logs.length,0);
run('reset');run('confirm');assert.deepEqual(logs,['HELSINKI_RESET_REQUEST_V1']);
run('reset');run('confirm');assert.equal(logs.length,1);
assert.equal(run('reset',{}).status,1);
console.log('PASS admin registration, same-player confirmation, expiration, duplicate suppression, nonplayer rejection');
