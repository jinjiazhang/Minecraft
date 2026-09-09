import { explosionEffects } from "./bomber-effects";
import { GameMode, ItemStack, Player, system, Vector3, world } from "@minecraft/server";
import { BomberMatch, HEIGHT, key, ROUND, WIDTH } from "./bomber-model";

export const BOMB_NAME = "§c炸弹 §7· 5 秒引信";
export function isBombItem(item?: ItemStack): boolean { return item?.typeId === "minecraft:tnt" && item.nameTag === BOMB_NAME; }
const BASE = { x: 10200, y: 80, z: 10000 };
interface Seat { player: Player; sneaking: boolean; last: Vector3 }
const waiting = new Map<string, Player>();
const WAIT = { x: BASE.x + 29.5, y: BASE.y + 1, z: BASE.z + 3.5 };
const seats = new Map<string, Seat>();
let match: BomberMatch | undefined;
let preparing = false, built = false, startAt = 0;
const votes = new Set<string>();
let onRoundEnd: (p: Player) => void = () => {};
export function setRoundEndHandler(handler: (p: Player) => void): void { onRoundEnd = handler; }
const painted = new Map<string, string>();
const dim = () => world.getDimension("overworld");
const point = (x: number, z: number): Vector3 => ({ x: BASE.x + x * 2 + 1, y: BASE.y + 1, z: BASE.z + z * 2 + 1 });
const cell = (p: Vector3) => ({ x: Math.floor((p.x - BASE.x) / 2), z: Math.floor((p.z - BASE.z) / 2) });
const say = (s: string) => { for (const { player } of seats.values()) if (player.isValid) player.sendMessage(`§6[炸弹人]§r ${s}`); };
export function inBomber(p: Player): boolean { return seats.has(p.id); }
export function bomberStatus(): string {
  return `${seats.size}/2 人 · ${preparing ? "建造中" : match?.ended ? "本局结束" : match ? "对战中" : "等待伙伴"}\n选中快捷栏炸弹，点击地面放置，5 秒后十字爆炸。\n金色地板：火力 +1；绿色地板：炸弹上限 +1。\n碰到火焰即出局，自己放的炸弹也会伤到自己。`;
}
function fill(x: number, y: number, z: number, xx: number, yy: number, zz: number, block: string): void {
  dim().runCommand(`fill ${BASE.x+x} ${BASE.y+y} ${BASE.z+z} ${BASE.x+xx} ${BASE.y+yy} ${BASE.z+zz} minecraft:${block}`);
}
function lobby(s: Seat, index: number): void {
  const pos = point(index ? WIDTH - 2 : 1, index ? HEIGHT - 2 : 1);
  s.player.teleport(pos, { dimension: dim(), facingLocation: point(6, 5), keepVelocity: false }); s.last = pos;
}
function render(): void {
  if (!match) return;
  for (let x = 0; x < WIDTH; x++) for (let z = 0; z < HEIGHT; z++) {
    const k = key({ x, z });
    const solid = match.walls.has(k) ? "polished_deepslate" : match.crates.has(k) ? "oak_planks" : "air";
    const floor = match.flames.has(k) ? "orange_concrete" : match.bombs.has(k) ? "red_concrete" : match.gifts.get(k) === "range" ? "gold_block" : match.gifts.get(k) === "capacity" ? "emerald_block" : (x+z)%2 ? "light_blue_concrete" : "white_concrete";
    const bomb = match.bombs.has(k);
    const signature = `${solid}:${floor}:${bomb}`;
    if (painted.get(k) === signature) continue;
    fill(x*2, 0, z*2, x*2+1, 0, z*2+1, floor);
    fill(x*2, 1, z*2, x*2+1, 2, z*2+1, solid);
    // Inventory TNT is only a controller; never place native TNT in the arena.
    if (bomb) fill(x*2, 1, z*2, x*2, 1, z*2, "red_concrete");
    painted.set(k, signature);
  }
}
function begin(): void {
  if (!built || preparing || seats.size !== 2) return;
  match = new BomberMatch([...seats.keys()]); votes.clear(); render();
  let i = 0; for (const s of seats.values()) { lobby(s, i++); s.sneaking = s.player.isSneaking; giveBombs(s.player); }
  startAt = system.currentTick + 60;
  say("§e准备！3 秒后开局。红色地板是炸弹，可以离开，但不能再走回去。橙色地板是危险火焰！");
}
export function joinBomber(p: Player): void {
  if (seats.has(p.id)) {
    const seat = seats.get(p.id)!; seat.player = p;
    p.teleport(seat.last, { dimension: dim(), keepVelocity: false });
    return;
  }
  if (seats.size >= 2) {
    if (!waiting.has(p.id)) p.sendMessage("§e竞技场已满，已进入等候区；有空位后自动加入。");
    waiting.set(p.id, p); p.setGameMode(GameMode.Adventure);
    if (built) p.teleport(WAIT, { dimension: dim(), keepVelocity: false });
    return;
  }
  waiting.delete(p.id);
  seats.set(p.id, { player: p, sneaking: p.isSneaking, last: p.location });
  p.setGameMode(GameMode.Adventure);
  p.sendMessage("§6欢迎来到炸弹人！§r已自动加入，伙伴上线后自动开局。选中 TNT 点击地面放弹，/menu 查看规则或再来一局。");
  if (built) { lobby(seats.get(p.id)!, seats.size - 1); begin(); return; }
  initializeArena();
}
export function initializeArena(): void {
  if (built || preparing) return;
  preparing = true;
  try {
    for (const command of ["difficulty peaceful", "gamerule pvp false", "gamerule keepinventory true", "gamerule doMobSpawning false", "gamerule doFireTick false", "gamerule mobGriefing false", "gamerule doDaylightCycle false", "gamerule doWeatherCycle false", "time set day", "weather clear"]) dim().runCommand(command);
    try { dim().runCommand("tickingarea remove earth_adventure"); } catch { /* previous game not installed */ }
    try { dim().runCommand("tickingarea remove bomber_arena"); } catch { /* first load */ }
    dim().runCommand(`tickingarea add ${BASE.x} 80 ${BASE.z} ${BASE.x+31} 80 ${BASE.z+31} bomber_arena true`);
  } catch (e) { fail(e); return; }
  system.runTimeout(() => {
    try {
      fill(0, 0, 0, WIDTH*2-1, 4, HEIGHT*2-1, "air");
      fill(0, 3, 0, WIDTH*2-1, 3, HEIGHT*2-1, "glass");
      fill(28, 0, 0, 31, 4, 7, "glass");
      fill(29, 1, 1, 30, 3, 6, "air");
      fill(28, 0, 0, 31, 0, 7, "sea_lantern");
      world.setDefaultSpawnLocation(WAIT);
      for (const p of waiting.values()) if (p.isValid) p.teleport(WAIT, { dimension: dim(), keepVelocity: false });
      // Prepare geometry before anyone enters; no real TNT or fire is spawned.
      match = new BomberMatch(["preview-a", "preview-b"]); painted.clear(); render(); match = undefined;
      built = true; preparing = false;
      let i = 0; for (const s of seats.values()) if (s.player.isValid) lobby(s, i++);
      begin();
    } catch (e) { fail(e); }
  }, 80);
}
function fail(e: unknown): void {
  console.error(`BOMBER ${e}`); say("§c竞技场准备失败，稍后自动重试。");
  preparing = false; built = false; match = undefined; painted.clear();
  for (const [id, s] of seats) if (s.player.isValid) waiting.set(id, s.player);
  seats.clear(); votes.clear();
}
export function leaveBomber(id: string): void {
  waiting.delete(id);
  const s = seats.get(id); if (!s) return;
  seats.delete(id); votes.delete(id);
  if (match && !match.ended) say("伙伴离开，本局取消。等另一位玩家加入后重新开局。");
  match = undefined; votes.clear();
  if (built) for (const remaining of seats.values()) if (remaining.player.isValid) lobby(remaining, 0);
}
export function rematch(p: Player): void {
  if (!seats.has(p.id) || !match?.ended) return;
  votes.add(p.id); say(`${p.name} 已准备再来一局（${votes.size}/2）。`);
  if (votes.size === 2) begin();
}
export function bomberTick(): void {
  try {
    if (!built && !preparing && system.currentTick % 100 === 0) initializeArena();
    if (built) for (const [id, p] of waiting) {
      if (!p.isValid) { waiting.delete(id); continue; }
      if (seats.size < 2) joinBomber(p);
      else {
        p.teleport(WAIT, { dimension: dim(), keepVelocity: false });
        if (system.currentTick % 20 === 0) p.onScreenDisplay.setActionBar("§e竞技场已满 · 等待空位后自动加入");
      }
    }
    for (const [id, s] of seats) if (!s.player.isValid) leaveBomber(id);
    if (!seats.size) return;
    for (const s of seats.values()) {
      const p = s.player;
      if (system.currentTick % 20 === 0) {
        p.addEffect("resistance", 60, { amplifier: 4, showParticles: false });
        p.addEffect("saturation", 60, { showParticles: false });
      }
      if (preparing) { p.onScreenDisplay.setActionBar("§e正在准备炸弹人竞技场…"); continue; }
      const fighter = match?.players.find(f => f.id === p.id);
      const locked = !match || match.ended || system.currentTick < startAt;
      if (locked) { p.teleport(s.last, { dimension: dim(), keepVelocity: false }); }
      else if (fighter) {
        const loc = p.location;
        if (p.dimension.id !== dim().id || loc.y < BASE.y+1 || loc.y > BASE.y+1.5 || !match!.move(p.id, cell(loc))) p.teleport(s.last, { dimension: dim(), keepVelocity: false });
        else s.last = loc;

      }
      s.sneaking = p.isSneaking;
      if (system.currentTick % 10 === 0) p.onScreenDisplay.setActionBar(
        !match ? "§e等待伙伴上线 · 两人到齐自动开局" : match.ended ? "§6本局结束 · /menu → 再来一局" : system.currentTick < startAt ? `§e${Math.ceil((startAt-system.currentTick)/20)} 秒后开始` : `§b炸弹 ${[...match.bombs.values()].filter(b=>b.owner===p.id).length}/${fighter!.capacity} §e火力 ${fighter!.range} §f剩余 ${Math.ceil((ROUND-match.time)/20)} 秒 §7| 选中 TNT 放置 · 5秒引信`
      );
    }
    if (!match || match.ended || system.currentTick < startAt) return;
    const before = [...match.bombs.values()];
    match.step(); render();
    explosionEffects(dim(), BASE, match, before);
    if (match.bombs.size < before.length) for (const s of seats.values()) s.player.playSound("random.explode", { volume: .5 });
    if (match.ended) {
      const winner = match.winner ? seats.get(match.winner)?.player.name : undefined;
      const result = winner ? `${winner} 获胜！` : "平局！";
      say(`§6${result}§r 稍后自动弹出菜单，两人点击「重新开始」即可重开。`);
      const finished = match;
      system.runTimeout(() => {
        if (match !== finished || !match?.ended) return;
        for (const s of seats.values()) if (s.player.isValid) onRoundEnd(s.player);
      }, 20);
      for (const s of seats.values()) s.player.onScreenDisplay.setTitle(`§6${result}`, { subtitle: "即将打开重新开始菜单", stayDuration: 100, fadeInDuration: 5, fadeOutDuration: 20 });
    }
  } catch (e) { fail(e); }
}

// Four full stacks per round; preserve unrelated items and use available slots.
export function giveBombs(p: Player): void {
  const container = p.getComponent("minecraft:inventory")?.container;
  if (!container) return;
  let stacks = 0, selected = -1;
  for (let i = 0; i < container.size && stacks < 4; i++) {
    const old = container.getItem(i);
    if (old && !isBombItem(old)) continue;
    const item = new ItemStack("minecraft:tnt", 64); item.nameTag = BOMB_NAME;
    item.setCanPlaceOn(["minecraft:white_concrete", "minecraft:light_blue_concrete", "minecraft:red_concrete", "minecraft:orange_concrete", "minecraft:gold_block", "minecraft:emerald_block", "minecraft:polished_deepslate", "minecraft:oak_planks"]);
    item.setLore(["放置后 5 秒爆炸", "十字爆炸 · 可连锁引爆", "同时放置数量受炸弹容量限制"]);
    container.setItem(i, item); stacks++;
    if (i < 9 && selected < 0) selected = i;
  }
  if (selected >= 0) p.selectedSlotIndex = selected;
  p.sendMessage(stacks ? `§e本局已补给 ${stacks * 64} 颗炸弹，选中 TNT 点击地面放置。` : "§e背包已满，请空出格子，然后从 /menu 补领炸弹。");
}
export function placeBombItem(p: Player, location: Vector3, slot: number): boolean {
  if (!p.isValid || !match || match.ended || system.currentTick < startAt || p.dimension.id !== dim().id || location.y !== BASE.y+1) return false;
  const container = p.getComponent("minecraft:inventory")?.container;
  const item = container?.getItem(slot);
  if (!container || !isBombItem(item) || !item) return false;
  if (!match.place(p.id, cell(location))) { p.onScreenDisplay.setActionBar("§e这里不能放置，或同时放置的炸弹已达上限"); return false; }
  if (item.amount > 1) { item.amount--; container.setItem(slot, item); }
  else container.setItem(slot, undefined);
  render(); p.playSound("random.click"); return true;
}
