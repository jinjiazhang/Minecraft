import { Player } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { remind, startGame } from "./game";
import { sessions } from "./state";

export function openMenu(player: Player): void {
  const running = sessions.has(player.id);
  const form = new ActionFormData()
    .title("彩虹糖果港")
    .body("果冻精灵被锁在塔顶。走五条糖路找回信物，就能打开塔门。")
    .button(running ? "重新开始" : "开始救人")
    .button("还缺哪些信物");

  if (running) {
    form.button("先退出");
  }

  form.show(player).then((response) => {
    if (response.canceled || response.selection === undefined) {
      return;
    }
    if (response.selection === 0) {
      startGame(player);
      return;
    }
    if (response.selection === 1) {
      if (!remind(player)) {
        player.sendMessage("§7还没开始，先点「开始救人」。");
      }
      return;
    }
    sessions.delete(player.id);
    player.runCommand("gamemode survival @s");
    player.sendMessage("§e已退出。地图还在，随时可以再来。");
  }).catch(() => {
    player.sendMessage("§c菜单打不开，输入 !menu 再试。");
  });
}
