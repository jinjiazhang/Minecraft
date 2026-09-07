import { Player } from "@minecraft/server";

export interface Mode {
  id: string;
  title: string;
  summary: string;
  commands: string[];
}

export const MODES: Mode[] = [
  {
    id: "creative",
    title: "创造建造",
    summary: "无限方块，适合搭建筑。会把白天停住。",
    commands: [
      "gamemode creative @s",
      "gamerule keepInventory true",
      "gamerule doDaylightCycle false",
      "time set day",
    ],
  },
  {
    id: "survival",
    title: "普通生存",
    summary: "原版生存，死亡掉落，昼夜正常。",
    commands: [
      "gamemode survival @s",
      "difficulty normal",
      "gamerule keepInventory false",
      "gamerule doDaylightCycle true",
    ],
  },
  {
    id: "explore",
    title: "轻松探索",
    summary: "和平、死亡不掉落，适合到处看看。",
    commands: [
      "gamemode survival @s",
      "difficulty peaceful",
      "gamerule keepInventory true",
      "gamerule doDaylightCycle true",
    ],
  },
  {
    id: "hardcore",
    title: "高压生存",
    summary: "困难难度，死亡掉落。规则对全服生效。",
    commands: [
      "gamemode survival @s",
      "difficulty hard",
      "gamerule keepInventory false",
      "gamerule doDaylightCycle true",
    ],
  },
  {
    id: "adventure",
    title: "冒险",
    summary: "只能用工具互动，适合走地图。",
    commands: ["gamemode adventure @s"],
  },
];

export function applyMode(player: Player, mode: Mode): void {
  for (const command of mode.commands) {
    player.runCommand(command);
  }
  player.sendMessage(`§eLodestone§r · 已切换到 §a${mode.title}`);
  player.sendMessage(`§7${mode.summary}`);
}
