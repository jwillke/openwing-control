import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";

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
const remotePort = Number(process.env.WING_OSC_PORT ?? "2223");
const subscriptionAddress = "/*S";
const keepaliveMilliseconds = 5000;
const runMilliseconds = 60000;
const logDirectory = "logs";
const logFilePath = join(logDirectory, `osc-discovery-${timestampForFileName(new Date())}.log`);

await mkdir(logDirectory, { recursive: true });

const logFile = createWriteStream(logFilePath, { flags: "a" });
const udpPort = new OSC.UDPPort({
    localAddress: "0.0.0.0",
    localPort: 0,
    remoteAddress,
    remotePort
});

let keepalive: ReturnType<typeof setInterval> | undefined;

writeLine(`OSC discovery log: ${logFilePath}`);
writeLine(`Connecting to WING at ${remoteAddress}:${remotePort}.`);
writeLine(`Sending global OSC subscription command ${subscriptionAddress}.`);
writeLine(`Logging decoded OSC messages for ${runMilliseconds / 1000} seconds.`);

udpPort.on("ready", () => {
    sendSubscription();

    keepalive = setInterval(() => {
        sendSubscription();
    }, keepaliveMilliseconds);

    setTimeout(() => {
        if (keepalive) {
            clearInterval(keepalive);
        }

        writeLine("OSC discovery complete. Closing UDP socket.");
        udpPort.close();
        logFile.end();
    }, runMilliseconds);
});

udpPort.on("message", (message) => {
    const response = message as OscResponse;
    const timestamp = new Date().toISOString();
    const address = response.address ?? "(no address)";
    const args = JSON.stringify(response.args ?? []);

    writeLine(`[${timestamp}] ${address} ${args}`);
});

udpPort.on("error", (error) => {
    writeLine(`[${new Date().toISOString()}] ERROR ${error instanceof Error ? error.message : String(error)}`);
});

udpPort.open();

function sendSubscription(): void {
    const message: OscMessage = {
        address: subscriptionAddress
    };

    writeLine(`[${new Date().toISOString()}] SENT ${subscriptionAddress} []`);
    udpPort.send(message);
}

function writeLine(line: string): void {
    console.log(line);
    logFile.write(`${line}\n`);
}

function timestampForFileName(date: Date): string {
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());

    return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function pad(value: number): string {
    return value.toString().padStart(2, "0");
}
