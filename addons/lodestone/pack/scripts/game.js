import { system, world } from "@minecraft/server";
import { asVector, buildCandyPort } from "./park";
import { tickPuzzles } from "./puzzles";
import { clearCourse, course, createState, missingTokens, sessions, setCourse } from "./state";
import { tryOpenTower } from "./tower";
export function tellStory(player) {
    player.sendMessage("§d果冻精灵被锁在彩虹塔顶。");
    player.sendMessage("§7五条糖路各有一件信物：粉路迷宫、品红踩音符、蓝路镜子、红路三色钥匙、巧克力轨道。");
}
export function remind(player) {
    const state = sessions.get(player.id);
    if (!state) {
        return false;
    }
    const missing = missingTokens(state);
    player.sendMessage(missing.length === 0 ? "§e信物齐了，去彩虹塔门口救人。" : `§e还缺：§r${missing.join("、")}`);
    return true;
}
export function startGame(player) {
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
export function resumeGame(player) {
    if (!sessions.has(player.id)) {
        startGame(player);
        return;
    }
    if (course) {
        player.teleport(asVector(course.hub));
    }
    remind(player);
}
export function wipeWorld(player) {
    player.sendMessage("§e正在删除存档并生成新世界，请重新进服。");
    console.warn("LODESTONE_WIPE_WORLD");
    clearCourse();
    try {
        player.runCommand("kick @a 世界正在重新生成，请重新进服");
    }
    catch {
        // 服务端清档时会把人踢掉
    }
}
export function onJoin(player) {
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
        player.teleport(asVector(course.hub));
        player.sendMessage("§a港口和五条糖路已经出现。打开菜单开始。");
        tellStory(player);
    }, 25);
}
function tick() {
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
    }
    catch {
        // 区块未加载时跳过
    }
}, 8);
