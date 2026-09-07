import { Player, system, world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
const MODES = [
    {
        id: "creative",
        title: "创造建造",
        summary: "无限方块，适合搭建筑。会把白天停住。",
        commands: [
            "gamemode creative @s",
            "gamerule keepInventory true",
            "gamerule doDaylightCycle false",
            "time set day",
        ],
    },
    {
        id: "survival",
        title: "普通生存",
        summary: "原版生存，死亡掉落，昼夜正常。",
        commands: [
            "gamemode survival @s",
            "difficulty normal",
            "gamerule keepInventory false",
            "gamerule doDaylightCycle true",
        ],
    },
    {
        id: "explore",
        title: "轻松探索",
        summary: "和平、死亡不掉落，适合到处看看。",
        commands: [
            "gamemode survival @s",
            "difficulty peaceful",
            "gamerule keepInventory true",
            "gamerule doDaylightCycle true",
        ],
    },
    {
        id: "hardcore",
        title: "高压生存",
        summary: "困难难度，死亡掉落。规则对全服生效。",
        commands: [
            "gamemode survival @s",
            "difficulty hard",
            "gamerule keepInventory false",
            "gamerule doDaylightCycle true",
        ],
    },
    {
        id: "adventure",
        title: "冒险",
        summary: "只能用工具互动，适合走地图。",
        commands: ["gamemode adventure @s"],
    },
];
const OPEN_ALIASES = new Set(["!menu", "!lodestone", "菜单", "玩法"]);
const COMPASS_ID = "minecraft:compass";
function playerHasCompass(player) {
    const inventory = player.getComponent("minecraft:inventory");
    if (!inventory) {
        return false;
    }
    const container = inventory.container;
    for (let slot = 0; slot < container.size; slot++) {
        if (container.getItem(slot)?.typeId === COMPASS_ID) {
            return true;
        }
    }
    return false;
}
function ensureCompass(player) {
    if (!playerHasCompass(player)) {
        player.runCommand("give @s compass 1");
        player.sendMessage("§7给你一块指南针，用手持使用也可打开菜单。");
    }
}
function applyMode(player, mode) {
    for (const command of mode.commands) {
        player.runCommand(command);
    }
    player.sendMessage(`§eLodestone§r · 已切换到 §a${mode.title}`);
    player.sendMessage(`§7${mode.summary}`);
}
function openMenu(player) {
    const form = new ActionFormData()
        .title("Lodestone")
        .body("选一种玩法。游戏模式只对你生效；难度和游戏规则会改整个房间。\n聊天输入 §e!menu§r 可再次打开。");
    for (const mode of MODES) {
        form.button(`${mode.title}\n§7${mode.summary}`);
    }
    form.show(player).then((response) => {
        if (response.canceled || response.selection === undefined) {
            return;
        }
        const mode = MODES[response.selection];
        if (mode) {
            applyMode(player, mode);
        }
    }).catch(() => {
        player.sendMessage("§c菜单打不开，过几秒再输入 !menu");
    });
}
function scheduleMenu(player, delayTicks) {
    system.runTimeout(() => {
        if (player.isValid) {
            openMenu(player);
        }
    }, delayTicks);
}
world.afterEvents.playerSpawn.subscribe((event) => {
    if (!event.initialSpawn) {
        return;
    }
    event.player.sendMessage("§eLodestone§r 已加载。聊天输入 §e!menu§r，或使用指南针选择玩法。");
    system.run(() => ensureCompass(event.player));
    scheduleMenu(event.player, 40);
});
world.beforeEvents.itemUse.subscribe((event) => {
    if (event.itemStack.typeId !== COMPASS_ID) {
        return;
    }
    const player = event.source;
    if (!(player instanceof Player)) {
        return;
    }
    event.cancel = true;
    system.run(() => openMenu(player));
});
const chatSend = world.beforeEvents.chatSend;
if (chatSend) {
    chatSend.subscribe((event) => {
        const text = event.message.trim().toLowerCase();
        if (!OPEN_ALIASES.has(text) && !OPEN_ALIASES.has(event.message.trim())) {
            return;
        }
        event.cancel = true;
        const player = event.sender;
        system.run(() => openMenu(player));
    });
}
