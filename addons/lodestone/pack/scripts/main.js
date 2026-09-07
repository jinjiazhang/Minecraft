import { Player, system, world } from "@minecraft/server";
import { onJoin } from "./game";
import { openMenu } from "./menu";
const OPEN_CHAT = new Set(["!menu", "!lodestone", "!hunt", "菜单", "寻宝"]);
const COMPASS = "minecraft:compass";
function giveCompass(player) {
    const inventory = player.getComponent("minecraft:inventory");
    const box = inventory?.container;
    if (!box) {
        return;
    }
    for (let slot = 0; slot < box.size; slot++) {
        if (box.getItem(slot)?.typeId === COMPASS) {
            return;
        }
    }
    player.runCommand("give @s compass 1");
    player.sendMessage("§7指南针可以打开菜单。");
}
world.afterEvents.playerSpawn.subscribe((event) => {
    if (!event.initialSpawn) {
        return;
    }
    const player = event.player;
    system.run(() => giveCompass(player));
    system.runTimeout(() => {
        if (player.isValid) {
            onJoin(player);
            openMenu(player);
        }
    }, 50);
});
world.beforeEvents.itemUse.subscribe((event) => {
    if (event.itemStack.typeId !== COMPASS || !(event.source instanceof Player)) {
        return;
    }
    event.cancel = true;
    system.run(() => openMenu(event.source));
});
const chatSend = world.beforeEvents.chatSend;
chatSend?.subscribe((event) => {
    const text = event.message.trim().toLowerCase();
    if (!OPEN_CHAT.has(text) && !OPEN_CHAT.has(event.message.trim())) {
        return;
    }
    event.cancel = true;
    system.run(() => openMenu(event.sender));
});
