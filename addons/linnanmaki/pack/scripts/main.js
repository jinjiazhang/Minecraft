import { CommandPermissionLevel, CustomCommandStatus, Player, system, world } from '@minecraft/server';
import { tiles, settings } from './tiles.js';

let running = false;
let timer;
let activeArea;
const key = settings.key;
const dimension = () => world.getDimension('overworld');
const arrival = settings.arrival;
function log(message) { console.warn(`[LINNANMAKI] ${message}`); }
function start() {
  if(running) return;
  running=true;
  log(`BUILD_START ${Number(world.getDynamicProperty(key) ?? 0)}/${tiles.length}`);
  next();
}
function enter(player) {
  if (!player.isValid) return;
  player.runCommand('gamemode creative');
  player.teleport(arrival,{dimension:dimension(),rotation:{x:35,y:180}});
  player.setSpawnPoint({...arrival,dimension:dimension()});
  player.sendMessage('§b欢迎来到 Linnanmäki！双击跳跃可飞行参观。当前为 2017 年测绘底图样片，设施尚不可乘坐。');
}
function cleanup() {
  if (timer !== undefined) system.clearRun(timer);
  timer = undefined;
  try { dimension().runCommand('tickingarea remove lintsi_sample'); } catch {}
  if(activeArea) { try {dimension().runCommand(`tickingarea remove ${activeArea}`);} catch {} activeArea=undefined; }
  running = false;
}
function next() {
  if (!running) return;
  const i = Number(world.getDynamicProperty(key) ?? 0);
  if (i >= tiles.length) {
    cleanup();
    log(`BUILD_COMPLETE ${i}/${tiles.length}`);
    world.sendMessage('§aLinnanmäki 测绘底图样片生成完成。/lintsi:visit 俯瞰。设施尚不可乘坐。');
    return;
  }
  const t = tiles[i];
  try {
    activeArea=`lintsi_gen_${i}`;
    const result=dimension().runCommand(`tickingarea add ${t.x} 64 ${t.z} ${t.x+t.sx-1} 64 ${t.z+t.sz-1} ${activeArea} true`);
    if(result.successCount===0) throw new Error('tickingarea add returned zero');
  } catch (error) {
    cleanup(); log(`BUILD_FAILED ${i}: ${error}`); world.sendMessage(`§c无法加载生成区域：${error}`); return;
  }
  let retries = 0;
  function place() {
    if (!running) return;
    try {
      const d = dimension();
      for (const x of [t.x,t.x+t.sx-1]) for (const z of [t.z,t.z+t.sz-1]) {
        if (!d.getBlock({x,y:t.y,z})) throw new Error('区块尚未加载');
      }
      world.structureManager.place(t.id,d,{x:t.x,y:t.y,z:t.z});
      world.setDynamicProperty(key,i+1);
      d.runCommand(`tickingarea remove ${activeArea}`);
      activeArea=undefined;
      if ((i+1)%16===0) { log(`BUILD_PROGRESS ${i+1}/${tiles.length}`); world.sendMessage(`§7底图生成 ${i+1}/${tiles.length}`); }
      timer=system.runTimeout(next,2);
    } catch (error) {
      if (++retries<5) timer=system.runTimeout(place,40);
      else { cleanup(); log(`BUILD_FAILED ${i}: ${error}`); world.sendMessage(`§c底图停在 ${i}/${tiles.length}：${error}。可用 /lintsi:build 重试。`); }
    }
  }
  timer=system.runTimeout(place,10);
}

system.beforeEvents.startup.subscribe(event => {
  for (const [name, description, action] of [
    ['build','生成当前版本的室外底图；已完成区域会跳过',() => {
      world.sendMessage('开始生成 2017 测绘底图样片，约需数分钟。/lintsi:stop 可暂停。');
      start();
    }],
    ['stop','暂停测绘底图生成',() => {cleanup(); world.sendMessage('底图生成已暂停，可用 /lintsi:build 续建。');}],
    ['visit','创造模式俯瞰测绘底图样片',p => {
      enter(p);
    }]
  ]) {
    event.customCommandRegistry.registerCommand({name:'lintsi:'+name,description,permissionLevel:CommandPermissionLevel.Admin,cheatsRequired:true},origin => {
      if (!(origin.sourceEntity instanceof Player)) return {status:CustomCommandStatus.Failure,message:'请由玩家执行。'};
      const player=origin.sourceEntity;
      system.run(() => {if(player.isValid) action(player);});
      return {status:CustomCommandStatus.Success};
    });
  }
});

world.afterEvents.worldLoad.subscribe(() => {
  system.runTimeout(() => {
    const d=dimension();
    d.runCommand('gamerule doDaylightCycle false');
    d.runCommand('gamerule doWeatherCycle false');
    d.runCommand('gamerule doMobSpawning false');
    d.runCommand('time set noon');
    d.runCommand('weather clear');
    try {d.runCommand('tickingarea remove lintsi_arrival');} catch {}
    const x=Math.floor(arrival.x),z=Math.floor(arrival.z),y=Math.floor(arrival.y);
    // Reuse the persistent region on restart. Removing and immediately adding
    // the same name can asynchronously unload the replacement in BDS.
    try {d.runCommand(`tickingarea add circle ${x} ${y-1} ${z} 1 lintsi_arrival_${x}_${z} true`);} catch {}
    world.setDefaultSpawnLocation({x,y,z});
    let attempts=0;
    function prepare() {
      try {
        d.runCommand(`fill ${x-4} ${y-1} ${z-4} ${x+4} ${y-1} ${z+4} glass`);
        log('ARRIVAL_READY');
        for(const p of world.getAllPlayers()) enter(p);
        start();
      } catch(error) {
        if(++attempts<10) system.runTimeout(prepare,40);
        else log(`ARRIVAL_FAILED ${error}`);
      }
    }
    system.runTimeout(prepare,40);
  },20);
});
world.afterEvents.playerSpawn.subscribe(event => {
  const p=event.player;
  system.runTimeout(() => enter(p),20);
});
system.afterEvents.scriptEventReceive.subscribe(event => {
  if(event.id==='lintsi:status') log(`STATUS ${world.getDynamicProperty(key) ?? 0}/${tiles.length} running=${running}`);
  if(event.id==='lintsi:resume' && !event.sourceEntity) start();
});
