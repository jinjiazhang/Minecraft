// Pure rules: one simulation step is one server tick (20 Hz).
export const WIDTH = 13, HEIGHT = 11, FUSE = 100, FLAME = 12, ROUND = 3600;
export const key = (p) => `${p.x},${p.z}`;
export class BomberMatch {
    constructor(ids, random = Math.random) {
        this.walls = new Set();
        this.crates = new Set();
        this.gifts = new Map();
        this.hidden = new Map();
        this.bombs = new Map();
        this.flames = new Map();
        this.time = 0;
        this.ended = false;
        if (ids.length !== 2 || ids[0] === ids[1])
            throw new Error("需要两位不同玩家");
        this.players = ids.map((id, i) => ({ id, x: i ? WIDTH - 2 : 1, z: i ? HEIGHT - 2 : 1, alive: true, range: 2, capacity: 1 }));
        for (let x = 0; x < WIDTH; x++)
            for (let z = 0; z < HEIGHT; z++) {
                const k = key({ x, z });
                if (!x || !z || x === WIDTH - 1 || z === HEIGHT - 1 || (x % 2 === 0 && z % 2 === 0))
                    this.walls.add(k);
                // Mirror the map so both starting corners have the same opportunities.
                else if (x + z <= (WIDTH + HEIGHT - 2) / 2 && x + z > 3 && random() < .75) {
                    const gift = random();
                    for (const pos of [{ x, z }, { x: WIDTH - 1 - x, z: HEIGHT - 1 - z }]) {
                        const at = key(pos);
                        this.crates.add(at);
                        if (gift < .4)
                            this.hidden.set(at, gift < .2 ? "range" : "capacity");
                    }
                }
            }
    }
    move(id, to) {
        const p = this.players.find(p => p.id === id), k = key(to);
        if (!p?.alive || this.ended || to.x < 0 || to.z < 0 || to.x >= WIDTH || to.z >= HEIGHT || this.walls.has(k) || this.crates.has(k))
            return false;
        if (Math.abs(p.x - to.x) + Math.abs(p.z - to.z) > 1)
            return false;
        if (this.bombs.has(k) && key(p) !== k)
            return false;
        p.x = to.x;
        p.z = to.z;
        return true;
    }
    place(id, target) {
        const p = this.players.find(p => p.id === id);
        if (!p?.alive || this.ended)
            return false;
        const at = target ?? p, k = key(at);
        if (!Number.isInteger(at.x) || !Number.isInteger(at.z) || at.x < 0 || at.z < 0 || at.x >= WIDTH || at.z >= HEIGHT || Math.abs(at.x - p.x) + Math.abs(at.z - p.z) > 1)
            return false;
        if (this.walls.has(k) || this.crates.has(k) || this.bombs.has(k) || this.flames.has(k))
            return false;
        if ([...this.bombs.values()].filter(b => b.owner === id).length >= p.capacity)
            return false;
        this.bombs.set(k, { x: at.x, z: at.z, owner: id, range: p.range, due: this.time + FUSE });
        return true;
    }
    step() {
        if (this.ended)
            return;
        this.time++;
        for (const [k, until] of this.flames)
            if (until <= this.time)
                this.flames.delete(k);
        const queue = [...this.bombs.values()].filter(b => b.due <= this.time || this.flames.has(key(b)));
        // Crates block every blast in this tick, including simultaneous chains.
        const destroyed = new Set();
        const burn = (pos) => {
            const k = key(pos);
            this.flames.set(k, this.time + FLAME);
            this.gifts.delete(k);
            const bomb = this.bombs.get(k);
            if (bomb)
                queue.push(bomb);
        };
        for (let i = 0; i < queue.length; i++) {
            const b = queue[i];
            if (!this.bombs.delete(key(b)))
                continue;
            burn(b);
            for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
                for (let r = 1; r <= b.range; r++) {
                    const pos = { x: b.x + dx * r, z: b.z + dz * r }, k = key(pos);
                    if (this.walls.has(k))
                        break;
                    burn(pos);
                    if (this.crates.has(k)) {
                        destroyed.add(k);
                        break;
                    }
                }
        }
        for (const k of destroyed) {
            this.crates.delete(k);
            const gift = this.hidden.get(k);
            if (gift)
                this.gifts.set(k, gift);
            this.hidden.delete(k);
        }
        // Resolve all hits together so mutual elimination is a draw.
        for (const p of this.players) {
            if (this.flames.has(key(p)))
                p.alive = false;
            if (!p.alive || this.flames.has(key(p)))
                continue;
            const gift = this.gifts.get(key(p));
            if (gift === "range")
                p.range = Math.min(6, p.range + 1);
            if (gift === "capacity")
                p.capacity = Math.min(4, p.capacity + 1);
            if (gift)
                this.gifts.delete(key(p));
        }
        const alive = this.players.filter(p => p.alive);
        if (alive.length < 2 || this.time >= ROUND) {
            this.ended = true;
            this.winner = alive.length === 1 ? alive[0].id : undefined;
        }
    }
}
