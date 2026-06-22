import type { WingCore } from "../wing/WingCore";
import { ChannelState, type ChannelStateConnection } from "./ChannelState";

export class ChannelRepository {
    private readonly channels = new Map<number, Promise<ChannelState>>();

    constructor(
        private readonly connection: ChannelStateConnection,
        private readonly wing: WingCore
    ) {}

    async getChannel(index: number): Promise<ChannelState> {
        const existingChannel = this.channels.get(index);

        if (existingChannel) {
            return await existingChannel;
        }

        const channelState = this.createChannelState(index);
        this.channels.set(index, channelState);

        return await channelState;
    }

    private async createChannelState(index: number): Promise<ChannelState> {
        const channelState = new ChannelState(this.connection);

        await channelState.attach(this.wing.channel(index));

        return channelState;
    }
}
