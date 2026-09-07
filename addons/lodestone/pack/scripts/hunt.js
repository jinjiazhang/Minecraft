import { system, world } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
const GOLD_KEY = "minecraft:gold_ingot";
const progress = new Map();
let course;
const CLUES = {
    0: "沿着黄色小路往前走，进橙色小房子，数一数地上的方块。",
    1: "答对啦！继续沿黄路走到红色小屋，把金钥匙拿走。",
    2: "你有金钥匙了。走到前面的铁门那里，门会开。",
    3: "门开了。再往前走进蓝色小房子，再做一道加法。",
    4: "答对啦！走到最后的金色房子，领取宝藏。",
    5: "你已经找到宝藏啦。想再玩，打开菜单重新开始。",
};
function site(x, y, z) {
    return { x, y, z };
}
function asVector(target) {
    return { x: target.x + 0.5, y: target.y, z: target.z + 0.5 };
}
function near(player, target, range) {
    const dx = player.location.x - (target.x + 0.5);
    const dz = player.location.z - (target.z + 0.5);
    return Math.hypot(dx, dz) <= range;
}
function blockName(block) {
    return block.replace("minecraft:", "");
}
function fill(player, x1, y1, z1, x2, y2, z2, block) {
    player.runCommand(`fill ${x1} ${y1} ${z1} ${x2} ${y2} ${z2} ${blockName(block)}`);
}
function put(player, x, y, z, block) {
    player.runCommand(`setblock ${x} ${y} ${z} ${blockName(block)}`);
}
function buildRoom(player, cx, y, cz, halfX, halfZ, wall, floor) {
    const x1 = cx - halfX;
    const x2 = cx + halfX;
    const z1 = cz - halfZ;
    const z2 = cz + halfZ;
    fill(player, x1, y - 1, z1, x2, y - 1, z2, floor);
    fill(player, x1, y, z1, x2, y + 2, z2, "minecraft:air");
    fill(player, x1, y, z1, x2, y + 2, z1, wall);
    fill(player, x1, y, z2, x2, y + 2, z2, wall);
    fill(player, x1, y, z1, x1, y + 2, z2, wall);
    fill(player, x2, y, z1, x2, y + 2, z2, wall);
    fill(player, cx, y, z1, cx, y + 2, z1, "minecraft:air");
    fill(player, cx, y, z2, cx, y + 2, z2, "minecraft:air");
}
function buildGate(player, x, y, z, block) {
    fill(player, x - 2, y, z, x + 2, y + 2, z, block);
    put(player, x, y, z, "minecraft:air");
}
function openGate(player, x, y, z) {
    fill(player, x - 1, y, z, x + 1, y + 2, z, "minecraft:air");
}
function playerHasItem(player, typeId) {
    const inventory = player.getComponent("minecraft:inventory");
    if (!inventory) {
        return false;
    }
    const container = inventory.container;
    for (let slot = 0; slot < container.size; slot++) {
        if (container.getItem(slot)?.typeId === typeId) {
            return true;
        }
    }
    return false;
}
function takeItem(player, typeId) {
    if (!playerHasItem(player, typeId)) {
        return false;
    }
    const shortName = typeId.replace("minecraft:", "");
    player.runCommand(`clear @s ${shortName} 0 1`);
    return true;
}
function normalizeAnswer(value) {
    return String(value ?? "").trim().replace(/\s+/g, "");
}
function isAnswer(value, accepted) {
    const answer = normalizeAnswer(value).toLowerCase();
    return accepted.includes(answer);
}
function buildPark(player) {
    const originX = course ? course.start.x - 13 : Math.floor(player.location.x) - 13;
    const originZ = course ? course.start.z : Math.floor(player.location.z);
    const y = course ? course.start.y : Math.max(8, Math.floor(player.location.y));
    const x1 = originX;
    const z1 = originZ;
    const x2 = originX + 26;
    const z2 = originZ + 33;
    fill(player, x1, y - 1, z1, x2, y - 1, z2, "minecraft:lime_concrete");
    fill(player, x1, y, z1, x2, y + 5, z2, "minecraft:air");
    fill(player, x1, y, z1, x2, y + 1, z1, "minecraft:yellow_concrete");
    fill(player, x1, y, z2, x2, y + 1, z2, "minecraft:yellow_concrete");
    fill(player, x1, y, z1, x1, y + 1, z2, "minecraft:yellow_concrete");
    fill(player, x2, y, z1, x2, y + 1, z2, "minecraft:yellow_concrete");
    fill(player, originX + 12, y - 1, originZ + 2, originX + 14, y - 1, originZ + 31, "minecraft:yellow_concrete");
    const start = site(originX + 13, y, originZ + 2);
    const quiz1 = site(originX + 13, y, originZ + 8);
    const key = site(originX + 13, y, originZ + 16);
    const door = site(originX + 13, y, originZ + 20);
    const quiz2 = site(originX + 13, y, originZ + 25);
    const treasure = site(originX + 13, y, originZ + 30);
    fill(player, start.x - 2, y - 1, start.z - 1, start.x + 2, y - 1, start.z + 1, "minecraft:white_concrete");
    put(player, start.x + 2, y, start.z, "minecraft:oak_fence");
    put(player, start.x + 2, y + 1, start.z, "minecraft:lantern");
    buildRoom(player, quiz1.x, y, quiz1.z, 3, 2, "minecraft:orange_concrete", "minecraft:orange_concrete");
    put(player, quiz1.x - 2, y, quiz1.z, "minecraft:red_wool");
    put(player, quiz1.x - 2, y, quiz1.z - 1, "minecraft:red_wool");
    put(player, quiz1.x + 2, y, quiz1.z, "minecraft:blue_wool");
    put(player, quiz1.x + 2, y, quiz1.z - 1, "minecraft:blue_wool");
    put(player, quiz1.x + 2, y, quiz1.z + 1, "minecraft:blue_wool");
    buildGate(player, quiz1.x, y, quiz1.z + 3, "minecraft:oak_fence");
    buildRoom(player, key.x, y, key.z, 3, 2, "minecraft:red_concrete", "minecraft:red_concrete");
    put(player, key.x, y, key.z, "minecraft:gold_block");
    put(player, key.x, y + 1, key.z, "minecraft:lantern");
    buildGate(player, door.x, y, door.z, "minecraft:iron_bars");
    buildRoom(player, quiz2.x, y, quiz2.z, 3, 2, "minecraft:light_blue_concrete", "minecraft:light_blue_concrete");
    put(player, quiz2.x - 2, y, quiz2.z - 1, "minecraft:yellow_wool");
    put(player, quiz2.x - 2, y, quiz2.z, "minecraft:yellow_wool");
    put(player, quiz2.x - 1, y, quiz2.z - 1, "minecraft:yellow_wool");
    put(player, quiz2.x - 1, y, quiz2.z, "minecraft:yellow_wool");
    put(player, quiz2.x + 2, y, quiz2.z, "minecraft:lime_wool");
    put(player, quiz2.x + 2, y, quiz2.z - 1, "minecraft:lime_wool");
    buildGate(player, quiz2.x, y, quiz2.z + 3, "minecraft:oak_fence");
    buildRoom(player, treasure.x, y, treasure.z, 3, 2, "minecraft:gold_block", "minecraft:yellow_concrete");
    put(player, treasure.x, y, treasure.z, "minecraft:lodestone");
    put(player, treasure.x, y + 1, treasure.z, "minecraft:cake");
    world.setDefaultSpawnLocation({ x: start.x, y: start.y, z: start.z });
    return { start, quiz1, key, door, quiz2, treasure };
}
function getState(player) {
    const current = progress.get(player.id);
    if (current) {
        return current;
    }
    const created = { stage: 0, busy: false, cooldown: 0 };
    progress.set(player.id, created);
    return created;
}
function sendClue(player, stage) {
    player.sendMessage(`§e彩虹寻宝园§r · ${CLUES[stage]}`);
    player.sendMessage("§7忘了就输入 §e!hunt§r。");
}
function askMath(player, state, title, question, accepted, onCorrect) {
    state.busy = true;
    const form = new ModalFormData().title(title).textField(question, "写出数字");
    form.show(player).then((response) => {
        state.busy = false;
        if (response.canceled) {
            state.cooldown = 30;
            player.sendMessage("§7站在小屋里，再数一遍地上的方块。");
            return;
        }
        if (isAnswer(response.formValues?.[0], accepted)) {
            player.playSound("random.levelup");
            onCorrect();
            return;
        }
        state.cooldown = 20;
        player.playSound("note.bass");
        player.sendMessage("§c再数一数地上的方块哦！");
    }).catch(() => {
        state.busy = false;
        state.cooldown = 20;
        player.sendMessage("§c题目打不开，在小屋里再站一下。");
    });
}
function finishHunt(player, state) {
    state.stage = 5;
    player.runCommand("gamemode survival @s");
    player.runCommand("give @s cookie 8");
    player.runCommand("give @s apple 4");
    player.runCommand("give @s cake 1");
    player.runCommand("give @s diamond 3");
    player.runCommand("title @s title §6太棒了");
    player.playSound("random.toast");
    player.sendMessage("§6宝藏是你的啦！§r饼干、苹果和钻石已经放进背包。");
    sendClue(player, 5);
}
function tickHunt() {
    if (!course) {
        return;
    }
    for (const player of world.getAllPlayers()) {
        const state = progress.get(player.id);
        if (!state || state.busy || state.stage === 5) {
            continue;
        }
        if (state.cooldown > 0) {
            state.cooldown -= 1;
            continue;
        }
        if (state.stage === 0 && near(player, course.quiz1, 2.4)) {
            askMath(player, state, "橙色小屋", "红色方块有 2 个，蓝色方块有 3 个，一共几个？", ["5", "五"], () => {
                state.stage = 1;
                openGate(player, course.quiz1.x, course.quiz1.y, course.quiz1.z + 3);
                player.sendMessage("§a答对啦！栅栏打开了。");
                sendClue(player, 1);
            });
            continue;
        }
        if (state.stage === 1 && near(player, course.key, 2.2)) {
            if (!playerHasItem(player, GOLD_KEY)) {
                player.runCommand("give @s gold_ingot 1");
            }
            state.stage = 2;
            player.playSound("random.orb");
            player.sendMessage("§6你找到了金钥匙！§r拿到前面的铁门去开门。");
            sendClue(player, 2);
            continue;
        }
        if (state.stage === 2 && near(player, course.door, 2.4)) {
            if (!takeItem(player, GOLD_KEY)) {
                state.cooldown = 25;
                player.playSound("note.bass");
                player.sendMessage("§c门锁着。先去红色小屋拿金钥匙。");
                sendClue(player, 1);
                continue;
            }
            state.stage = 3;
            openGate(player, course.door.x, course.door.y, course.door.z);
            player.playSound("random.anvil_land");
            player.sendMessage("§a钥匙对上了，铁门开啦！");
            sendClue(player, 3);
            continue;
        }
        if (state.stage === 3 && near(player, course.quiz2, 2.4)) {
            askMath(player, state, "蓝色小屋", "黄色方块有 4 个，绿色方块有 2 个，一共几个？", ["6", "六"], () => {
                state.stage = 4;
                openGate(player, course.quiz2.x, course.quiz2.y, course.quiz2.z + 3);
                player.sendMessage("§a又答对啦！金色房子就在前面。");
                sendClue(player, 4);
            });
            continue;
        }
        if (state.stage === 4 && near(player, course.treasure, 2.2)) {
            finishHunt(player, state);
        }
    }
}
function startHunt(player) {
    course = buildPark(player);
    const state = getState(player);
    state.stage = 0;
    state.busy = false;
    state.cooldown = 15;
    player.runCommand("gamemode adventure @s");
    player.runCommand("clear @s gold_ingot");
    player.teleport(asVector(course.start));
    player.sendMessage("§e彩虹寻宝园§r 地图已经铺在你脚下。");
    player.sendMessage("§7沿着黄色小路走。数方块、找钥匙，就能拿到宝藏。");
    sendClue(player, 0);
}
function ensureParkOnJoin(player) {
    if (course) {
        player.teleport(asVector(course.start));
        player.sendMessage("§e彩虹寻宝园§r 在这里。打开菜单点「开始寻宝」就可以玩。");
        return;
    }
    player.sendMessage("§e正在铺彩虹寻宝园，请站好…");
    system.runTimeout(() => {
        if (!player.isValid) {
            return;
        }
        course = buildPark(player);
        player.teleport(asVector(course.start));
        player.sendMessage("§a彩色地图已经出现在你脚下。§r打开菜单点第一项「彩虹寻宝园」开始。");
    }, 20);
}
export function remindHunt(player) {
    const state = progress.get(player.id);
    if (!state) {
        return false;
    }
    sendClue(player, state.stage);
    return true;
}
export function openHuntMenu(player) {
    const state = progress.get(player.id);
    const running = !!state && state.stage < 5;
    const form = new ActionFormData()
        .title("彩虹寻宝园")
        .body("给小朋友的寻宝。沿着黄路走，算对题、找到钥匙，就能拿到宝藏。")
        .button(running ? "重新开始" : "开始寻宝")
        .button("查看当前线索");
    if (running) {
        form.button("放弃寻宝");
    }
    form.show(player).then((response) => {
        if (response.canceled || response.selection === undefined) {
            return;
        }
        if (response.selection === 0) {
            startHunt(player);
            return;
        }
        if (response.selection === 1) {
            if (!remindHunt(player)) {
                player.sendMessage("§7还没开始。先点「开始寻宝」。");
            }
            return;
        }
        if (response.selection === 2 && state) {
            progress.delete(player.id);
            player.runCommand("gamemode survival @s");
            player.sendMessage("§e已退出寻宝。");
        }
    }).catch(() => {
        player.sendMessage("§c菜单打不开，输入 !menu 再试。");
    });
}
export function handleHuntChat(player, message) {
    const text = message.trim().toLowerCase();
    if (text !== "!hunt" && message.trim() !== "寻宝") {
        return false;
    }
    system.run(() => {
        if (!remindHunt(player)) {
            openHuntMenu(player);
        }
    });
    return true;
}
world.afterEvents.playerSpawn.subscribe((event) => {
    if (!event.initialSpawn) {
        return;
    }
    system.runTimeout(() => {
        if (event.player.isValid) {
            ensureParkOnJoin(event.player);
        }
    }, 50);
});
system.runInterval(() => {
    try {
        tickHunt();
    }
    catch {
        // 区块未加载时跳过这一拍
    }
}, 15);
