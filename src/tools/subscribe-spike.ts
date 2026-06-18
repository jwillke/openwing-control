import { createRequire } from "node:module";

type OscArgument = string | number | boolean | null;

type OscMessage = {
    address: string;
    args?: OscArgument[];
};

type OscResponse = {
    address?: string;
    args?: unknown[];
};

type OscUdpPort = {
    open(): void;
    close(): void;
    send(message: OscMessage): void;
    on(event: "ready", listener: () => void): void;
    on(event: "message", listener: (message: unknown) => void): void;
    on(event: "raw", listener: (packet: unknown, ...details: unknown[]) => void): void;
    on(event: "error", listener: (error: unknown) => void): void;
};

type OscModule = {
    UDPPort: new (options: {
        localAddress: string;
        localPort: number;
        remoteAddress: string;
        remotePort: number;
    }) => OscUdpPort;
};

const require = createRequire(import.meta.url);
const OSC = require("osc") as OscModule;

const remoteAddress = process.argv[2]?.trim() || process.env.WING_IP?.trim() || "192.168.178.86";
const remotePort = 2223;
const subscriptionAddress = "/*S";
const observedAddress = "/main/1/mute";
const keepaliveMilliseconds = 5000;
const runMilliseconds = 35_000;

const udpPort = new OSC.UDPPort({
    localAddress: "0.0.0.0",
    localPort: 0,
    remoteAddress,
    remotePort
});

const log = (label: string, packet: unknown): void => {
    console.log(`[${new Date().toISOString()}] ${label}`, packet);
};

const sendSubscription = (): void => {
    const message: OscMessage = {
        address: subscriptionAddress
    };

    log("sent OSC packet", message);
    udpPort.send(message);
};

udpPort.on("ready", () => {
    console.log(`Connected UDP OSC socket for WING at ${remoteAddress}:${remotePort}.`);
    console.log(`Sending documented WING OSC event subscription command: ${subscriptionAddress}`);
    console.log(`Watching for decoded ${observedAddress} messages for ${runMilliseconds / 1000} seconds.`);
    console.log("Press Main 1 mute/unmute on the WING during this window.");
    console.log("");

    sendSubscription();

    const keepalive = setInterval(() => {
        sendSubscription();
    }, keepaliveMilliseconds);

    setTimeout(() => {
        clearInterval(keepalive);
        console.log("");
        console.log("Subscription spike complete. Closing UDP OSC socket.");
        udpPort.close();
    }, runMilliseconds);
});

udpPort.on("raw", (packet, ...details) => {
    log("received raw packet", details.length > 0 ? [packet, ...details] : packet);
});

udpPort.on("message", (message) => {
    const response = message as OscResponse;
    log("received decoded OSC message", response);

    if (response.address === observedAddress) {
        log("observed Main 1 mute update", response);
    }
});

udpPort.on("error", (error) => {
    log("OSC error", error);
});

udpPort.open();
