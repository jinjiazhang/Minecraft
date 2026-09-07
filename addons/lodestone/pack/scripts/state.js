export const TOKEN_ITEM = {
    notes: "amethyst_shard",
    maze: "slime_ball",
    mirror: "glass",
    keys: "gold_nugget",
    cart: "cookie",
};
export const TOKEN_NAME = {
    notes: "彩虹音符",
    maze: "果冻软糖",
    mirror: "镜子碎片",
    keys: "糖心钥匙",
    cart: "巧克力饼干",
};
export const ALL_TOKENS = ["notes", "maze", "mirror", "keys", "cart"];
export const sessions = new Map();
export let course;
export function setCourse(next) {
    course = next;
    return next;
}
export function createState() {
    return {
        tokens: [],
        cooldown: 0,
        noteStep: 0,
        mirrorStep: 0,
        hasRed: false,
        hasBlue: false,
        hasYellow: false,
        openedRed: false,
        openedBlue: false,
        openedYellow: false,
    };
}
export function sessionOf(player) {
    const current = sessions.get(player.id);
    if (current) {
        return current;
    }
    const created = createState();
    sessions.set(player.id, created);
    return created;
}
export function hasToken(state, id) {
    return state.tokens.includes(id);
}
export function missingTokens(state) {
    return ALL_TOKENS.filter((id) => !hasToken(state, id)).map((id) => TOKEN_NAME[id]);
}
export function plateIndex(player, plates) {
    const x = Math.floor(player.location.x);
    const z = Math.floor(player.location.z);
    return plates.findIndex((plate) => plate.x === x && plate.z === z);
}
export function grantToken(player, state, id) {
    if (hasToken(state, id)) {
        return;
    }
    state.tokens.push(id);
    player.runCommand(`give @s ${TOKEN_ITEM[id]} 1`);
    player.playSound("random.levelup");
    player.sendMessage(`§6拿到了${TOKEN_NAME[id]}！§r ${state.tokens.length}/5`);
    if (state.tokens.length >= ALL_TOKENS.length) {
        player.sendMessage("§e五件信物齐了，去彩虹塔门口救人。");
    }
}
