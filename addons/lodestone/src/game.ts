import { Player, system, world } from "@minecraft/server";
import { asVector, buildCandyPort } from "./park";
import { tickPuzzles } from "./puzzles";
import { course, createState, missingTokens, sessions, setCourse } from "./state";
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

export function startGame(player: Player): void {
  const built = setCourse(buildCandyPort(player, course));
  sessions.set(player.id, createState());
  player.runCommand("gamemode adventure @s");
  for (const item of ["amethyst_shard", "slime_ball", "glass", "gold_nugget", "cookie", "red_dye", "blue_dye", "yellow_dye"]) {
    player.runCommand(`clear @s ${item}`);
  }
  player.teleport(asVector(built.hub));
  player.sendMessage("§d—— 彩虹糖果港 ——");
  tellStory(player);
}

export function onJoin(player: Player): void {
  if (course) {
    player.teleport(asVector(course.hub));
    player.sendMessage("§d欢迎来到彩虹糖果港。§r打开菜单开始救人。");
    return;
  }
  player.sendMessage("§e正在建造糖果港…");
  system.runTimeout(() => {
    if (!player.isValid) {
      return;
    }
    setCourse(buildCandyPort(player));
    player.teleport(asVector(course!.hub));
    player.sendMessage("§a港口和五条糖路已经出现。打开菜单开始。");
    tellStory(player);
  }, 25);
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
