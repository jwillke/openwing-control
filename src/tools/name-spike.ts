const wingOscConnectionModulePath = "../wing/WingOscConnection.ts";
const { WingOscConnection } = (await import(wingOscConnectionModulePath)) as typeof import("../wing/WingOscConnection");

export {};

const remoteAddress = process.argv[2]?.trim() || process.env.WING_IP?.trim() || "192.168.178.86";
const remotePort = Number(process.argv[3] ?? process.env.WING_OSC_PORT ?? "2223");

const connection = new WingOscConnection({
    remoteAddress,
    remotePort
});

const candidatePaths = [
    "/ch/1/name",
    "/ch/1/label",
    "/ch/1/icon",
    "/ch/1/col",
    "/ch/1/color",
    "/ch/1/config/name",
    "/ch/1/config/label",
    "/ch/1/config/icon",
    "/ch/1/config/color",
    "/src/1/name",
    "/src/1/label",
    "/src/1/icon",
    "/src/1/col",
    "/src/1/color",
    "/in/1/name",
    "/in/1/label",
    "/in/1/icon",
    "/in/1/col",
    "/in/1/color",
    "/input/1/name",
    "/input/1/label",
    "/input/1/icon",
    "/input/1/col",
    "/input/1/color",
    "/ch/1/src",
    "/ch/1/in",
    "/ch/1/input",
    "/ch/1/source",
    "/ch/1/conn",
    "/ch/1/patch",
    "/ch/1/cust",
    "/ch/1/custom",
    "/ch/1/source/name",
    "/ch/1/src/name",
    "/ch/1/in/name",
    "/ch/1/input/name",
    "/ch/1/source/1/name",
    "/ch/1/src/1/name",
    "/lcl/1/name",
    "/lcl/1/label",
    "/lcl/1/icon",
    "/lcl/1/col",
    "/local/1/name",
    "/local/1/label",
    "/local/1/icon",
    "/local/1/col",
    "/localin/1/name",
    "/localin/1/label",
    "/localin/1/icon",
    "/localin/1/col"
];

console.log(`Connecting to WING at ${remoteAddress}:${remotePort}.`);
console.log('Testing Channel 1 source assignment, source/input and local label candidates for visible label "DLX".');

try {
    await connection.connect();

    for (const address of candidatePaths) {
        console.log(`\nREQUEST ${address}`);

        try {
            const response = await connection.request(address);
            console.log("DECODED RESPONSE", response);
        } catch (error) {
            console.log("REQUEST FAILED", error instanceof Error ? error.message : String(error));
        }
    }
} finally {
    await connection.disconnect();
}
