# @openwing/core API Design

`@openwing/core` should expose the Behringer WING as a mixer object model, not as OSC paths.

The public API should be readable, discoverable, and stable enough to support multiple frontends: Stream Deck plugins, desktop apps, web apps, tests, and simulator implementations.

## Design Philosophy

- Represent mixer concepts as objects and services.
- Hide OSC completely from public callers.
- Keep public APIs close to the language a mixer user already knows.
- Prefer explicit methods over stringly typed command paths.
- Keep APIs small, composable, and easy to mock.
- Allow different connection backends behind the same interfaces.
- Keep Stream Deck-specific code outside core mixer logic.

Core users should write code like this:

```ts
await wing.main(1).setMuted(true);
await wing.channel(12).setFaderDb(-6);
await wing.recorder("sd1").record();
```

They should not write code like this:

```ts
await connection.send("/main/1/mute", 1);
await connection.send("/ch/12/fdr", -6);
```

## Root API

```ts
const wing = new WingCore(connection);

wing.channel(1);
wing.main(1);
wing.bus(1);
wing.dca(1);
wing.muteGroup(1);
wing.scene(10);
wing.recorder("sd1");
```

`connection` is an implementation detail supplied by the host application. It may use OSC, a simulator, a local test fixture, or a future transport.

Internal collections may still exist to organize implementation details, cache objects, or support batch operations. The recommended public API should use direct methods such as `wing.channel(1)` and `wing.main(1)` because they are shorter, easier to discover, and closer to how users talk about the mixer.

## Channels

```ts
const channel = wing.channel(1);

await channel.getName();
await channel.setName("Vocal");

await channel.getMuted();
await channel.setMuted(true);
await channel.toggleMute();

await channel.getFaderDb();
await channel.setFaderDb(-5);

await channel.getPan();
await channel.setPan(0);
```

Collection helpers can make common workflows discoverable:

```ts
const vocalChannels = await wing.findChannelsByTag("vocals");
await wing.channels(1, 8).setMuted(false);
```

## Mains

```ts
const main = wing.main(1);

await main.getMuted();
await main.setMuted(false);

await main.getFaderDb();
await main.setFaderDb(0);

await main.getName();
await main.setName("Main LR");
```

The API should describe the mixer role, not the underlying path:

```ts
await wing.main(1).setMuted(true);
```

## Buses

```ts
const bus = wing.bus(1);

await bus.getMuted();
await bus.setMuted(true);

await bus.getFaderDb();
await bus.setFaderDb(-3);

await bus.sends.getChannelSend(12).setLevelDb(-10);
await bus.sends.getChannelSend(12).setEnabled(true);
```

## DCAs

```ts
const dca = wing.dca(1);

await dca.getName();
await dca.setName("Band");

await dca.getMuted();
await dca.setMuted(false);

await dca.getFaderDb();
await dca.setFaderDb(-2);
```

Assignments should be represented as mixer relationships:

```ts
await wing.dca(1).assignChannel(5);
await wing.dca(1).removeChannel(5);
```

## Mute Groups

```ts
const muteGroup = wing.muteGroup(1);

await muteGroup.getMuted();
await muteGroup.setMuted(true);
await muteGroup.toggle();
```

Assignments should stay readable:

```ts
await muteGroup.assignChannel(1);
await muteGroup.assignBus(3);
await muteGroup.clearAssignments();
```

## Recorder

```ts
const recorder = wing.recorder("sd1");

await recorder.getState();

await recorder.record();
await recorder.stop();
await recorder.play();
await recorder.pause();

await recorder.selectSession("2026-06-18-show");
```

Recorder state should use clear domain names:

```ts
type RecorderState = "idle" | "recording" | "playing" | "paused" | "busy" | "error";
```

## Scenes

```ts
await wing.listScenes();
await wing.currentScene();

await wing.scene(10).load();
await wing.scene(10).saveAs("show-start");
```

Scene operations should make destructive or broad mixer changes explicit:

```ts
await wing.scene(10).load({
    confirm: true
});
```

## Configurable Stream Deck Actions

Stream Deck actions should be thin configuration-driven adapters over the mixer domain API. A planned generic Mute action can replace hard-coded actions such as "Main 1 Mute" and "Channel 1 Mute" once the first fixed actions prove the workflow.

```ts
type MuteTargetType = "channel" | "main" | "bus" | "dca" | "muteGroup";
type MuteMode = "toggle" | "mute" | "unmute";

type MuteActionSettings = {
    targetType: MuteTargetType;
    targetIndex: number;
    mode: MuteMode;
    fadeBeforeMute?: {
        enabled: boolean;
        durationMs: number;
        targetFaderDb: number;
    };
};
```

The first implementation should focus on direct mute control:

```ts
{
    targetType: "channel",
    targetIndex: 1,
    mode: "toggle"
}
```

`fadeBeforeMute` is a later advanced feature, not part of the first configurable Mute action implementation. It exists in the settings shape to document the intended direction: optionally fade a target fader to a configured dB level over a configured duration before applying mute.

## Generic Command Action

The long-term goal is one configurable Stream Deck button for common mixer commands. Instead of creating a separate action class for each mixer operation, the action should describe:

```ts
type GenericCommandActionSettings = {
    targetType: string;
    targetIndex?: number;
    command: string;
    parameters?: Record<string, unknown>;
};
```

For target-oriented commands, `targetType` identifies the mixer object family, such as `channel`, `main`, `bus`, `dca`, or `muteGroup`. `targetIndex` selects the concrete target when that target type is indexed. `command` names the operation to perform. `parameters` carries command-specific values, such as a fader level, step size, scene number, or future options.

The initial supported commands should stay narrow:

```ts
type InitialGenericCommand =
    | "mute.toggle"
    | "mute.on"
    | "mute.off";
```

Future commands can grow from the same shape:

```ts
type FutureGenericCommand =
    | "solo.toggle"
    | "solo.on"
    | "solo.off"
    | "fader.set"
    | "fader.increase"
    | "fader.decrease"
    | "scene.load"
    | "recorder.record"
    | "recorder.stop";
```

This should grow incrementally. Each new command should be added only after the corresponding domain API exists, the Stream Deck settings model is clear, and title or feedback behavior is understood. Avoid implementing every command at once; a small command set with predictable behavior is more useful than a broad action surface with uneven semantics.

## Backends

The same API should work across implementations:

```ts
const liveWing = new WingCore(new WingOscConnection(options));
const simulatedWing = new WingCore(new SimulatedWingConnection());
```

This keeps application code portable:

```ts
await wing.main(1).setMuted(true);
```

The caller should not know whether that command went to a physical mixer, a simulator, a test double, or a future desktop/web bridge.
