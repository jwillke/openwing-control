import type { WingCore } from "../wing/WingCore";
import { ChannelState, type ChannelStateConnection } from "./ChannelState";

export type ChannelSummary = {
    index: number;
    name: string;
    color: number | undefined;
    icon: number | undefined;
    muted: boolean;
    faderDb: number | undefined;
};

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

    async getChannelSummary(index: number): Promise<ChannelSummary> {
        const channel = await this.getChannel(index);
        const name = channel.name.trim();

        return {
            index,
            name: name.length > 0 ? name : `CH ${index}`,
            color: channel.color,
            icon: channel.icon,
            muted: channel.muted,
            faderDb: channel.faderDb
        };
    }

    async getChannelSummaries(count: number): Promise<ChannelSummary[]> {
        const channelCount = Math.max(0, Math.floor(count));
        const indexes = Array.from({ length: channelCount }, (_, index) => index + 1);

        return await Promise.all(indexes.map((index) => this.getChannelSummary(index)));
    }

    private async createChannelState(index: number): Promise<ChannelState> {
        const channelState = new ChannelState(this.connection);

        await channelState.attach(this.wing.channel(index));

        return channelState;
    }
}
