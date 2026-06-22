import { ChannelRepository } from "../state/ChannelRepository";
import { WingCore } from "./WingCore";
import { WingOscConnection } from "./WingOscConnection";

export const connection = new WingOscConnection({
    remoteAddress: process.env.WING_IP?.trim() || "192.168.178.86"
});

export const wing = new WingCore(connection);
export const channelRepository = new ChannelRepository(connection, wing);
