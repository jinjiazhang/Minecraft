import { CommandPermissionLevel, CustomCommandStatus, Player, system, world } from "@minecraft/server";
import { join, tick } from "./game";
import { requestMenu } from "./menu";
import { stationAt } from "./scenes";
import { interact } from "./game";

system.beforeEvents.startup.subscribe(event => {
  event.customCommandRegistry.registerCommand({ name: "lodestone:menu", description: "打开地心探险手册：提示、集合与参观", permissionLevel: CommandPermissionLevel.Any, cheatsRequired: false }, origin => {
    const p = origin.sourceEntity;
    if (!(p instanceof Player)) return { status: CustomCommandStatus.Failure, message: "请在游戏中打开手册。" };
    system.run(() => requestMenu(p)); return { status: CustomCommandStatus.Success };
  });
});
system.afterEvents.scriptEventReceive.subscribe(event => {
  if (event.id === "lodestone:menu" && event.sourceEntity instanceof Player) requestMenu(event.sourceEntity);
});
world.beforeEvents.playerInteractWithBlock.subscribe(event => {
  if (event.player.dimension.id !== "minecraft:overworld") return;
  const station = stationAt(event.block.location);
  if (!station) return;
  event.cancel = true;
  const p = event.player;
  system.run(() => { if (!p.isValid) return; if (station.id === "travel") requestMenu(p); else interact(p, station); });
});
world.afterEvents.playerSpawn.subscribe(event => {
  const p = event.player;
  system.runTimeout(() => { if (p.isValid) join(p); }, 40);
});
system.runInterval(tick, 20);
