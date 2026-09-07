import { ActionFormData } from "@minecraft/server-ui";
import { remind, resumeGame, wipeWorld } from "./game";
import { sessions } from "./state";
function confirmWipe(player) {
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
        player.sendMessage("§c清档确认打不开，点快捷栏「菜单」再试。");
    });
}
export function openMenu(player) {
    const running = sessions.has(player.id);
    const form = new ActionFormData()
        .title("彩虹糖果港")
        .body("果冻精灵被锁在塔顶。走五条糖路找回信物，就能打开塔门。")
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
        player.sendMessage("§c菜单打不开，点快捷栏「菜单」再试。");
    });
}
