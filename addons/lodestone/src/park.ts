import { Player, Vector3, world } from "@minecraft/server";

export interface Site {
  x: number;
  y: number;
  z: number;
}

export interface Course {
  hub: Site;
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

export function asVector(target: Site): Vector3 {
  return { x: target.x + 0.5, y: target.y, z: target.z + 0.5 };
}

export function near(player: Player, target: Site, range: number): boolean {
  const dx = player.location.x - (target.x + 0.5);
  const dz = player.location.z - (target.z + 0.5);
  return Math.hypot(dx, dz) <= range;
}

function nameOf(block: string): string {
  return block.replace("minecraft:", "");
}

function fill(player: Player, x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, block: string): void {
  player.runCommand(`fill ${x1} ${y1} ${z1} ${x2} ${y2} ${z2} ${nameOf(block)}`);
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

export function buildCandyPort(player: Player, existing?: Course): Course {
  const cx = existing ? existing.hub.x : Math.floor(player.location.x);
  const cz = existing ? existing.hub.z : Math.floor(player.location.z);
  const y = existing ? existing.hub.y : Math.max(8, Math.floor(player.location.y));

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

  fill(player, cx - 3, y - 1, cz - 16, cx + 3, y - 1, cz - 8, "minecraft:gold_block");
  fill(player, cx - 3, y, cz - 16, cx + 3, y + 9, cz - 8, "minecraft:pink_concrete");
  fill(player, cx - 2, y, cz - 15, cx + 2, y + 8, cz - 9, "minecraft:air");
  fill(player, cx - 1, y, cz - 8, cx + 1, y + 2, cz - 8, "minecraft:iron_bars");
  put(player, cx, y + 10, cz - 12, "minecraft:lantern");
  put(player, cx, y + 9, cz - 12, "minecraft:slime_block");

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
