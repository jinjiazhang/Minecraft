import { Player, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { remind, resumeGame, wipeWorld } from "./game";
import { sessions } from "./state";

const lastOpen = new Map<string, number>();

function confirmWipe(player: Player): void {
  new ActionFormData()
    .title("重新开始")
    .body("会删除整个世界，再生成一张新地图。所有人都要重新进服。")
    .button("确定清档")
    .button("取消")
    .show(player)
    .then((response) => {
      if (response.canceled || response.selection !== 0) {
        return;
      }
      wipeWorld(player);
    })
    .catch(() => {
      player.sendMessage("§c清档确认打不开，聊天输入 menu。");
    });
}

export function requestMenu(player: Player): void {
  const now = Date.now();
  if ((lastOpen.get(player.id) ?? 0) + 800 > now) {
    return;
  }
  lastOpen.set(player.id, now);
  system.runTimeout(() => {
    if (player.isValid) {
      showMenu(player, 0);
    }
  }, 8);
}

function showMenu(player: Player, attempt: number): void {
  const running = sessions.has(player.id);
  const form = new ActionFormData()
    .title("彩虹糖果港")
    .body("果冻精灵被锁在塔顶。走五条糖路找回信物，就能打开塔门。\n聊天输入 menu 打开这个菜单。")
    .button("开始救人")
    .button("重新开始")
    .button("还缺哪些信物");

  if (running) {
    form.button("先退出");
  }

  form.show(player).then((response) => {
    if (response.canceled || response.selection === undefined) {
      return;
    }
    if (response.selection === 0) {
      resumeGame(player);
      return;
    }
    if (response.selection === 1) {
      confirmWipe(player);
      return;
    }
    if (response.selection === 2) {
      if (!remind(player)) {
        player.sendMessage("§7还没开始，先点「开始救人」。");
      }
      return;
    }
    sessions.delete(player.id);
    player.runCommand("gamemode survival @s");
    player.sendMessage("§e已退出。地图还在，随时可以再来。");
  }).catch(() => {
    if (attempt < 4) {
      system.runTimeout(() => showMenu(player, attempt + 1), 12);
      return;
    }
    player.sendMessage("§c菜单被挡住了，再输入一次 menu。");
  });
}

export function openMenu(player: Player): void {
  requestMenu(player);
}
