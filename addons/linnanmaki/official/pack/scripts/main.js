import {system,world,Player,CommandPermissionLevel,CustomCommandStatus} from '@minecraft/server';
const x=-6940,z=-6585;
let arrival,ready=false,resetPending=false;
const confirmations=new Map();
function enter(p){
  if(!p.isValid)return;
  if(!ready){system.runTimeout(()=>enter(p),20);return;}
  p.runCommand('gamemode creative');
  p.teleport(arrival,{dimension:world.getDimension('overworld')});
  p.setSpawnPoint({...arrival,dimension:world.getDimension('overworld')});
}
system.beforeEvents.startup.subscribe(e=>{
  for(const [name,description,action] of [
    ['visit','返回 Linnanmäki 出生点',p=>enter(p)],
    ['reset','申请恢复官方原始存档，清除所有玩家和建筑改动',p=>{
      confirmations.set(p.id,system.currentTick+600);
      p.sendMessage('§c将清除整个服务器的建筑、背包与玩家进度，恢复官方地图。30 秒内输入 /lintsi:confirm 执行；服务器会短暂断开。');
    }],
    ['confirm','确认刚刚申请的全服存档重置',p=>{
      const expires=confirmations.get(p.id);confirmations.delete(p.id);
      if(expires===undefined||system.currentTick>expires){p.sendMessage('§e申请不存在或已过期，请先输入 /lintsi:reset。');return;}
      if(resetPending){p.sendMessage('§e重置正在处理。');return;}
      resetPending=true;
      world.sendMessage('§c管理员已确认重置官方地图，服务器即将重启，请稍后重新连接。');
      console.warn('HELSINKI_RESET_REQUEST_V1');
      system.runTimeout(()=>{resetPending=false;},2400);
    }]
  ])e.customCommandRegistry.registerCommand({name:'lintsi:'+name,description,permissionLevel:CommandPermissionLevel.Admin,cheatsRequired:true},origin=>{
    if(!(origin.sourceEntity instanceof Player))return{status:CustomCommandStatus.Failure,message:'请由管理员玩家执行。'};
    const p=origin.sourceEntity;system.run(()=>{if(p.isValid)action(p);});
    return{status:CustomCommandStatus.Success};
  });
});
world.afterEvents.worldLoad.subscribe(()=>system.runTimeout(()=>{
  const d=world.getDimension('overworld');
  try{d.runCommand(`tickingarea add circle ${x} 64 ${z} 1 helsinki_park_spawn true`);}catch{}
  let tries=0;
  function prepare(){
    try{
      const top=d.getTopmostBlock({x,z});if(!top)throw Error('Missing surface');
      arrival={x:x+.5,y:top.y+1,z:z+.5};
      world.setDefaultSpawnLocation({x,y:arrival.y,z});
      ready=true;
      console.warn('HELSINKI_SPAWN_READY '+JSON.stringify({...arrival,surface:top.typeId}));
      for(const p of world.getAllPlayers())enter(p);
    }catch(e){if(++tries<20)system.runTimeout(prepare,20);else console.warn('HELSINKI_SPAWN_FAILED '+e);}
  }
  system.runTimeout(prepare,40);
},20));
world.afterEvents.playerSpawn.subscribe(e=>system.runTimeout(()=>enter(e.player),10));
