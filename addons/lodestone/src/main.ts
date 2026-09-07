import { Player, system, world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { handleHuntChat, openHuntMenu } from "./hunt";
import { applyMode, MODES } from "./modes";

const OPEN_ALIASES = new Set(["!menu", "!lodestone", "菜单", "玩法"]);
const COMPASS_ID = "minecraft:compass";

interface ChatSendLikeEvent {
  message: string;
  sender: Player;
  cancel: boolean;
}

function playerHasCompass(player: Player): boolean {
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

function ensureCompass(player: Player): void {
  if (!playerHasCompass(player)) {
    player.runCommand("give @s compass 1");
    player.sendMessage("§7给你一块指南针，用手持使用也可打开菜单。");
  }
}

function openMenu(player: Player): void {
  const form = new ActionFormData()
    .title("Lodestone")
    .body("选一种玩法，或开始解谜寻宝。\n聊天输入 §e!menu§r 可再次打开。");

  form.button("彩虹寻宝园\n§7算术题和找钥匙，适合小朋友");
  for (const mode of MODES) {
    form.button(`${mode.title}\n§7${mode.summary}`);
  }

  form.show(player).then((response) => {
    if (response.canceled || response.selection === undefined) {
      return;
    }
    if (response.selection === 0) {
      openHuntMenu(player);
      return;
    }
    const mode = MODES[response.selection - 1];
    if (mode) {
      applyMode(player, mode);
    }
  }).catch(() => {
    player.sendMessage("§c菜单打不开，过几秒再输入 !menu");
  });
}

function scheduleMenu(player: Player, delayTicks: number): void {
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
  event.player.sendMessage("§eLodestone§r 已加载。输入 §e!menu§r 选玩法，或 §e!hunt§r 看寻宝线索。");
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

const chatSend = (world.beforeEvents as { chatSend?: { subscribe(cb: (event: ChatSendLikeEvent) => void): void } }).chatSend;
if (chatSend) {
  chatSend.subscribe((event) => {
    const raw = event.message.trim();
    const text = raw.toLowerCase();
    if (handleHuntChat(event.sender, raw)) {
      event.cancel = true;
      return;
    }
    if (!OPEN_ALIASES.has(text) && !OPEN_ALIASES.has(raw)) {
      return;
    }
    event.cancel = true;
    const player = event.sender;
    system.run(() => openMenu(player));
  });
}
