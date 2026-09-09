import { Player, system } from "@minecraft/server";
import { ActionFormData, FormCancelationReason } from "@minecraft/server-ui";
import { bomberStatus, rematch, giveBombs } from "./bomber";
const open = new Set<string>();
export function requestMenu(p: Player): void {
  if (open.has(p.id)) return;
  open.add(p.id);
  const show = (attempt: number) => {
    if (!p.isValid) { open.delete(p.id); return; }
    new ActionFormData().title("炸弹人 · 双人竞技场").body(bomberStatus())
      .button("重新开始\n双方确认后自动开局").button("补领炸弹").button("关闭菜单")
      .show(p).then(response => {
        if (response.canceled && response.cancelationReason === FormCancelationReason.UserBusy && attempt < 4) {
          system.runTimeout(() => show(attempt + 1), 20); return;
        }
        open.delete(p.id);
        if (!response.canceled && response.selection === 0) rematch(p);
        else if (!response.canceled && response.selection === 1) giveBombs(p);
        else if (response.cancelationReason === FormCancelationReason.UserBusy) p.sendMessage("§e请关闭聊天或背包，再输入 /menu。");
      }).catch(e => { open.delete(p.id); console.warn(`BOMBER_MENU ${e}`); });
  };
  system.runTimeout(() => show(0), 8);
}
