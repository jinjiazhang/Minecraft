import { Player, system, world } from "@minecraft/server";
import { onJoin } from "./game";
import { requestMenu } from "./menu";
function chatPlayer(event) {
    const who = event.sender ?? event.player;
    return who instanceof Player ? who : undefined;
}
function bindChat(signal) {
    signal?.subscribe((event) => {
        if (event.message.trim().toLowerCase() !== "menu") {
            return;
        }
        event.cancel = true;
        const player = chatPlayer(event);
        if (player) {
            system.run(() => requestMenu(player));
        }
    });
}
function registerMenuCommand() {
    const startup = system.beforeEvents.startup;
    startup.subscribe((event) => {
        const registry = event.customCommandRegistry;
        if (!registry) {
            return;
        }
        try {
            registry.registerCommand({
                name: "lodestone:menu",
                description: "Open the candy port menu",
                permissionLevel: 0,
                cheatsRequired: false,
            }, (origin) => {
                const player = origin.sourceEntity;
                if (player instanceof Player) {
                    system.run(() => requestMenu(player));
                }
                return { status: 0 };
            });
        }
        catch {
            // 当前引擎不支持自定义命令时，走聊天 menu
        }
    });
}
bindChat(world.beforeEvents.chatSend);
bindChat(world.afterEvents.chatSend);
registerMenuCommand();
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
