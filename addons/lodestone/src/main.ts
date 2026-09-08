import { Player, system, world } from "@minecraft/server";
import { onJoin } from "./game";
import { requestMenu } from "./menu";

interface ChatLike {
  message: string;
  cancel?: boolean;
  sender?: Player;
  player?: Player;
}

interface ChatSignal {
  subscribe(cb: (event: ChatLike) => void): void;
}

function chatPlayer(event: ChatLike): Player | undefined {
  const who = event.sender ?? event.player;
  return who instanceof Player ? who : undefined;
}

function bindChat(signal: ChatSignal | undefined): void {
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

function registerMenuCommand(): void {
  const startup = system.beforeEvents.startup;
  startup.subscribe((event) => {
    const registry = (event as { customCommandRegistry?: { registerCommand(command: object, callback: (origin: { sourceEntity?: Player }) => object): void } }).customCommandRegistry;
    if (!registry) {
      return;
    }
    try {
      registry.registerCommand(
        {
          name: "lodestone:menu",
          description: "Open the candy port menu",
          permissionLevel: 0,
          cheatsRequired: false,
        },
        (origin) => {
          const player = origin.sourceEntity;
          if (player instanceof Player) {
            system.run(() => requestMenu(player));
          }
          return { status: 0 };
        },
      );
    } catch {
      // 当前引擎不支持自定义命令时，走聊天 menu
    }
  });
}

bindChat((world.beforeEvents as { chatSend?: ChatSignal }).chatSend);
bindChat((world.afterEvents as { chatSend?: ChatSignal }).chatSend);
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
