import { FLAME, key } from "./bomber-model";
// Cosmetic only: failures must never cancel a round or affect damage resolution.
export function explosionEffects(d, base, match, before) {
    let budget = 224;
    const unavailable = new Set();
    const emit = (id, x, y, z) => {
        if (budget-- <= 0 || unavailable.has(id))
            return;
        try {
            d.spawnParticle(`minecraft:${id}`, { x: base.x + x, y: base.y + y, z: base.z + z });
        }
        catch {
            unavailable.add(id);
        }
    };
    for (const b of before)
        if (!match.bombs.has(key(b))) {
            emit("large_explosion", b.x * 2 + 1, 1.5, b.z * 2 + 1);
            emit("basic_smoke_particle", b.x * 2 + .5, 1.5, b.z * 2 + .5);
            emit("basic_smoke_particle", b.x * 2 + 1.5, 1.5, b.z * 2 + 1.5);
        }
    for (const [k, until] of match.flames) {
        if (until !== match.time + FLAME && match.time % 4 !== 0)
            continue;
        const [x, z] = k.split(",").map(Number);
        emit("basic_flame_particle", x * 2 + .45, 1.15, z * 2 + .45);
        emit("basic_flame_particle", x * 2 + 1.55, 1.15, z * 2 + 1.55);
    }
    // Fuse smoke speeds up during the last second of the five-second countdown.
    for (const b of match.bombs.values())
        if (match.time % (b.due - match.time <= 20 ? 4 : 10) === 0) {
            emit("basic_smoke_particle", b.x * 2 + .5, 2.05, b.z * 2 + .5);
        }
}
