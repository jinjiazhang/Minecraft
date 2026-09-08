import { Player, system, world } from "@minecraft/server";
import { asVector, prepareCandyPort } from "./park";
import { tickPuzzles } from "./puzzles";
import { building, clearCourse, course, createState, missingTokens, sessions, setBuilding, setCourse } from "./state";
import { tryOpenTower } from "./tower";

export function tellStory(player: Player): void {
  player.sendMessage("§d果冻精灵被锁在彩虹塔顶。");
  player.sendMessage("§7五条糖路各有一件信物：粉路迷宫、品红踩音符、蓝路镜子、红路三色钥匙、巧克力轨道。");
}

export function remind(player: Player): boolean {
  const state = sessions.get(player.id);
  if (!state) {
    return false;
  }
  const missing = missingTokens(state);
  player.sendMessage(missing.length === 0 ? "§e信物齐了，去彩虹塔门口救人。" : `§e还缺：§r${missing.join("、")}`);
  return true;
}

function finishStart(player: Player): void {
  sessions.set(player.id, createState());
  player.runCommand("gamemode adventure @s");
  for (const item of ["amethyst_shard", "slime_ball", "glass", "gold_nugget", "cookie", "red_dye", "blue_dye", "yellow_dye"]) {
    player.runCommand(`clear @s ${item}`);
  }
  player.sendMessage("§d—— 彩虹糖果港 ——");
  tellStory(player);
}

function beginBuild(player: Player, startHunt: boolean): void {
  if (building) {
    player.sendMessage("§7正在清地形、布置糖果港，请稍等。");
    return;
  }
  setBuilding(true);
  player.sendMessage("§e先清掉默认地图，再铺糖果港…");
  prepareCandyPort(player, course, (built) => {
    setCourse(built);
    setBuilding(false);
    player.teleport(asVector(built.hub));
    if (startHunt) {
      finishStart(player);
      return;
    }
    player.sendMessage("§a原版地形已清掉，糖果港已经铺好。聊天输入 /menu 打开菜单。");
    tellStory(player);
  });
}

export function startGame(player: Player): void {
  beginBuild(player, true);
}

export function resumeGame(player: Player): void {
  if (!sessions.has(player.id)) {
    startGame(player);
    return;
  }
  if (course) {
    player.teleport(asVector(course.hub));
  }
  remind(player);
}

export function wipeWorld(player: Player): void {
  player.sendMessage("§e正在删除存档并生成新世界，请重新进服。");
  console.warn("LODESTONE_WIPE_WORLD");
  clearCourse();
  try {
    player.runCommand("kick @a 世界正在重新生成，请重新进服");
  } catch {
    // 服务端清档时会把人踢掉
  }
}

export function onJoin(player: Player): void {
  if (course) {
    player.teleport(asVector(course.hub));
    player.sendMessage("§d欢迎来到彩虹糖果港。§r聊天输入 /menu 打开菜单。");
    return;
  }
  beginBuild(player, false);
}

function tick(): void {
  if (!course) {
    return;
  }
  for (const player of world.getAllPlayers()) {
    const state = sessions.get(player.id);
    if (!state) {
      continue;
    }
    if (state.cooldown > 0) {
      state.cooldown -= 1;
      continue;
    }
    tickPuzzles(player, state);
    tryOpenTower(player, state);
  }
}

system.runInterval(() => {
  try {
    tick();
  } catch {
    // 区块未加载时跳过
  }
}, 8);
