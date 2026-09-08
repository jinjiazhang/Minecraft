import { CommandPermissionLevel, CustomCommandStatus, Player, system, world, } from "@minecraft/server";
import { onJoin } from "./game";
import { requestMenu } from "./menu";
function openFromChat(message, player, event) {
    if (message.trim().toLowerCase() !== "menu" || !(player instanceof Player)) {
        return;
    }
    event.cancel = true;
    system.run(() => requestMenu(player));
}
system.beforeEvents.startup.subscribe((event) => {
    event.customCommandRegistry.registerCommand({
        name: "lodestone:menu",
        description: "Open the candy port menu",
        permissionLevel: CommandPermissionLevel.Any,
        cheatsRequired: false,
    }, (origin) => {
        const player = origin.sourceEntity;
        if (!(player instanceof Player)) {
            return { status: CustomCommandStatus.Failure, message: "Only a player can open the menu." };
        }
        system.run(() => requestMenu(player));
        return { status: CustomCommandStatus.Success };
    });
});
const beforeChat = world.beforeEvents.chatSend;
beforeChat?.subscribe((event) => {
    openFromChat(event.message, event.sender ?? event.player, event);
});
system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id !== "lodestone:menu") {
        return;
    }
    const player = event.sourceEntity;
    if (player instanceof Player) {
        system.run(() => requestMenu(player));
    }
});
world.afterEvents.playerSpawn.subscribe((event) => {
    if (!event.initialSpawn) {
        return;
    }
    const player = event.player;
    system.runTimeout(() => {
        if (player.isValid) {
            onJoin(player);
        }
    }, 80);
});
