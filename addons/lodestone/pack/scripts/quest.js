// Pure cooperative state machine: no Minecraft dependency, so the full journey is testable.
export const TITLES = ["星灯村", "发明家的钻地工坊", "会说话的蘑菇森林", "沉睡的地下水城", "回声水晶洞", "地心花园", "两棵树的约定"];
export const OBJECTIVES = ["两个人分别触摸出发台，接下探险任务", "找齐三个零件，再由两人启动钻地车", "一人读图，一人按顺序寻找三种蘑菇", "两人分别开启左右水闸，让水城恢复动力", "一人读星图，另一人依次点亮水晶", "两人各触摸一座花坛，种下光之种", "回到星灯村，欣赏你们点亮的家"];
export const HINTS = [
    ["大树旁有两座带金色顶的出发台。", "分别触摸写着「出发 1」和「出发 2」的台子。", "一个人点左台，另一个人点右台；不需要同时点。"],
    ["寻找三个带灯的零件台：书架、工具架、钻地车附近。", "绿色是齿轮，蓝色是透镜，金色是电池；触摸台子即可收集。", "三个零件在左后、右后、车旁。找齐后，两人分别触摸车前的两个启动台。"],
    ["跟随发光小路，找到左侧的观察台。读图的小朋友要把线索告诉伙伴。", "一人触摸观察台，另一人根据消息触摸对应的蘑菇台。每步都要读新线索。", "顺序是：红色圆点蘑菇 → 蓝色小伞 → 黄色星星。观察者和操作者必须是不同的人。"],
    ["水渠的两侧各有一个蓝色水闸台。", "沿桥走到左右两边，各开一个闸；已经打开的闸会一直保持。", "一人点左闸，另一人点右闸。无需倒计时，也不需要游泳。"],
    ["洞穴左边是星图阅读台，右边是三颗水晶。", "一人触摸星图，把颜色和数字告诉伙伴；另一人触摸对应水晶。每步重新读图。", "顺序：紫色 3 → 蓝色 1 → 粉色 2。点错只重试当前一步，已亮的星星不会丢。"],
    ["花园中心有两座种植台，各自选一座。", "你们已经带来了光之种，空手触摸种植台就能种下。", "一人触摸左花坛，另一人触摸右花坛，树就会长出来。"],
    ["两棵发光树下有你们的小屋。", "触摸金色旅程台，可以回到已经完成的场景参观。", "探险完成了！还可以找找各场景的纪念故事牌。"],
];
export function freshQuest() { return { version: 2, stage: 0, parts: [], pairs: {}, step: 0, reader: "", roster: [] }; }
export function validQuest(v) {
    const q = v;
    return !!q && q.version === 2 && Number.isInteger(q.stage) && q.stage >= 0 && q.stage <= 6 && Array.isArray(q.parts) && q.parts.every(x => typeof x === "string") && Array.isArray(q.roster) && q.roster.length <= 2 && q.roster.every(x => typeof x === "string") && new Set(q.roster).size === q.roster.length && !!q.pairs && typeof q.pairs === "object" && Object.values(q.pairs).every(x => typeof x === "string") && Number.isInteger(q.step) && q.step >= 0 && q.step <= 2 && typeof q.reader === "string";
}
export function act(q, who, id) {
    if (!q.roster.includes(who))
        return { message: "这是两位探险员的机关。你可以陪同参观和帮忙读提示。" };
    const advance = () => { q.stage++; q.step = 0; q.reader = ""; q.pairs = {}; return { message: `完成！下一站：${TITLES[q.stage]}`, changed: true, advanced: true }; };
    const pair = (prefix) => {
        if (id !== `${prefix}0` && id !== `${prefix}1`)
            return { message: "先看看这一关的任务提示。" };
        if (q.pairs[id])
            return { message: "这一边已经完成啦，请让伙伴操作另一边。" };
        if (Object.values(q.pairs).includes(who))
            return { message: "你的一半已经完成，另一半留给伙伴！" };
        q.pairs[id] = who;
        return Object.keys(q.pairs).length === 2 ? advance() : { message: "你的一半完成了！等伙伴完成另一边，不用着急。", changed: true };
    };
    if (q.stage === 0)
        return pair("ready");
    if (q.stage === 1) {
        if (["gear", "lens", "battery"].includes(id)) {
            if (q.parts.includes(id))
                return { message: "这个零件已经装好了，找找另外两个。" };
            q.parts.push(id);
            return { message: `装好零件！${q.parts.length}/3。${q.parts.length === 3 ? "请两个人分别操作启动台。" : "沿小路找下一座零件台。"}`, changed: true };
        }
        if (q.parts.length < 3)
            return { message: "钻地车还缺零件，先找齐三个亮灯的零件台。" };
        return pair("engine");
    }
    if (q.stage === 2 || q.stage === 4) {
        const forest = q.stage === 2;
        const order = forest ? ["red", "blue", "yellow"] : ["violet", "cyan", "pink"];
        const words = forest ? ["红色圆点蘑菇", "蓝色小伞", "黄色星星"] : ["紫色 3", "蓝色 1", "粉色 2"];
        if (id === "read") {
            q.reader = who;
            return { message: `§e第 ${q.step + 1} 步：${words[q.step]}。§r请告诉伙伴，让伙伴去触摸它。`, changed: true };
        }
        if (!order.includes(id))
            return { message: "触摸阅读台或颜色台来解谜。" };
        if (!q.reader)
            return { message: "先请伙伴触摸阅读台，看看这一小步的线索。" };
        if (q.reader === who)
            return { message: "你看到了线索，把它告诉伙伴，让伙伴操作吧。" };
        if (id !== order[q.step])
            return { message: "差一点！已完成的部分还在，再问问伙伴颜色和图案。" };
        q.step++;
        q.reader = "";
        return q.step === 3 ? advance() : { message: `点亮了 ${q.step}/3！请再读一次线索，也可以交换分工。`, changed: true };
    }
    if (q.stage === 3)
        return pair("valve");
    if (q.stage === 5)
        return pair("plant");
    return { message: "你们已经让世界重新发光了！去树下看看你们的家。" };
}
