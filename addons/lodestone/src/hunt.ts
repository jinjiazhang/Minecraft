import { Dimension, Player, system, Vector3, world } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";

type HuntStage = 0 | 1 | 2 | 3 | 4;

interface Site {
  x: number;
  y: number;
  z: number;
}

interface Course {
  start: Site;
  pillar: Site;
  altar: Site;
  cage: Site;
  treasure: Site;
}

interface HuntState {
  stage: HuntStage;
  busy: boolean;
}

const progress = new Map<string, HuntState>();
let course: Course | undefined;

const CLUES: Record<HuntStage, string> = {
  0: "面向太阳升起的方向走，找到顶着金子的白色石柱。",
  1: "蓝色方台在石柱的北方。走到台上会听到提问。",
  2: "向西走到铁栏围住的小室，口令是上一个谜题的答案。",
  3: "口令对了。最后走到小室南边的磁石台，取走宝藏。",
  4: "你已经找到失落的磁石。想再玩一次，打开菜单重新开始。",
};

function site(x: number, y: number, z: number): Site {
  return { x, y, z };
}

function asVector(target: Site): Vector3 {
  return { x: target.x + 0.5, y: target.y, z: target.z + 0.5 };
}

function horizontalDistance(player: Player, target: Site): number {
  const dx = player.location.x - (target.x + 0.5);
  const dz = player.location.z - (target.z + 0.5);
  return Math.hypot(dx, dz);
}

function findSurfaceY(dimension: Dimension, x: number, z: number): number {
  const below = dimension.getBlockBelow({ x, y: 120, z });
  if (below && !below.typeId.includes("water") && !below.typeId.includes("lava")) {
    return Math.floor(below.location.y) + 1;
  }

  const y = 64;
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      dimension.setBlockType({ x: x + dx, y: y - 1, z: z + dz }, "minecraft:cobblestone");
      dimension.setBlockType({ x: x + dx, y, z: z + dz }, "minecraft:air");
    }
  }
  return y;
}

function column(dimension: Dimension, target: Site, block: string, height: number): void {
  for (let offset = 0; offset < height; offset++) {
    dimension.setBlockType({ x: target.x, y: target.y + offset, z: target.z }, block);
  }
}

function platform(dimension: Dimension, target: Site, block: string, radius: number): void {
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      dimension.setBlockType({ x: target.x + dx, y: target.y - 1, z: target.z + dz }, block);
    }
  }
}

function buildCourse(dimension: Dimension): Course {
  const spawn = world.getDefaultSpawnLocation();
  const originX = Math.floor(spawn.x) + 48;
  const originZ = Math.floor(spawn.z) + 48;

  const start = site(originX, findSurfaceY(dimension, originX, originZ), originZ);
  const pillar = site(originX + 18, findSurfaceY(dimension, originX + 18, originZ), originZ);
  const altar = site(originX + 18, findSurfaceY(dimension, originX + 18, originZ - 14), originZ - 14);
  const cage = site(originX + 6, findSurfaceY(dimension, originX + 6, originZ - 14), originZ - 14);
  const treasure = site(originX + 6, findSurfaceY(dimension, originX + 6, originZ), originZ);

  platform(dimension, start, "minecraft:cobblestone", 2);
  dimension.setBlockType({ x: start.x + 1, y: start.y, z: start.z }, "minecraft:campfire");

  platform(dimension, pillar, "minecraft:smooth_stone", 1);
  column(dimension, pillar, "minecraft:quartz_pillar", 4);
  dimension.setBlockType({ x: pillar.x, y: pillar.y + 4, z: pillar.z }, "minecraft:gold_block");

  platform(dimension, altar, "minecraft:lapis_block", 1);
  dimension.setBlockType({ x: altar.x, y: altar.y, z: altar.z }, "minecraft:blue_wool");

  platform(dimension, cage, "minecraft:stone_bricks", 2);
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = 0; dy <= 2; dy++) {
      for (let dz = -1; dz <= 1; dz++) {
        const edge = Math.abs(dx) === 1 || Math.abs(dz) === 1;
        const block = edge ? "minecraft:iron_bars" : "minecraft:air";
        dimension.setBlockType({ x: cage.x + dx, y: cage.y + dy, z: cage.z + dz }, block);
      }
    }
  }
  dimension.setBlockType({ x: cage.x, y: cage.y - 1, z: cage.z }, "minecraft:gold_block");

  platform(dimension, treasure, "minecraft:mossy_stone_bricks", 1);
  dimension.setBlockType({ x: treasure.x, y: treasure.y, z: treasure.z }, "minecraft:lodestone");
  dimension.setBlockType({ x: treasure.x, y: treasure.y + 1, z: treasure.z }, "minecraft:lantern");

  return { start, pillar, altar, cage, treasure };
}

function ensureCourse(player: Player): Course {
  if (!course) {
    course = buildCourse(player.dimension);
  }
  return course;
}

function getState(player: Player): HuntState {
  const current = progress.get(player.id);
  if (current) {
    return current;
  }
  const created: HuntState = { stage: 0, busy: false };
  progress.set(player.id, created);
  return created;
}

function sendClue(player: Player, stage: HuntStage): void {
  player.sendMessage(`§eLodestone 寻宝§r · ${CLUES[stage]}`);
  player.sendMessage("§7聊天输入 §e!hunt§r 可再看一次线索。");
}

function askRiddle(player: Player, state: HuntState): void {
  state.busy = true;
  const form = new ModalFormData()
    .title("蓝色方台")
    .textField("磁石的英文 lodestone 有几个字母？", "写下数字");

  form.show(player).then((response) => {
    state.busy = false;
    if (response.canceled) {
      player.sendMessage("§7先想想再站回蓝色方台。");
      return;
    }
    const answer = String(response.formValues?.[0] ?? "").trim().toLowerCase();
    if (answer === "9" || answer === "九") {
      state.stage = 2;
      player.playSound("random.levelup");
      player.sendMessage("§a石台亮了一下。口令就是这个数字。");
      sendClue(player, 2);
      return;
    }
    player.playSound("note.bass");
    player.sendMessage("§c不对。数一数 l-o-d-e-s-t-o-n-e。");
  }).catch(() => {
    state.busy = false;
    player.sendMessage("§c题目打不开，站回蓝色方台再试。");
  });
}

function askPassword(player: Player, state: HuntState): void {
  state.busy = true;
  const form = new ModalFormData()
    .title("铁栏小室")
    .textField("说出口令", "上一个谜题的答案");

  form.show(player).then((response) => {
    state.busy = false;
    if (response.canceled) {
      return;
    }
    const answer = String(response.formValues?.[0] ?? "").trim().toLowerCase();
    if (answer === "9" || answer === "九") {
      state.stage = 3;
      player.playSound("random.levelup");
      player.sendMessage("§a铁栏轻轻震了一下。宝藏就在南边。");
      sendClue(player, 3);
      return;
    }
    player.playSound("note.bass");
    player.sendMessage("§c口令不对。回想蓝色方台上的问题。");
  }).catch(() => {
    state.busy = false;
  });
}

function finishHunt(player: Player, state: HuntState): void {
  state.stage = 4;
  player.runCommand("gamemode survival @s");
  player.runCommand("give @s lodestone 1");
  player.runCommand("give @s diamond 5");
  player.runCommand("give @s golden_apple 1");
  player.runCommand("title @s title §6寻获磁石");
  player.playSound("random.toast");
  player.sendMessage("§6你找到了失落的磁石。§r钻石和金苹果已放进背包。");
  sendClue(player, 4);
}

function tickHunt(): void {
  if (!course) {
    return;
  }
  for (const player of world.getAllPlayers()) {
    const state = progress.get(player.id);
    if (!state || state.busy || state.stage === 4) {
      continue;
    }
    if (state.stage === 0 && horizontalDistance(player, course.pillar) <= 3) {
      state.stage = 1;
      player.playSound("random.orb");
      player.sendMessage("§a石柱上的金字在发光。");
      sendClue(player, 1);
      continue;
    }
    if (state.stage === 1 && horizontalDistance(player, course.altar) <= 2.5) {
      askRiddle(player, state);
      continue;
    }
    if (state.stage === 2 && horizontalDistance(player, course.cage) <= 2.5) {
      askPassword(player, state);
      continue;
    }
    if (state.stage === 3 && horizontalDistance(player, course.treasure) <= 2.5) {
      finishHunt(player, state);
    }
  }
}

function startHunt(player: Player): void {
  const built = ensureCourse(player);
  const state = getState(player);
  state.stage = 0;
  state.busy = false;
  player.runCommand("gamemode adventure @s");
  player.teleport(asVector(built.start));
  player.sendMessage("§eLodestone 寻宝§r · 失落的磁石");
  player.sendMessage("§7很久以前有人把一枚磁石藏在这片地里，只留下几句暗号。");
  sendClue(player, 0);
}

export function isHunting(player: Player): boolean {
  const state = progress.get(player.id);
  return !!state && state.stage < 4;
}

export function remindHunt(player: Player): boolean {
  const state = progress.get(player.id);
  if (!state) {
    return false;
  }
  sendClue(player, state.stage);
  return true;
}

export function openHuntMenu(player: Player): void {
  const state = progress.get(player.id);
  const running = !!state && state.stage < 4;
  const form = new ActionFormData()
    .title("失落的磁石")
    .body("一局解谜寻宝。沿着线索走到路标，答对题目才能继续。\n不会改全服难度。")
    .button(running ? "重新开始" : "开始寻宝")
    .button("查看当前线索");

  if (running) {
    form.button("放弃寻宝");
  }

  form.show(player).then((response) => {
    if (response.canceled || response.selection === undefined) {
      return;
    }
    if (response.selection === 0) {
      startHunt(player);
      return;
    }
    if (response.selection === 1) {
      if (!remindHunt(player)) {
        player.sendMessage("§7还没开始。先点「开始寻宝」。");
      }
      return;
    }
    if (response.selection === 2 && state) {
      progress.delete(player.id);
      player.runCommand("gamemode survival @s");
      player.sendMessage("§e已退出寻宝。");
    }
  }).catch(() => {
    player.sendMessage("§c菜单打不开，输入 !menu 再试。");
  });
}

export function handleHuntChat(player: Player, message: string): boolean {
  const text = message.trim().toLowerCase();
  if (text !== "!hunt" && message.trim() !== "寻宝") {
    return false;
  }
  system.run(() => {
    if (!remindHunt(player)) {
      openHuntMenu(player);
    }
  });
  return true;
}

system.runInterval(() => {
  try {
    tickHunt();
  } catch {
    // 区块未加载时跳过这一拍
  }
}, 15);
