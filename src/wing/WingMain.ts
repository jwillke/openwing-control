import type { IWingConnection } from "./IWingConnection";

export class WingMain {
    constructor(
        private readonly connection: IWingConnection,
        private readonly index: number
    ) {}

    async getMuted(): Promise<boolean> {
        const response = await this.connection.request(this.mainMuteAddress());
        const numericArg = this.lastNumericArg(response.args);

        if (numericArg === undefined) {
            throw new Error(`OSC response for ${this.mainMuteAddress()} did not include a numeric mute value.`);
        }

        return numericArg !== 0;
    }

    async setMuted(muted: boolean): Promise<void> {
        await this.connection.send(this.mainMuteAddress(), muted ? 1 : 0);
    }

    async toggleMuted(): Promise<boolean> {
        const muted = !(await this.getMuted());
        await this.setMuted(muted);
        return muted;
    }

    async getFader(): Promise<number> {
        const response = await this.connection.request(this.faderAddress());
        const numericArg = this.lastNumericArg(response.args);

        if (numericArg === undefined) {
            throw new Error(`OSC response for ${this.faderAddress()} did not include a numeric fader value.`);
        }

        return numericArg;
    }

    async getFaderNormalized(): Promise<number> {
        const response = await this.connection.request(this.faderAddress());
        const numericArg = this.numericArgAt(response.args, 1);

        if (numericArg === undefined) {
            throw new Error(`OSC response for ${this.faderAddress()} did not include a normalized fader value.`);
        }

        return numericArg;
    }

    async setFader(value: number): Promise<void> {
        await this.connection.send(this.faderAddress(), value);
    }

    async getName(): Promise<string> {
        const response = await this.connection.request(this.nameAddress());
        const name = this.firstStringArg(response.args);

        return name ?? `MAIN ${this.index}`;
    }

    faderAddress(): string {
        return `/main/${this.index}/fdr`;
    }

    nameAddress(): string {
        return `/main/${this.index}/name`;
    }

    private mainMuteAddress(): string {
        return `/main/${this.index}/mute`;
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

    private numericArgAt(args: unknown[] | undefined, numericIndex: number): number | undefined {
        if (!args) {
            return undefined;
        }

        let seenNumericArgs = 0;

        for (const arg of args) {
            if (typeof arg !== "number") {
                continue;
            }

            if (seenNumericArgs === numericIndex) {
                return arg;
            }

            seenNumericArgs++;
        }

        return undefined;
    }

    private firstStringArg(args: unknown[] | undefined): string | undefined {
        if (!args) {
            return undefined;
        }

        return args.find((arg): arg is string => typeof arg === "string" && arg.trim().length > 0);
    }
}
