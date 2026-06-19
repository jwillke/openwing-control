const wingCoreModulePath = "../wing/WingCore.ts";
const wingOscConnectionModulePath = "../wing/WingOscConnection.ts";
const { WingCore } = (await import(wingCoreModulePath)) as typeof import("../wing/WingCore");
const { WingOscConnection } = (await import(wingOscConnectionModulePath)) as typeof import("../wing/WingOscConnection");

export {};

const remoteAddress = process.argv[2]?.trim() || process.env.WING_IP?.trim() || "192.168.178.86";
const remotePort = Number(process.argv[3] ?? process.env.WING_OSC_PORT ?? "2223");

const connection = new WingOscConnection({
    remoteAddress,
    remotePort
});

const wing = new WingCore(connection);
const channel = wing.channel(1);

console.log(`Connecting to WING at ${remoteAddress}:${remotePort}.`);

try {
    await connection.connect();

    const initialValue = await channel.getFader();
    console.log(`Initial /ch/1/fdr value: ${initialValue}`);

    await channel.setFader(initialValue);
    console.log(`Wrote the same /ch/1/fdr value back: ${initialValue}`);

    const confirmedValue = await channel.getFader();
    console.log(`Confirmed /ch/1/fdr value: ${confirmedValue}`);
} finally {
    await connection.disconnect();
}
