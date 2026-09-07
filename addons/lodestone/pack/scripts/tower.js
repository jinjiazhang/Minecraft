import { asVector, near, openHole } from "./park";
import { ALL_TOKENS, course, sessions, TOKEN_ITEM } from "./state";
export function tryOpenTower(player, state) {
    if (!course || !near(player, course.towerDoor, 2.4)) {
        return;
    }
    if (state.tokens.length < ALL_TOKENS.length) {
        player.sendMessage(`§c塔门锁着，还差 ${ALL_TOKENS.length - state.tokens.length} 件信物。`);
        state.cooldown = 16;
        return;
    }
    for (const id of ALL_TOKENS) {
        player.runCommand(`clear @s ${TOKEN_ITEM[id]} 0 1`);
    }
    openHole(player, course.towerDoor.x, course.towerDoor.y, course.towerDoor.z);
    player.teleport(asVector(course.towerTop));
    player.runCommand("gamemode survival @s");
    player.runCommand("give @s cookie 12");
    player.runCommand("give @s cake 1");
    player.runCommand("give @s apple 6");
    player.runCommand("give @s diamond 5");
    player.runCommand("title @s title §d谢谢你");
    player.playSound("random.toast");
    player.sendMessage("§d果冻精灵：§r谢谢你们来救我！点心分给大家吃吧。");
    sessions.delete(player.id);
}
