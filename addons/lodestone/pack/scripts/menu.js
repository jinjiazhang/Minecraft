import { system } from "@minecraft/server";
import { ActionFormData, FormCancelationReason } from "@minecraft/server-ui";
import { checkpoint, hint, initialize, quest, ready, returnToCamp, status } from "./game";
import { TITLES } from "./quest";
const open = new Set();
export function requestMenu(p) {
    if (open.has(p.id))
        return;
    open.add(p.id);
    const show = (attempt) => {
        if (!p.isValid) {
            open.delete(p.id);
            return;
        }
        const actions = [];
        const form = new ActionFormData().title("地心探险队 · 探险手册").body(`${status()}\n\n空手触摸彩色台子或路牌。线索可轮流读，机关不需要同时操作。`);
        const add = (label, action) => { form.button(label); actions.push(action); };
        if (!ready)
            add("重试准备 / 等待建造完成", () => { try {
                initialize();
            }
            catch (e) {
                p.sendMessage(`准备失败：${e}`);
            } });
        else {
            add("继续探险 / 我迷路了\n返回当前集合点", () => returnToCamp(p));
            add("给我一点提示", () => hint(p));
            add("告诉我具体怎么做", () => hint(p, true));
            for (let r = 0; r <= Math.min(quest.stage, 5); r++)
                if (r !== checkpoint())
                    add(`参观 · ${TITLES[r]}`, () => returnToCamp(p, r));
        }
        add("合上手册", () => { });
        form.show(p).then(response => {
            if (response.canceled && response.cancelationReason === FormCancelationReason.UserBusy && attempt < 4) {
                system.runTimeout(() => show(attempt + 1), 20);
                return;
            }
            open.delete(p.id);
            if (!response.canceled && response.selection !== undefined)
                actions[response.selection]?.();
            else if (response.cancelationReason === FormCancelationReason.UserBusy)
                p.sendMessage("§e请先关闭聊天或背包，再触摸金色台子打开手册。");
        }).catch(e => { open.delete(p.id); console.warn(`EARTH_MENU ${e}`); if (p.isValid)
            p.sendMessage("§e手册暂时打不开，请关闭其他窗口后重试 /menu。"); });
    };
    system.runTimeout(() => show(0), 8);
}
