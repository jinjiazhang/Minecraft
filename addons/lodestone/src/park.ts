import { Player, system, Vector3, world } from "@minecraft/server";

export interface Site {
  x: number;
  y: number;
  z: number;
}

export interface Course {
  hub: Site;
  menu: Site;
  towerDoor: Site;
  towerTop: Site;
  notes: Site;
  notesPlates: Site[];
  maze: Site;
  mazeEnd: Site;
  mirror: Site;
  mirrorPlates: Site[];
  keys: Site;
  keyRed: Site;
  keyBlue: Site;
  keyYellow: Site;
  doorRed: Site;
  doorBlue: Site;
  doorYellow: Site;
  cart: Site;
  cartEnd: Site;
}

const FILL_LIMIT = 30000;
const FLAT = 92;
const CLEAR_UP = 48;
const CLEAR_DOWN = 6;
const TILE = 16;
const JOBS_PER_TICK = 8;

export function asVector(target: Site): Vector3 {
  return { x: target.x + 0.5, y: target.y, z: target.z + 0.5 };
}

export function near(player: Player, target: Site, range: number): boolean {
  const dx = player.location.x - (target.x + 0.5);
  const dz = player.location.z - (target.z + 0.5);
  return Math.hypot(dx, dz) <= range;
}

export function portOrigin(player: Player, existing?: Course): Site {
  if (existing) {
    return existing.hub;
  }
  return {
    x: Math.floor(player.location.x),
    y: Math.max(8, Math.floor(player.location.y)),
    z: Math.floor(player.location.z),
  };
}

export function isMenuStand(course: Course, x: number, y: number, z: number): boolean {
  const stand = course.menu;
  return x === stand.x && z === stand.z && y >= stand.y && y <= stand.y + 1;
}

function nameOf(block: string): string {
  return block.replace("minecraft:", "");
}

function fill(player: Player, x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, block: string): void {
  const xa = Math.min(x1, x2);
  const xb = Math.max(x1, x2);
  const ya = Math.min(y1, y2);
  const yb = Math.max(y1, y2);
  const za = Math.min(z1, z2);
  const zb = Math.max(z1, z2);
  const volume = (xb - xa + 1) * (yb - ya + 1) * (zb - za + 1);
  if (volume <= FILL_LIMIT) {
    player.runCommand(`fill ${xa} ${ya} ${za} ${xb} ${yb} ${zb} ${nameOf(block)}`);
    return;
  }
  const dx = xb - xa;
  const dy = yb - ya;
  const dz = zb - za;
  if (dx >= dy && dx >= dz) {
    const mid = xa + Math.floor(dx / 2);
    fill(player, xa, ya, za, mid, yb, zb, block);
    fill(player, mid + 1, ya, za, xb, yb, zb, block);
    return;
  }
  if (dz >= dy) {
    const mid = za + Math.floor(dz / 2);
    fill(player, xa, ya, za, xb, yb, mid, block);
    fill(player, xa, ya, mid + 1, xb, yb, zb, block);
    return;
  }
  const mid = ya + Math.floor(dy / 2);
  fill(player, xa, ya, za, xb, mid, zb, block);
  fill(player, xa, mid + 1, za, xb, yb, zb, block);
}

function put(player: Player, x: number, y: number, z: number, block: string): void {
  player.runCommand(`setblock ${x} ${y} ${z} ${nameOf(block)}`);
}

export function openHole(player: Player, x: number, y: number, z: number): void {
  fill(player, x - 1, y, z, x + 1, y + 2, z, "minecraft:air");
}

function road(player: Player, x1: number, z1: number, x2: number, z2: number, y: number, block: string): void {
  fill(player, x1, y - 1, z1, x2, y - 1, z2, block);
  fill(player, x1, y, z1, x2, y + 3, z2, "minecraft:air");
}

function house(
  player: Player,
  cx: number,
  y: number,
  cz: number,
  rx: number,
  rz: number,
  wall: string,
  floor: string,
  doorZ: "north" | "south" | "west" | "east",
): void {
  fill(player, cx - rx, y - 1, cz - rz, cx + rx, y - 1, cz + rz, floor);
  fill(player, cx - rx, y, cz - rz, cx + rx, y + 3, cz + rz, "minecraft:air");
  fill(player, cx - rx, y, cz - rz, cx + rx, y + 3, cz - rz, wall);
  fill(player, cx - rx, y, cz + rz, cx + rx, y + 3, cz + rz, wall);
  fill(player, cx - rx, y, cz - rz, cx - rx, y + 3, cz + rz, wall);
  fill(player, cx + rx, y, cz - rz, cx + rx, y + 3, cz + rz, wall);
  fill(player, cx - rx, y + 4, cz - rz, cx + rx, y + 4, cz + rz, wall);
  if (doorZ === "south") {
    fill(player, cx, y, cz + rz, cx, y + 2, cz + rz, "minecraft:air");
  } else if (doorZ === "north") {
    fill(player, cx, y, cz - rz, cx, y + 2, cz - rz, "minecraft:air");
  } else if (doorZ === "west") {
    fill(player, cx - rx, y, cz, cx - rx, y + 2, cz, "minecraft:air");
  } else {
    fill(player, cx + rx, y, cz, cx + rx, y + 2, cz, "minecraft:air");
  }
}

function floorBlock(x: number, z: number): string {
  return (Math.floor(x / 8) + Math.floor(z / 8)) % 2 === 0
    ? "minecraft:lime_concrete"
    : "minecraft:yellow_concrete";
}

function flattenJobs(player: Player, hub: Site): Array<() => void> {
  const jobs: Array<() => void> = [];
  const { x: cx, y, z: cz } = hub;
  for (let x = cx - FLAT; x <= cx + FLAT; x += TILE) {
    for (let z = cz - FLAT; z <= cz + FLAT; z += TILE) {
      const x2 = Math.min(x + TILE - 1, cx + FLAT);
      const z2 = Math.min(z + TILE - 1, cz + FLAT);
      jobs.push(() => fill(player, x, y, z, x2, y + CLEAR_UP, z2, "minecraft:air"));
      jobs.push(() => fill(player, x, y - CLEAR_DOWN, z, x2, y - 2, z2, "minecraft:pink_concrete"));
      jobs.push(() => fill(player, x, y - 1, z, x2, y - 1, z2, floorBlock(x, z)));
    }
  }
  return jobs;
}

function runJobs(jobs: Array<() => void>, index: number, done: () => void): void {
  const end = Math.min(index + JOBS_PER_TICK, jobs.length);
  for (let i = index; i < end; i++) {
    jobs[i]();
  }
  if (end < jobs.length) {
    system.runTimeout(() => runJobs(jobs, end, done), 1);
    return;
  }
  done();
}

function buildCandyPort(player: Player, hub: Site): Course {
  const { x: cx, y, z: cz } = hub;

  fill(player, cx - 34, y - 1, cz - 38, cx + 34, y - 1, cz + 34, "minecraft:lime_concrete");
  fill(player, cx - 34, y, cz - 38, cx + 34, y + 8, cz + 34, "minecraft:air");
  fill(player, cx - 34, y, cz - 38, cx + 34, y + 1, cz - 38, "minecraft:yellow_concrete");
  fill(player, cx - 34, y, cz + 34, cx + 34, y + 1, cz + 34, "minecraft:yellow_concrete");
  fill(player, cx - 34, y, cz - 38, cx - 34, y + 1, cz + 34, "minecraft:yellow_concrete");
  fill(player, cx + 34, y, cz - 38, cx + 34, y + 1, cz + 34, "minecraft:yellow_concrete");

  fill(player, cx - 7, y - 1, cz - 7, cx + 7, y - 1, cz + 7, "minecraft:white_concrete");
  fill(player, cx - 2, y - 1, cz - 2, cx + 2, y - 1, cz + 2, "minecraft:orange_concrete");
  put(player, cx, y, cz - 6, "minecraft:lantern");
  put(player, cx, y, cz + 6, "minecraft:lantern");
  put(player, cx, y, cz + 3, "minecraft:gold_block");
  put(player, cx, y + 1, cz + 3, "minecraft:lantern");

  fill(player, cx - 3, y - 1, cz - 16, cx + 3, y - 1, cz - 8, "minecraft:gold_block");
  fill(player, cx - 3, y, cz - 16, cx + 3, y + 9, cz - 8, "minecraft:pink_concrete");
  fill(player, cx - 2, y, cz - 15, cx + 2, y + 8, cz - 9, "minecraft:air");
  fill(player, cx - 1, y, cz - 8, cx + 1, y + 2, cz - 8, "minecraft:iron_bars");
  put(player, cx, y + 10, cz - 12, "minecraft:lantern");
  put(player, cx, y + 9, cz - 12, "minecraft:slime");

  road(player, cx - 1, cz + 7, cx + 1, cz + 16, y, "minecraft:magenta_concrete");
  house(player, cx, y, cz + 21, 5, 4, "minecraft:magenta_concrete", "minecraft:magenta_concrete", "north");
  put(player, cx - 3, y, cz + 19, "minecraft:red_wool");
  put(player, cx - 1, y, cz + 19, "minecraft:yellow_wool");
  put(player, cx + 1, y, cz + 19, "minecraft:blue_wool");
  put(player, cx + 3, y, cz + 19, "minecraft:lime_wool");
  put(player, cx - 3, y, cz + 23, "minecraft:red_concrete");
  put(player, cx - 1, y, cz + 23, "minecraft:yellow_concrete");
  put(player, cx + 1, y, cz + 23, "minecraft:blue_concrete");
  put(player, cx + 3, y, cz + 23, "minecraft:lime_concrete");
  put(player, cx - 3, y + 1, cz + 23, "minecraft:stone_pressure_plate");
  put(player, cx - 1, y + 1, cz + 23, "minecraft:stone_pressure_plate");
  put(player, cx + 1, y + 1, cz + 23, "minecraft:stone_pressure_plate");
  put(player, cx + 3, y + 1, cz + 23, "minecraft:stone_pressure_plate");

  road(player, cx + 7, cz - 1, cx + 16, cz + 1, y, "minecraft:red_concrete");
  house(player, cx + 22, y, cz, 5, 4, "minecraft:red_concrete", "minecraft:orange_concrete", "west");
  put(player, cx + 20, y, cz - 2, "minecraft:red_wool");
  put(player, cx + 20, y, cz, "minecraft:blue_wool");
  put(player, cx + 20, y, cz + 2, "minecraft:yellow_wool");
  fill(player, cx + 24, y, cz - 2, cx + 24, y + 2, cz - 2, "minecraft:red_concrete");
  fill(player, cx + 24, y, cz, cx + 24, y + 2, cz, "minecraft:blue_concrete");
  fill(player, cx + 24, y, cz + 2, cx + 24, y + 2, cz + 2, "minecraft:yellow_concrete");

  road(player, cx - 16, cz - 1, cx - 7, cz + 1, y, "minecraft:light_blue_concrete");
  house(player, cx - 22, y, cz, 5, 4, "minecraft:light_blue_concrete", "minecraft:white_concrete", "east");
  put(player, cx - 24, y + 1, cz - 2, "minecraft:red_wool");
  put(player, cx - 24, y + 1, cz, "minecraft:yellow_wool");
  put(player, cx - 24, y + 1, cz + 2, "minecraft:blue_wool");
  put(player, cx - 20, y, cz - 2, "minecraft:red_concrete");
  put(player, cx - 20, y, cz, "minecraft:yellow_concrete");
  put(player, cx - 20, y, cz + 2, "minecraft:blue_concrete");
  put(player, cx - 20, y + 1, cz - 2, "minecraft:stone_pressure_plate");
  put(player, cx - 20, y + 1, cz, "minecraft:stone_pressure_plate");
  put(player, cx - 20, y + 1, cz + 2, "minecraft:stone_pressure_plate");

  road(player, cx - 16, cz + 7, cx - 8, cz + 9, y, "minecraft:pink_concrete");
  road(player, cx - 16, cz + 9, cx - 14, cz + 18, y, "minecraft:pink_concrete");
  house(player, cx - 15, y, cz + 23, 6, 5, "minecraft:pink_concrete", "minecraft:pink_concrete", "north");
  fill(player, cx - 19, y, cz + 21, cx - 11, y + 2, cz + 26, "minecraft:pink_concrete");
  fill(player, cx - 18, y, cz + 22, cx - 12, y + 2, cz + 25, "minecraft:air");
  fill(player, cx - 16, y, cz + 22, cx - 16, y + 2, cz + 24, "minecraft:pink_concrete");
  fill(player, cx - 14, y, cz + 23, cx - 14, y + 2, cz + 25, "minecraft:pink_concrete");
  put(player, cx - 12, y, cz + 25, "minecraft:gold_block");

  road(player, cx + 8, cz + 7, cx + 16, cz + 9, y, "minecraft:brown_concrete");
  road(player, cx + 14, cz + 9, cx + 16, cz + 18, y, "minecraft:brown_concrete");
  fill(player, cx + 14, y, cz + 8, cx + 16, y, cz + 18, "minecraft:rail");
  house(player, cx + 15, y, cz + 23, 4, 4, "minecraft:brown_concrete", "minecraft:brown_concrete", "north");
  put(player, cx + 15, y, cz + 24, "minecraft:gold_block");
  put(player, cx + 15, y + 1, cz + 24, "minecraft:lantern");

  const course: Course = {
    hub: { x: cx, y, z: cz },
    menu: { x: cx, y, z: cz + 3 },
    towerDoor: { x: cx, y, z: cz - 8 },
    towerTop: { x: cx, y: y + 9, z: cz - 12 },
    notes: { x: cx, y, z: cz + 21 },
    notesPlates: [
      { x: cx - 3, y, z: cz + 23 },
      { x: cx - 1, y, z: cz + 23 },
      { x: cx + 1, y, z: cz + 23 },
      { x: cx + 3, y, z: cz + 23 },
    ],
    maze: { x: cx - 15, y, z: cz + 20 },
    mazeEnd: { x: cx - 12, y, z: cz + 25 },
    mirror: { x: cx - 22, y, z: cz },
    mirrorPlates: [
      { x: cx - 20, y, z: cz - 2 },
      { x: cx - 20, y, z: cz },
      { x: cx - 20, y, z: cz + 2 },
    ],
    keys: { x: cx + 22, y, z: cz },
    keyRed: { x: cx + 20, y, z: cz - 2 },
    keyBlue: { x: cx + 20, y, z: cz },
    keyYellow: { x: cx + 20, y, z: cz + 2 },
    doorRed: { x: cx + 24, y, z: cz - 2 },
    doorBlue: { x: cx + 24, y, z: cz },
    doorYellow: { x: cx + 24, y, z: cz + 2 },
    cart: { x: cx + 15, y, z: cz + 20 },
    cartEnd: { x: cx + 15, y, z: cz + 24 },
  };

  world.setDefaultSpawnLocation({ x: cx, y, z: cz });
  return course;
}

export function prepareCandyPort(player: Player, existing: Course | undefined, done: (course: Course) => void): void {
  const hub = portOrigin(player, existing);
  fill(player, hub.x - 2, hub.y - 1, hub.z - 2, hub.x + 2, hub.y - 1, hub.z + 2, "minecraft:orange_concrete");
  fill(player, hub.x - 2, hub.y, hub.z - 2, hub.x + 2, hub.y + 6, hub.z + 2, "minecraft:air");
  player.teleport(asVector(hub));
  runJobs(flattenJobs(player, hub), 0, () => {
    done(buildCandyPort(player, hub));
  });
}
