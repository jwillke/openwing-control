import type { Behavior } from "./BehaviorFactory";
import { TargetFactory } from "../targets/TargetFactory";
import type { Target } from "../targets/Target";
import type { WingCore } from "../../wing/WingCore";

export type MuteTargetType = "channel" | "main";
export type MuteMode = "toggle" | "mute" | "unmute";

export class MuteBehavior implements Behavior<boolean> {
    private readonly target: Target;
    private readonly mode: MuteMode;

    constructor(target: Target, mode: MuteMode);
    constructor(wing: WingCore, targetType: MuteTargetType, targetIndex: number, mode: MuteMode);
    constructor(targetOrWing: Target | WingCore, modeOrTargetType: MuteMode | MuteTargetType, targetIndex?: number, mode?: MuteMode) {
        if (this.isTarget(targetOrWing)) {
            this.target = targetOrWing;
            this.mode = modeOrTargetType as MuteMode;
            return;
        }

        this.target = new TargetFactory(targetOrWing).resolve(modeOrTargetType as MuteTargetType, targetIndex ?? 1);
        this.mode = mode ?? "toggle";
    }

    async execute(): Promise<void> {
        if (this.mode === "toggle") {
            await this.target.toggleMuted();
            return;
        }

        await this.target.setMuted(this.mode === "mute");
    }

    async getState(): Promise<boolean> {
        return await this.target.getMuted();
    }

    muteAddress(): string {
        return this.target.muteAddress();
    }

    private isTarget(value: Target | WingCore): value is Target {
        return "muteAddress" in value;
    }
}
