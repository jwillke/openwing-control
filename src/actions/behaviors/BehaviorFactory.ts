import type { WingCore } from "../../wing/WingCore";
import { TargetFactory } from "../targets/TargetFactory";
import { MuteBehavior, MuteMode, MuteTargetType } from "./MuteBehavior";

export interface Behavior<TState> {
    execute(): Promise<void>;
    getState(): Promise<TState>;
}

export type ConfigurableMuteBehaviorSettings = {
    targetType: MuteTargetType;
    targetIndex: number;
    mode: MuteMode;
};

export class BehaviorFactory {
    private readonly targetFactory: TargetFactory;

    constructor(wing: WingCore) {
        this.targetFactory = new TargetFactory(wing);
    }

    create(settings: ConfigurableMuteBehaviorSettings): Behavior<boolean> {
        const target = this.targetFactory.resolve(settings.targetType, settings.targetIndex);
        return new MuteBehavior(target, settings.mode);
    }
}
