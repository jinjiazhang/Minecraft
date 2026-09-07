import { ItemLockMode, ItemStack, Player, system, world } from "@minecraft/server";
import { onJoin } from "./game";
import { openMenu } from "./menu";
const OPEN_CHAT = new Set(["!menu", "!lodestone", "!hunt", "菜单", "寻宝"]);
const MENU_ITEM = "minecraft:compass";
const MENU_NAME = "菜单";
const MENU_SLOT = 8;
function giveMenuItem(player) {
    const inventory = player.getComponent("minecraft:inventory");
    const box = inventory?.container;
    if (!box) {
        return;
    }
    const item = new ItemStack(MENU_ITEM, 1);
    item.nameTag = MENU_NAME;
    item.keepOnDeath = true;
    item.lockMode = ItemLockMode.slot;
    box.setItem(MENU_SLOT, item);
    player.selectedSlotIndex = MENU_SLOT;
    player.sendMessage("§7点快捷栏最右边的「菜单」就能打开。");
}
world.afterEvents.playerSpawn.subscribe((event) => {
    if (!event.initialSpawn) {
        return;
    }
    const player = event.player;
    system.run(() => giveMenuItem(player));
    system.runTimeout(() => {
        if (player.isValid) {
            onJoin(player);
            openMenu(player);
        }
    }, 50);
});
world.beforeEvents.itemUse.subscribe((event) => {
    if (!(event.source instanceof Player)) {
        return;
    }
    const item = event.itemStack;
    if (item.typeId !== MENU_ITEM && item.nameTag !== MENU_NAME) {
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
