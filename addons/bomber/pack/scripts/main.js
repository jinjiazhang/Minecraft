import { Direction, CommandPermissionLevel, CustomCommandStatus, Player, system, world } from "@minecraft/server";
import { bomberTick, initializeArena, joinBomber, leaveBomber, setRoundEndHandler, isBombItem, placeBombItem } from "./bomber";
import { requestMenu } from "./menu";
setRoundEndHandler(requestMenu);
system.beforeEvents.startup.subscribe(event => {
    event.customCommandRegistry.registerCommand({ name: "bomber:menu", description: "炸弹人规则与再来一局", permissionLevel: CommandPermissionLevel.Any, cheatsRequired: false }, origin => {
        const p = origin.sourceEntity;
        if (!(p instanceof Player))
            return { status: CustomCommandStatus.Failure };
        system.run(() => { if (p.isValid)
            requestMenu(p); });
        return { status: CustomCommandStatus.Success };
    });
});
world.afterEvents.worldLoad.subscribe(() => {
    initializeArena();
    for (const p of world.getAllPlayers())
        joinBomber(p);
});
world.afterEvents.playerSpawn.subscribe(({ player }) => {
    system.run(() => {
        if (!player.isValid)
            return;
        player.addEffect("resistance", 200, { amplifier: 4, showParticles: false });
        player.addEffect("slow_falling", 100, { showParticles: false });
        joinBomber(player);
    });
});
world.afterEvents.playerLeave.subscribe(e => leaveBomber(e.playerId));
world.beforeEvents.playerInteractWithBlock.subscribe(e => {
    e.cancel = true;
    if (!e.isFirstEvent || !isBombItem(e.itemStack))
        return;
    const offsets = {
        [Direction.Up]: { x: 0, y: 1, z: 0 }, [Direction.Down]: { x: 0, y: -1, z: 0 },
        [Direction.North]: { x: 0, y: 0, z: -1 }, [Direction.South]: { x: 0, y: 0, z: 1 },
        [Direction.East]: { x: 1, y: 0, z: 0 }, [Direction.West]: { x: -1, y: 0, z: 0 }
    };
    const d = offsets[e.blockFace], at = e.block.location, p = e.player, slot = p.selectedSlotIndex;
    const target = { x: at.x + d.x, y: at.y + d.y, z: at.z + d.z };
    system.run(() => placeBombItem(p, target, slot));
});
// Damage and crate removal are resolved only by the grid simulation.
// Also stop any primed TNT left by an older version from damaging the map.
world.beforeEvents.explosion.subscribe(e => { e.cancel = true; });
world.beforeEvents.playerBreakBlock.subscribe(e => { e.cancel = true; });
system.afterEvents.scriptEventReceive.subscribe(e => {
    if (e.id === "bomber:menu" && e.sourceEntity instanceof Player)
        requestMenu(e.sourceEntity);
});
system.runInterval(bomberTick, 1);
