import type { WingCore } from "../../wing/WingCore";
import type { MuteTargetType } from "../behaviors/MuteBehavior";
import type { Target } from "./Target";

export class TargetFactory {
    constructor(private readonly wing: WingCore) {}

    resolve(targetType: MuteTargetType, targetIndex: number): Target {
        if (targetType === "main") {
            const main = this.wing.main(targetIndex);

            return {
                getMuted: () => main.getMuted(),
                setMuted: (muted) => main.setMuted(muted),
                toggleMuted: () => main.toggleMuted(),
                muteAddress: () => `/main/${targetIndex}/mute`
            };
        }

        const channel = this.wing.channel(targetIndex);

        return {
            getMuted: () => channel.getMuted(),
            setMuted: (muted) => channel.setMuted(muted),
            toggleMuted: () => channel.toggleMuted(),
            muteAddress: () => `/ch/${targetIndex}/mute`
        };
    }
}
