import { near, openHole } from "./park";
import { course, grantToken, hasToken, plateIndex } from "./state";
const NOTE_ORDER = [0, 2, 1, 3];
const MIRROR_ORDER = [0, 1, 2];
function tickSequence(player, state, plates, order, stepKey, token, hint) {
    if (hasToken(state, token)) {
        return;
    }
    const index = plateIndex(player, plates);
    if (index < 0) {
        return;
    }
    if (index === order[state[stepKey]]) {
        state[stepKey] += 1;
        player.playSound("note.pling");
        if (state[stepKey] >= order.length) {
            state[stepKey] = 0;
            grantToken(player, state, token);
        }
        state.cooldown = 8;
        return;
    }
    state[stepKey] = 0;
    state.cooldown = 12;
    player.playSound("note.bass");
    player.sendMessage(hint);
}
function tickKeys(player, state) {
    if (!course || hasToken(state, "keys")) {
        return;
    }
    const pick = [
        { ready: state.hasRed, spot: course.keyRed, item: "red_dye", flag: "hasRed", text: "§c拿到红钥匙，去开红门。" },
        { ready: state.hasBlue, spot: course.keyBlue, item: "blue_dye", flag: "hasBlue", text: "§9拿到蓝钥匙，去开蓝门。" },
        { ready: state.hasYellow, spot: course.keyYellow, item: "yellow_dye", flag: "hasYellow", text: "§e拿到黄钥匙，去开黄门。" },
    ];
    for (const item of pick) {
        if (!item.ready && near(player, item.spot, 1.6)) {
            state[item.flag] = true;
            player.runCommand(`give @s ${item.item} 1`);
            player.sendMessage(item.text);
            state.cooldown = 10;
            return;
        }
    }
    const doors = [
        { opened: state.openedRed, has: state.hasRed, spot: course.doorRed, item: "red_dye", flag: "openedRed", wait: "§c先拿红钥匙。", done: "§a红门开了。" },
        { opened: state.openedBlue, has: state.hasBlue, spot: course.doorBlue, item: "blue_dye", flag: "openedBlue", wait: "§9先拿蓝钥匙。", done: "§a蓝门开了。" },
        { opened: state.openedYellow, has: state.hasYellow, spot: course.doorYellow, item: "yellow_dye", flag: "openedYellow", wait: "§e先拿黄钥匙。", done: "§a黄门开了。" },
    ];
    for (const door of doors) {
        if (door.opened || !near(player, door.spot, 1.8)) {
            continue;
        }
        if (!door.has) {
            player.sendMessage(door.wait);
            state.cooldown = 12;
            return;
        }
        state[door.flag] = true;
        player.runCommand(`clear @s ${door.item} 0 1`);
        openHole(player, door.spot.x, door.spot.y, door.spot.z);
        player.sendMessage(door.done);
        state.cooldown = 8;
        break;
    }
    if (state.openedRed && state.openedBlue && state.openedYellow) {
        grantToken(player, state, "keys");
    }
}
export function tickPuzzles(player, state) {
    if (!course) {
        return;
    }
    if (near(player, course.notes, 8)) {
        tickSequence(player, state, course.notesPlates, NOTE_ORDER, "noteStep", "notes", "§c顺序错了。按墙上的 §e红→蓝→黄→绿§c 踩。");
    }
    if (near(player, course.mirror, 8)) {
        tickSequence(player, state, course.mirrorPlates, MIRROR_ORDER, "mirrorStep", "mirror", "§c和墙上不一样。先红，再黄，再蓝。");
    }
    if (near(player, course.keys, 8)) {
        tickKeys(player, state);
    }
    if (!hasToken(state, "maze") && near(player, course.mazeEnd, 2)) {
        grantToken(player, state, "maze");
    }
    if (!hasToken(state, "cart") && near(player, course.cartEnd, 2)) {
        grantToken(player, state, "cart");
    }
}
