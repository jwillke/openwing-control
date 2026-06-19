import type { Target } from "../targets/Target";

type LevelTarget = Target & {
    getFader(): Promise<number>;
    getFaderNormalized(): Promise<number>;
    setFader(value: number): Promise<void>;
};

export class LevelBehavior {
    constructor(private readonly target: LevelTarget) {}

    async getState(): Promise<number> {
        return await this.target.getFader();
    }

    async getNormalized(): Promise<number> {
        return await this.target.getFaderNormalized();
    }

    async setState(value: number): Promise<void> {
        await this.target.setFader(value);
    }
}
