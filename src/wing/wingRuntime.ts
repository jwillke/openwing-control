import { WingCore } from "./WingCore";
import { WingOscConnection } from "./WingOscConnection";

export const connection = new WingOscConnection({
    remoteAddress: process.env.WING_IP?.trim() || "192.168.178.86"
});

export const wing = new WingCore(connection);
