import { system, world } from "@minecraft/server";
import { act, freshQuest, HINTS, OBJECTIVES, TITLES, validQuest } from "./quest";
import { at, BASE, buildPlan, execute, MAP_VERSION, roomOf, spawn, visualPlan } from "./scenes";
const SAVE = "lodestone:earth_quest_v2";
const MAP = "lodestone:earth_map_v2";
const WAIT = { x: 8.5, y: 80, z: 8.5 };
export let quest = freshQuest();
export let building = false;
export let ready = false;
let booted = false;
let lastProgress = 0;
let lastVisual = "";
const hints = new Map();
const cooldown = new Map();
const visits = new Map();
export function dim() { return world.getDimension("overworld"); }
function save() { world.setDynamicProperty(SAVE, JSON.stringify(quest)); }
function participants() { return world.getAllPlayers().filter(p => quest.roster.includes(p.name)); }
function say(message) { for (const p of world.getAllPlayers())
    p.sendMessage(`§b[地心探险队]§r ${message}`); }
function load() {
    if (booted)
        return;
    const raw = world.getDynamicProperty(SAVE);
    if (typeof raw === "string") {
        const data = JSON.parse(raw);
        if (!validQuest(data))
            throw new Error("冒险进度格式异常，已保留原始存档，请检查服务端日志。");
        quest = data;
    }
    booted = true;
}
function configure() {
    for (const command of ["difficulty peaceful", "gamerule pvp false", "gamerule keepinventory true", "gamerule doMobSpawning false", "gamerule doFireTick false", "gamerule mobGriefing false", "gamerule doDaylightCycle false", "gamerule doWeatherCycle false", "time set day", "weather clear"])
        dim().runCommand(command);
}
export function protect(p) {
    if (!p.isValid)
        return;
    p.addEffect("resistance", 200, { amplifier: 4, showParticles: false });
    p.addEffect("slow_falling", 200, { amplifier: 0, showParticles: false });
    p.addEffect("saturation", 200, { amplifier: 0, showParticles: false });
}
function atWait(p) {
    return p.dimension.id === "minecraft:overworld" && Math.abs(p.location.x - WAIT.x) < 4 && Math.abs(p.location.z - WAIT.z) < 4 && p.location.y >= 79 && p.location.y < 88;
}
export function seat(p) {
    protect(p);
    const d = dim();
    try {
        d.runCommand("fill 4 78 4 12 78 12 minecraft:polished_deepslate");
        d.runCommand("fill 4 79 4 12 85 12 minecraft:air");
        d.runCommand("fill 4 79 4 12 85 12 minecraft:glass hollow");
        world.setDefaultSpawnLocation({ x: 8, y: 80, z: 8 });
    }
    catch (e) {
        console.warn(`EARTH_WAIT ${e}`);
    }
    p.teleport(WAIT, { dimension: d });
    p.setSpawnPoint({ x: 8, y: 80, z: 8, dimension: d });
    p.runCommand("gamemode adventure @s");
}
// Small, bounded batches. Failed commands retry and never mark a partial map complete.
function runJobs(jobs, done, failed) {
    let index = 0, retries = 0;
    const step = () => {
        try {
            for (let n = 0; n < 4 && index < jobs.length; n++, index++) {
                execute(dim(), jobs[index]);
                retries = 0;
            }
            if (building && system.currentTick % 40 < 4)
                for (const p of world.getAllPlayers())
                    p.onScreenDisplay.setActionBar(`正在布置地心世界 · ${Math.floor(index / jobs.length * 100)}% · 请稍候`);
            if (index === jobs.length) {
                done();
                return;
            }
            system.runTimeout(step, 1);
        }
        catch (e) {
            if (++retries <= 8)
                system.runTimeout(step, 20);
            else {
                console.error(`EARTH_BUILD job ${index}: ${JSON.stringify(jobs[index])}: ${e}`);
                failed(e);
            }
        }
    };
    step();
}
export function checkpoint() { return quest.stage >= 6 ? 0 : quest.stage; }
export function returnToCamp(p, room = checkpoint()) {
    if (!ready || building) {
        p.sendMessage("§e场景正在准备，请稍等。完成后会自动带你进入。");
        return;
    }
    if (room < 0 || room > 5 || room > quest.stage)
        return;
    protect(p);
    p.teleport(spawn(room), { dimension: dim(), facingLocation: at(room, 0, 2, -6) });
    p.setSpawnPoint({ ...spawn(checkpoint()), dimension: dim() });
    p.runCommand("gamemode adventure @s");
    p.onScreenDisplay.setTitle(`§e${TITLES[room]}`, { subtitle: room === checkpoint() ? OBJECTIVES[quest.stage] : "自由参观 · 金色旅程台返回当前任务", fadeInDuration: 10, stayDuration: 65, fadeOutDuration: 20 });
    visits.set(p.id, room);
}
export function refreshVisuals() {
    const signature = JSON.stringify([quest.stage, quest.parts, quest.step, quest.pairs]);
    if (lastVisual === signature)
        return;
    // Mark only after successful writes; retry on a later tick if any block is unavailable.
    for (const job of visualPlan(quest))
        execute(dim(), job);
    lastVisual = signature;
}
export function join(p) {
    try {
        load();
        if (!quest.roster.includes(p.name) && quest.roster.length < 2) {
            quest.roster.push(p.name);
            save();
        }
        p.sendMessage(`§6欢迎来到地心探险队！§r${quest.roster.includes(p.name) ? "你是本次探险员。" : "你是陪同者，可以帮助读提示。"}\n§e触摸绿色台子看提示，金色台子打开手册。也可输入 /menu。`);
        if (!ready) {
            seat(p);
            initialize();
            return;
        }
        returnToCamp(p);
        p.sendMessage(`§e当前任务：${OBJECTIVES[quest.stage]}`);
    }
    catch (e) {
        console.error(`EARTH_JOIN ${e}`);
        p.sendMessage(`§c准备失败：${String(e)}。可从手册重试。`);
    }
}
export function initialize() {
    if (building)
        return;
    load();
    building = true;
    try {
        configure();
        // 9 x 6 chunks = 54, below the command's 100-chunk limit.
        try {
            dim().runCommand("tickingarea remove earth_adventure");
        }
        catch { /* first installation */ }
        dim().runCommand(`tickingarea add ${BASE.x} 80 ${BASE.z} ${BASE.x + 143} 80 ${BASE.z + 95} earth_adventure true`);
    }
    catch (e) {
        building = false;
        throw e;
    }
    const fail = (e) => { building = false; ready = false; say("场景准备中断，原进度已保存。输入 /menu，点「重试准备」。"); console.error(`EARTH_INIT ${e}`); };
    const finish = () => {
        try {
            refreshVisuals();
            world.setDynamicProperty(MAP, MAP_VERSION);
            world.setDefaultSpawnLocation(spawn(0));
            building = false;
            ready = true;
            lastProgress = system.currentTick;
            for (const p of world.getAllPlayers())
                returnToCamp(p);
            say(`§a世界准备好了！§r${OBJECTIVES[quest.stage]}。空手触摸路牌或彩色台子即可互动。`);
        }
        catch (e) {
            fail(e);
        }
    };
    // Allow the ticking area to load before placing any blocks. Retries cover slower disks.
    system.runTimeout(() => {
        try {
            if (world.getDynamicProperty(MAP) === MAP_VERSION) {
                runJobs(visualPlan(quest), finish, fail);
                return;
            }
            say("正在建造六座地心场景，首次准备约需一到两分钟。可以先在原地等候。");
            runJobs(buildPlan(), finish, fail);
        }
        catch (e) {
            fail(e);
        }
    }, 80);
}
export function hint(p, direct = false) {
    const key = `${p.id}:${quest.stage}`;
    const level = direct ? 2 : Math.min(hints.get(key) ?? 0, 2);
    hints.set(key, Math.min(level + 1, 2));
    p.sendMessage(`§a提示 ${level + 1}/3：§r${HINTS[quest.stage][level]}`);
    p.sendMessage("§7再触摸绿色提示台，会得到更具体的帮助。迷路可用手册返回集合点。");
}
export function interact(p, s) {
    if (!ready || building || !p.isValid || p.dimension.id !== "minecraft:overworld")
        return;
    if ((cooldown.get(p.id) ?? 0) > system.currentTick)
        return;
    cooldown.set(p.id, system.currentTick + 8);
    if (s.id === "help") {
        hint(p);
        return;
    }
    if (s.id === "story") {
        p.sendMessage(s.text);
        return;
    }
    if (s.room !== quest.stage) {
        p.sendMessage("§e这一站可以自由参观。打开金色旅程台返回当前任务。");
        return;
    }
    const before = quest.stage;
    const result = act(quest, p.name, s.id);
    p.sendMessage(result.message);
    if (result.changed) {
        save();
        lastProgress = system.currentTick;
        try {
            refreshVisuals();
        }
        catch (e) {
            console.warn(`EARTH_VISUAL ${e}`);
        }
        p.playSound("random.orb");
    }
    if (result.advanced) {
        say(`§6${TITLES[before]}完成！§r${OBJECTIVES[quest.stage]}`);
        for (const friend of participants()) {
            friend.playSound("random.levelup");
            friend.onScreenDisplay.setTitle("§6合作成功！", { subtitle: `下一站：${TITLES[quest.stage]}`, stayDuration: 60, fadeInDuration: 10, fadeOutDuration: 20 });
        }
        const expected = quest.stage;
        system.runTimeout(() => {
            if (quest.stage !== expected)
                return;
            for (const friend of world.getAllPlayers())
                returnToCamp(friend);
            if (quest.stage === 6)
                say("§e两颗种子长成了发光树！左右两间小屋是你们的探险基地。金色台子可以重游六个场景。");
        }, expected === 6 ? 180 : 80);
    }
}
export function status() {
    const connected = participants().length;
    const detail = quest.stage === 1 ? `零件 ${quest.parts.length}/3` : quest.stage === 2 || quest.stage === 4 ? `已点亮 ${quest.step}/3` : quest.stage < 6 ? `合作 ${Object.keys(quest.pairs).length}/2` : "宝藏已找到";
    return `${TITLES[quest.stage]} · ${detail}\n${OBJECTIVES[quest.stage]}\n探险员：${quest.roster.join("、") || "等待加入"}（在线 ${connected}/2）`;
}
// Deliberately no in-game world deletion/reset: children cannot erase each other's adventure.
export function tick() {
    if (!ready || building) {
        for (const p of world.getAllPlayers()) {
            try {
                protect(p);
                if (!atWait(p))
                    seat(p);
                p.onScreenDisplay.setActionBar("正在布置地心世界 · 请在玻璃小屋里等候");
            }
            catch (e) {
                console.warn(`EARTH_WAIT ${p.name}: ${e}`);
            }
        }
        return;
    }
    try {
        refreshVisuals();
    }
    catch (e) {
        if (system.currentTick % 200 === 0)
            console.warn(`EARTH_VISUAL_RETRY ${e}`);
    }
    for (const p of world.getAllPlayers()) {
        try {
            const room = p.dimension.id === "minecraft:overworld" ? roomOf(p.location) : -1;
            if (room < 0 || room > quest.stage) {
                returnToCamp(p);
                continue;
            }
            p.addEffect("resistance", 80, { amplifier: 4, showParticles: false });
            p.addEffect("saturation", 80, { amplifier: 0, showParticles: false });
            p.addEffect("water_breathing", 80, { showParticles: false });
            const waiting = participants().length < 2 && quest.stage < 6 ? " · 等待伙伴上线" : "";
            p.onScreenDisplay.setActionBar(`§e${TITLES[quest.stage]}§r · ${OBJECTIVES[quest.stage]}${waiting} §a| 绿台提示`);
            if (visits.get(p.id) !== room) {
                visits.set(p.id, room);
                p.sendMessage(`§b${TITLES[room]}§r：触摸绿色提示台获取帮助。`);
            }
            if (system.currentTick - lastProgress > 1200 && system.currentTick % 600 === 0)
                p.sendMessage(`§a小提示：§r${HINTS[quest.stage][0]} §7还需要帮助就触摸绿台。`);
        }
        catch (e) {
            console.warn(`EARTH_PLAYER ${p.name}: ${e}`);
        }
    }
}
