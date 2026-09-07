import { Player } from "@minecraft/server";
import { Course, Site } from "./park";

export type TokenId = "notes" | "maze" | "mirror" | "keys" | "cart";

export interface HuntState {
  tokens: TokenId[];
  cooldown: number;
  noteStep: number;
  mirrorStep: number;
  hasRed: boolean;
  hasBlue: boolean;
  hasYellow: boolean;
  openedRed: boolean;
  openedBlue: boolean;
  openedYellow: boolean;
}

export const TOKEN_ITEM: Record<TokenId, string> = {
  notes: "amethyst_shard",
  maze: "slime_ball",
  mirror: "glass",
  keys: "gold_nugget",
  cart: "cookie",
};

export const TOKEN_NAME: Record<TokenId, string> = {
  notes: "彩虹音符",
  maze: "果冻软糖",
  mirror: "镜子碎片",
  keys: "糖心钥匙",
  cart: "巧克力饼干",
};

export const ALL_TOKENS: TokenId[] = ["notes", "maze", "mirror", "keys", "cart"];

export const sessions = new Map<string, HuntState>();
export let course: Course | undefined;

export function setCourse(next: Course): Course {
  course = next;
  return next;
}

export function createState(): HuntState {
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

export function sessionOf(player: Player): HuntState {
  const current = sessions.get(player.id);
  if (current) {
    return current;
  }
  const created = createState();
  sessions.set(player.id, created);
  return created;
}

export function hasToken(state: HuntState, id: TokenId): boolean {
  return state.tokens.includes(id);
}

export function missingTokens(state: HuntState): string[] {
  return ALL_TOKENS.filter((id) => !hasToken(state, id)).map((id) => TOKEN_NAME[id]);
}

export function plateIndex(player: Player, plates: Site[]): number {
  const x = Math.floor(player.location.x);
  const z = Math.floor(player.location.z);
  return plates.findIndex((plate) => plate.x === x && plate.z === z);
}

export function grantToken(player: Player, state: HuntState, id: TokenId): void {
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
