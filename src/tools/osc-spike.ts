import type { OscResponse } from "../wing/WingOscConnection";
import type { IWingConnection } from "../wing/IWingConnection";

const wingModulePath = "../wing/WingOscConnection.ts";
const { WingOscConnection } = (await import(wingModulePath)) as typeof import("../wing/WingOscConnection");

type Step = "initial-read" | "write-mute" | "confirm-read" | "done";

const remoteAddress = process.argv[2] ?? process.env.WING_IP ?? "127.0.0.1";
const remotePort = Number(process.argv[3] ?? process.env.WING_OSC_PORT ?? "2223");
const mainMuteAddress = "/main/1/mute";

let step: Step = "initial-read";

const wait = async (milliseconds: number): Promise<void> => {
    await new Promise<void>((resolve) => {
        setTimeout(resolve, milliseconds);
    });
};

const printDecodedResponse = (message: OscResponse): void => {
    console.log(`[${new Date().toISOString()}] decoded response`);
    console.log(JSON.stringify(message, null, 2));
};

const handleMainMuteResponse = async (connection: IWingConnection, message: OscResponse): Promise<void> => {
    if (message.address !== mainMuteAddress) {
        return;
    }

    printDecodedResponse(message);

    if (step === "initial-read") {
        step = "write-mute";
        await connection.send(mainMuteAddress, 1);
        await wait(1000);

        step = "confirm-read";
        await connection.send(mainMuteAddress);
        return;
    }

    if (step === "confirm-read") {
        step = "done";
    }
};

const connection = new WingOscConnection({
    remoteAddress,
    remotePort,
    onMessage: (message) => {
        void handleMainMuteResponse(connection, message);
    }
});

await connection.connect();
await connection.send(mainMuteAddress);
