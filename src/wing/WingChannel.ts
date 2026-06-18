import type { IWingConnection } from "./IWingConnection";

export class WingChannel {
    constructor(
        private readonly connection: IWingConnection,
        private readonly index: number
    ) {}

    async getMuted(): Promise<boolean> {
        const response = await this.connection.request(this.channelMuteAddress());
        const numericArg = this.lastNumericArg(response.args);

        if (numericArg === undefined) {
            throw new Error(`OSC response for ${this.channelMuteAddress()} did not include a numeric mute value.`);
        }

        return numericArg !== 0;
    }

    async setMuted(muted: boolean): Promise<void> {
        await this.connection.send(this.channelMuteAddress(), muted ? 1 : 0);
    }

    async toggleMuted(): Promise<boolean> {
        const muted = !(await this.getMuted());
        await this.setMuted(muted);
        return muted;
    }

    private channelMuteAddress(): string {
        return `/ch/${this.index}/mute`;
    }

    private lastNumericArg(args: unknown[] | undefined): number | undefined {
        if (!args) {
            return undefined;
        }

        for (let index = args.length - 1; index >= 0; index--) {
            const arg = args[index];

            if (typeof arg === "number") {
                return arg;
            }
        }

        return undefined;
    }
}
