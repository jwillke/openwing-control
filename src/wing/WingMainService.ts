import type { IWingConnection } from "./IWingConnection";

export class WingMainService {
    constructor(private readonly connection: IWingConnection) {}

    async getMainMute(mainIndex: number): Promise<void> {
        await this.connection.send(this.mainMuteAddress(mainIndex));
    }

    async setMainMute(mainIndex: number, muted: boolean): Promise<void> {
        await this.connection.send(this.mainMuteAddress(mainIndex), muted ? 1 : 0);
    }

    private mainMuteAddress(mainIndex: number): string {
        return `/main/${mainIndex}/mute`;
    }
}
