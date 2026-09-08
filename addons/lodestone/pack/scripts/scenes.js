import { BlockPermutation } from "@minecraft/server";
import { TITLES } from "./quest";
export const BASE = { x: 10000, y: 80, z: 10000 };
export const MAP_VERSION = 2;
export const centers = Array.from({ length: 6 }, (_, i) => ({ x: BASE.x + 23 + (i % 3) * 48, y: BASE.y, z: BASE.z + 23 + Math.floor(i / 3) * 48 }));
export function at(room, x = 0, y = 0, z = 0) { const c = centers[room]; return { x: c.x + x, y: c.y + y, z: c.z + z }; }
export function spawn(room) { return at(room, 0.5, 1, 15.5); }
export function roomOf(p) { return centers.findIndex(c => Math.abs(p.x - c.x) <= 22 && Math.abs(p.z - c.z) <= 22 && p.y >= 79 && p.y <= 113); }
export const stations = [];
function station(room, id, x, z, label, block, text) { stations.push({ room, id, x, z, label, block, text }); }
for (let r = 0; r < 6; r++) {
    station(r, "help", -3, 14, "探险提示\n触摸这里\n一步一步来", "emerald_block");
    station(r, "travel", 3, 14, "旅程台\n触摸打开手册\n返回 · 参观", "gold_block");
}
station(0, "ready0", -4, 3, "出发 1\n你来触摸\n伙伴去另一边", "gold_block");
station(0, "ready1", 4, 3, "出发 2\n你来触摸\n伙伴去另一边", "gold_block");
station(1, "gear", -13, -8, "零件 1\n绿色齿轮\n触摸收集", "emerald_block");
station(1, "lens", 13, -8, "零件 2\n蓝色透镜\n触摸收集", "diamond_block");
station(1, "battery", 9, 3, "零件 3\n金色电池\n触摸收集", "gold_block");
station(1, "engine0", -3, 5, "启动 1\n装好三个零件\n两人各点一边", "copper_block");
station(1, "engine1", 3, 5, "启动 2\n装好三个零件\n两人各点一边", "copper_block");
station(2, "read", -12, 1, "蘑菇观察台\n触摸读图\n把线索告诉伙伴", "bookshelf");
station(2, "red", -6, -8, "红色\n圆点蘑菇\n触摸选择", "red_mushroom_block");
station(2, "blue", 2, -8, "蓝色\n小伞蘑菇\n触摸选择", "blue_wool");
station(2, "yellow", 10, -8, "黄色\n星星蘑菇\n触摸选择", "yellow_wool");
station(3, "valve0", -11, 2, "左水闸\n触摸开闸\n伙伴去右边", "lapis_block");
station(3, "valve1", 11, 2, "右水闸\n触摸开闸\n伙伴去左边", "lapis_block");
station(4, "read", -12, 1, "星图阅读台\n触摸看星图\n告诉另一位伙伴", "bookshelf");
station(4, "cyan", -4, -7, "蓝色 1\n触摸水晶", "diamond_block");
station(4, "pink", 3, -7, "粉色 2\n触摸水晶", "pink_stained_glass");
station(4, "violet", 10, -7, "紫色 3\n触摸水晶", "amethyst_block");
station(5, "plant0", -6, 4, "左花坛\n触摸种下光之种\n每人种一颗", "moss_block");
station(5, "plant1", 6, 4, "右花坛\n触摸种下光之种\n每人种一颗", "moss_block");
const stories = [
    "§e老发明家的信§r\n大树的星灯熄灭了。地下花园里还藏着两颗光之种。带上伙伴和勇气，替我把光带回家。\n——你们的朋友，阿铜爷爷",
    "§e工坊手记§r\n齿轮让车轮转动，透镜让车灯看清黑暗，电池给机器力量。最重要的零件，是愿意互相帮助的两个人。",
    "§e蘑菇的悄悄话§r\n我们用颜色和形状指路。看见线索的人要说出来，走在前面的人要听一听。你们也可以交换工作。",
    "§e水城居民的感谢§r\n我们把水藏在玻璃下，桥上很安全。两边的水流汇合，水车就能再次带来灯光。",
    "§e星图碎片§r\n地下也有星空。每颗星星都有自己的颜色和数字。答错没关系，已经点亮的星光会等着你。",
    "§e园丁的留言§r\n这里最珍贵的宝藏不是钻石，是你们一起照顾的小小生命。两颗种子，两棵树，一起长大的家。",
];
for (let r = 0; r < 6; r++)
    station(r, "story", -9, 10, "探险故事牌\n触摸读一读", "chiseled_bookshelf", stories[r]);
export function stationAt(p) { return stations.find(s => { const v = at(s.room, s.x, 0, s.z); return p.x === v.x && p.z === v.z && p.y >= 80 && p.y <= 83; }); }
export function execute(d, job) {
    if (job.kind === "fill") {
        const { a, b } = job;
        d.runCommand(`fill ${a.x} ${a.y} ${a.z} ${b.x} ${b.y} ${b.z} minecraft:${job.block}`);
        return;
    }
    const b = d.getBlock(job.p);
    if (!b)
        throw new Error(`Sign chunk unavailable: ${JSON.stringify(job.p)}`);
    b.setPermutation(BlockPermutation.resolve("minecraft:standing_sign", { ground_sign_direction: 0 }));
    const sign = b.getComponent("minecraft:sign");
    if (!sign)
        throw new Error("Sign component unavailable");
    sign.setText(job.text);
    sign.setWaxed(true);
}
// Every fill is <= 32,768 blocks. Generated deterministically for restart/retry safety.
export function buildPlan() {
    const jobs = [];
    let r = 0;
    const box = (x, y, z, xx, yy, zz, block) => jobs.push({ kind: "fill", a: at(r, x, y, z), b: at(r, xx, yy, zz), block });
    const put = (x, y, z, block) => box(x, y, z, x, y, z, block);
    const sign = (x, y, z, text) => jobs.push({ kind: "sign", p: at(r, x, y, z), text });
    const lamp = (x, z) => { put(x, 0, z, "stone_bricks"); box(x, 1, z, x, 3, z, "oak_fence"); put(x, 4, z, "sea_lantern"); };
    const mushroom = (x, z, h, color) => {
        box(x, 0, z, x, h, z, "mushroom_stem");
        box(x - 2, h, z - 2, x + 2, h, z + 2, color);
        box(x - 1, h + 1, z - 1, x + 1, h + 1, z + 1, color);
        put(x, h - 1, z + 1, "shroomlight");
        put(x - 1, h + 1, z, "white_wool");
        put(x + 1, h, z + 2, "white_wool");
    };
    const crystal = (x, z, h, color) => {
        box(x - 1, 0, z - 1, x + 1, 1, z + 1, "calcite");
        box(x, 1, z, x, h, z, color);
        box(x + 1, 1, z, x + 1, Math.max(2, h - 2), z, "amethyst_block");
        put(x, 0, z, "sea_lantern");
    };
    const tree = (x, z, lit) => {
        box(x - 1, 0, z - 1, x + 1, 7, z + 1, "oak_log");
        box(x - 4, 7, z - 3, x + 4, 9, z + 3, "azalea_leaves");
        box(x - 3, 10, z - 2, x + 3, 11, z + 2, "azalea_leaves_flowered");
        for (const dx of [-3, 3]) {
            box(x + dx, 5, z, x + dx, 7, z, "oak_log");
            put(x + dx, 6, z + 2, lit ? "shroomlight" : "brown_wool");
        }
    };
    const house = (x, z) => {
        box(x - 4, -1, z - 3, x + 4, -1, z + 3, "spruce_planks");
        box(x - 4, 0, z - 3, x + 4, 4, z + 3, "stripped_oak_log");
        box(x - 3, 0, z - 2, x + 3, 3, z + 2, "air");
        box(x - 1, 0, z + 3, x + 1, 2, z + 3, "air");
        for (const dx of [-3, 3])
            box(x + dx, 1, z + 3, x + dx, 2, z + 3, "glass");
        for (let h = 0; h < 4; h++)
            box(x - 5 + h, 5 + h, z - 4, x + 5 - h, 5 + h, z + 4, "dark_oak_planks");
        put(x - 2, 0, z - 1, "crafting_table");
        put(x + 2, 0, z - 1, "bookshelf");
        put(x, 3, z, "lantern");
        box(x - 2, 0, z + 1, x - 2, 0, z + 2, "red_wool");
        put(x - 2, 0, z, "white_wool");
    };
    for (r = 0; r < 6; r++) {
        for (let y = -2; y < 34; y += 6)
            box(-23, y, -23, 23, Math.min(y + 5, 33), 23, "stone");
        // Stepped cavern vault, tall center and lower edges; no exposed default landscape.
        box(-20, 0, -20, 20, 8, 20, "air");
        box(-18, 9, -18, 18, 15, 18, "air");
        box(-15, 16, -15, 15, 21, 15, "air");
        box(-11, 22, -11, 11, 25, 11, "air");
        box(-6, 26, -6, 6, 28, 6, "air");
        box(-20, -1, -20, 20, -1, 20, ["moss_block", "polished_deepslate", "moss_block", "stone_bricks", "calcite", "moss_block"][r]);
        for (let k = 0; k < 24; k++) {
            const x = (k * 13 + r * 7) % 37 - 18, z = (k * 17 + r * 3) % 37 - 18;
            if (Math.abs(x) > 5 && Math.abs(z) > 5)
                put(x, -1, z, r === 1 ? "copper_block" : r === 4 ? "amethyst_block" : "dirt_with_roots");
        }
        for (let t = -16; t <= 16; t += 8) {
            box(t, 0, -20, t + 1, 9 + Math.abs(t % 3), -19, r === 1 ? "deepslate_bricks" : "tuff");
            put(t, 6, -18, "glowstone");
            put(-19, 5, t, "glowstone");
            put(19, 5, t, "glowstone");
            box(t, 0, 19, t + 1, 7, 20, "tuff");
        }
        for (let k = 0; k < 18; k++) {
            const x = (k * 7) % 21 - 10, z = (k * 11) % 21 - 10;
            put(x, 22 + (k % 3), z, "sea_lantern");
            if (k % 3 === 0)
                box(x, 19, z, x, 21, z, "oak_leaves");
        }
        box(-1, -1, -15, 1, -1, 17, r === 1 ? "polished_andesite" : "smooth_sandstone");
        box(-15, -1, 7, 15, -1, 9, "smooth_sandstone");
        for (let z = -13; z <= 13; z += 6) {
            put(-2, -1, z, "sea_lantern");
            put(2, -1, z, "sea_lantern");
        }
        lamp(-16, 13);
        lamp(16, 13);
        sign(0, 0, 12, `${TITLES[r]}\n沿灯光小路前进\n绿台提示 · 金台手册\n触摸彩色台子互动`);
        if (r === 0) {
            tree(0, -7, false);
            house(-12, -10);
            house(12, -10);
            box(-5, -1, -2, 5, -1, 5, "stone_bricks");
            for (const x of [-15, -10, 10, 15]) {
                put(x, 0, 3, "flowering_azalea");
                put(x, 0, 5, "red_tulip");
            }
            sign(0, 0, 1, "星灯大树睡着了\n去地心寻找光之种\n和伙伴一起出发！");
        }
        else if (r === 1) {
            for (const x of [-15, 15]) {
                box(x, 0, -14, x, 4, -6, "bookshelf");
                box(x - 1, 0, -4, x + 1, 0, -2, "crafting_table");
            }
            // Brass drill vehicle: caterpillar tracks, observation cabin, layered drill nose.
            box(-4, 0, -8, 4, 2, 0, "copper_block");
            for (const x of [-5, 5]) {
                box(x, 0, -8, x, 1, 0, "deepslate_tiles");
                for (let z = -7; z <= -1; z += 2)
                    put(x, 1, z, "polished_blackstone");
            }
            box(-3, 3, -6, 3, 5, -1, "cut_copper");
            box(-2, 3, -5, 2, 4, -1, "glass");
            box(-2, 5, -5, 2, 5, -2, "cut_copper");
            box(-2, 1, -10, 2, 3, -9, "iron_block");
            box(-1, 1, -12, 1, 3, -11, "iron_block");
            put(0, 2, -13, "lightning_rod");
            put(-3, 2, 1, "sea_lantern");
            put(3, 2, 1, "sea_lantern");
            for (let z = -16; z <= 9; z++) {
                put(-5, -1, z, "iron_block");
                put(5, -1, z, "iron_block");
            }
            box(11, 1, -15, 11, 10, -15, "copper_block");
            box(-12, 9, -15, 11, 9, -15, "cut_copper");
        }
        else if (r === 2) {
            for (const [x, z, h, c] of [[-14, -12, 8, "red_mushroom_block"], [9, -14, 10, "blue_wool"], [14, 3, 7, "yellow_wool"], [-15, 7, 5, "red_mushroom_block"], [-7, -15, 6, "red_mushroom_block"]])
                mushroom(x, z, h, c);
            box(-15, -1, -2, -9, -1, 3, "spruce_planks");
            for (let x = -14; x <= 14; x += 4) {
                put(x, 0, -17, "flowering_azalea");
                put(x, 0, 17, "azalea");
            }
            // Shape mosaics supplement colors for early readers.
            put(-6, 3, -11, "white_wool");
            box(0, 3, -11, 4, 3, -11, "blue_wool");
            put(2, 2, -11, "mushroom_stem");
            box(9, 3, -11, 11, 3, -11, "yellow_wool");
            box(10, 2, -11, 10, 4, -11, "yellow_wool");
        }
        else if (r === 3) {
            // Covered channels: children never need to swim or risk drowning.
            for (const x of [-7, 7]) {
                box(x - 1, -2, -15, x + 1, -2, 12, "prismarine");
                box(x - 1, -1, -15, x + 1, -1, 12, "light_blue_stained_glass");
            }
            box(-14, -1, 5, 14, -1, 8, "dark_oak_planks");
            for (const x of [-16, 16]) {
                box(x, 0, -15, x + 1, 9, -15, "prismarine_bricks");
                box(x, 0, -7, x + 1, 9, -7, "prismarine_bricks");
                box(x, 9, -15, x + 1, 9, -7, "dark_prismarine");
            }
            // Eight-spoke monumental wheel in a vertical plane.
            for (let x = -6; x <= 6; x++)
                for (let y = 1; y <= 13; y++) {
                    const radius = Math.hypot(x, y - 7);
                    if ((radius >= 5 && radius <= 6.2) || x === 0 || y === 7 || Math.abs(x) === Math.abs(y - 7))
                        put(x, y, -12, "dark_oak_log");
                }
            put(0, 7, -11, "copper_block");
            box(-3, 0, -16, 3, 2, -14, "prismarine");
            sign(0, 0, 4, "水渠藏在玻璃下面\n放心走在桥上\n左右水闸各开一次");
        }
        else if (r === 4) {
            for (const [x, z, h] of [[-14, -13, 10], [-7, -15, 7], [4, -14, 12], [14, -12, 8], [16, 4, 6], [-15, 7, 5]])
                crystal(x, z, h, "purple_stained_glass");
            box(-16, 0, -5, -9, 0, -3, "polished_deepslate");
            for (let i = 0; i < 3; i++) {
                put(-14 + i * 2, 2 + i, -4, "sea_lantern");
            }
            box(-1, -1, -5, 1, -1, 7, "amethyst_block");
        }
        else {
            box(-8, -1, -10, 8, -1, 6, "azalea_leaves_flowered");
            box(-2, -1, -10, 2, -1, 12, "smooth_sandstone");
            for (const x of [-6, 6]) {
                box(x - 2, -1, -5, x + 2, -1, -1, "moss_block");
                box(x - 2, 0, -6, x + 2, 0, -6, "mossy_stone_bricks");
            }
            for (let x = -15; x <= 15; x += 3)
                for (const z of [-14, 10])
                    put(x, 0, z, x % 2 ? "flowering_azalea" : "red_tulip");
            for (const x of [-12, 12]) {
                box(x, 0, -9, x, 10, -9, "mossy_stone_bricks");
                box(x, 0, 1, x, 7, 1, "mossy_stone_bricks");
            }
            box(-12, 10, -9, 12, 10, -9, "mossy_stone_bricks");
            box(-8, 9, -9, 8, 9, -9, "azalea_leaves_flowered");
            crystal(0, -14, 8, "yellow_stained_glass");
        }
    }
    for (const s of stations) {
        r = s.room;
        put(s.x, 0, s.z, "chiseled_stone_bricks");
        put(s.x, 1, s.z, s.block);
        sign(s.x, 2, s.z, s.label);
        put(s.x, -1, s.z + 1, "sea_lantern");
    }
    return jobs;
}
export function visualPlan(q) {
    const jobs = [];
    const put = (room, x, y, z, block) => jobs.push({ kind: "fill", a: at(room, x, y, z), b: at(room, x, y, z), block });
    for (const s of stations) {
        if (["help", "travel", "story", "read"].includes(s.id))
            continue;
        let lit = q.stage > s.room || !!q.pairs[s.id] || q.parts.includes(s.id);
        if (s.room === q.stage && (q.stage === 2 || q.stage === 4))
            lit = (q.stage === 2 ? ["red", "blue", "yellow"] : ["violet", "cyan", "pink"]).slice(0, q.step).includes(s.id);
        put(s.room, s.x, 0, s.z, lit ? "sea_lantern" : "chiseled_stone_bricks");
    }
    for (let side = 0; side < 2; side++)
        if (q.stage > 3 || q.pairs[`valve${side}`]) {
            const x = side ? 7 : -7;
            jobs.push({ kind: "fill", a: at(3, x - 1, -2, -15), b: at(3, x + 1, -2, 12), block: "water" });
            for (let z = -14; z < 12; z += 4)
                put(3, x + (side ? 2 : -2), 0, z, "sea_lantern");
        }
    if (q.stage >= 4)
        put(3, 0, 7, -11, "sea_lantern");
    if (q.stage >= 6) {
        for (const room of [0, 5])
            for (const x of [-6, 6]) {
                jobs.push({ kind: "fill", a: at(room, x, 0, -4), b: at(room, x, 6, -4), block: "oak_log" });
                jobs.push({ kind: "fill", a: at(room, x - 2, 6, -6), b: at(room, x + 2, 8, -2), block: "azalea_leaves_flowered" });
                put(room, x, 9, -4, "sea_lantern");
                put(room, x - 2, 6, -3, "shroomlight");
                put(room, x + 2, 6, -3, "shroomlight");
            }
        put(0, -3, 6, -5, "shroomlight");
        put(0, 3, 6, -5, "shroomlight");
        jobs.push({ kind: "sign", p: at(0, 0, 0, 1), text: "地心探险队\n两位勇敢的伙伴\n一起找回了星光\n这里永远是你们的家" });
    }
    return jobs;
}
