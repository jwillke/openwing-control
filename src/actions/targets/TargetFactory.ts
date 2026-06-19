import type { WingCore } from "../../wing/WingCore";
import type { MuteTargetType } from "../behaviors/MuteBehavior";
import type { Target } from "./Target";

export class TargetFactory {
    constructor(private readonly wing: WingCore) {}

    resolve(targetType: MuteTargetType, targetIndex: number): Target {
        if (targetType === "main") {
            const main = this.wing.main(targetIndex);

            return {
                getName: () => main.getName(),
                getMuted: () => main.getMuted(),
                setMuted: (muted) => main.setMuted(muted),
                toggleMuted: () => main.toggleMuted(),
                nameAddress: () => main.nameAddress(),
                muteAddress: () => `/main/${targetIndex}/mute`
            };
        }

        const channel = this.wing.channel(targetIndex);

        return {
            getName: () => channel.getName(),
            getMuted: () => channel.getMuted(),
            setMuted: (muted) => channel.setMuted(muted),
            toggleMuted: () => channel.toggleMuted(),
            nameAddress: () => channel.nameAddress(),
            muteAddress: () => `/ch/${targetIndex}/mute`
        };
    }
}
