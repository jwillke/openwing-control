import type { OscResponse } from "../wing/IWingConnection";

const wingCoreModulePath = "../wing/WingCore.ts";
const wingOscConnectionModulePath = "../wing/WingOscConnection.ts";
const { WingCore } = (await import(wingCoreModulePath)) as typeof import("../wing/WingCore");
const { WingOscConnection } = (await import(wingOscConnectionModulePath)) as typeof import("../wing/WingOscConnection");

type TargetType = "channel" | "main";
type AppearanceValueKey = "name" | "icon" | "color" | "fader" | "mute";

type ParsedArgs = {
    remoteAddress: string;
    targetType: TargetType;
    targetIndex: number;
};

type TargetInfo = {
    label: string;
    nameAddress: string;
    iconAddress: string;
    colorAddress: string;
    faderAddress: string;
    muteAddress: string;
    getName(): Promise<string>;
    getFader(): Promise<number>;
    getFaderNormalized(): Promise<number>;
    getMuted(): Promise<boolean>;
};

type InitialValues = {
    name: string;
    icon: string;
    color: string;
    fader: string;
    normalized: string;
    mute: string;
};

const watchMilliseconds = 30000;
const remotePort = Number(process.env.WING_OSC_PORT ?? "2223");
const args = parseArgs(process.argv.slice(2));
const connection = new WingOscConnection({
    remoteAddress: args.remoteAddress,
    remotePort
});
const wing = new WingCore(connection);
const target = targetInfo(args.targetType, args.targetIndex);
const latestValues = new Map<AppearanceValueKey, string>();

console.log(`Connecting to WING at ${args.remoteAddress}:${remotePort}.`);

try {
    await connection.connect();

    const initialValues = await readInitialValues();
    seedLatestValues(initialValues);
    printReport(initialValues);

    const unsubscribers = subscribeToChanges();

    await subscribeRemote();
    console.log(`Watching for changes (${watchMilliseconds / 1000} seconds)...`);
    await delay(watchMilliseconds);

    for (const unsubscribe of unsubscribers) {
        unsubscribe();
    }
} finally {
    await connection.disconnect();
}

function parseArgs(cliArgs: string[]): ParsedArgs {
    const firstArg = cliArgs[0]?.trim();

    if (isTargetType(firstArg)) {
        return {
            remoteAddress: process.env.WING_IP?.trim() || "192.168.178.86",
            targetType: firstArg,
            targetIndex: parseTargetIndex(cliArgs[1])
        };
    }

    return {
        remoteAddress: firstArg || process.env.WING_IP?.trim() || "192.168.178.86",
        targetType: isTargetType(cliArgs[1]) ? cliArgs[1] : "channel",
        targetIndex: parseTargetIndex(cliArgs[2])
    };
}

function isTargetType(value: unknown): value is TargetType {
    return value === "channel" || value === "main";
}

function parseTargetIndex(value: string | undefined): number {
    const index = Number.parseInt(value ?? "", 10);

    return Number.isInteger(index) && index > 0 ? index : 1;
}

function targetInfo(targetType: TargetType, index: number): TargetInfo {
    if (targetType === "main") {
        const main = wing.main(index);

        return {
            label: `Main ${index}`,
            nameAddress: main.nameAddress(),
            iconAddress: `/main/${index}/icon`,
            colorAddress: `/main/${index}/col`,
            faderAddress: main.faderAddress(),
            muteAddress: `/main/${index}/mute`,
            getName: () => main.getName(),
            getFader: () => main.getFader(),
            getFaderNormalized: () => main.getFaderNormalized(),
            getMuted: () => main.getMuted()
        };
    }

    const channel = wing.channel(index);

    return {
        label: `Channel ${index}`,
        nameAddress: channel.nameAddress(),
        iconAddress: `/ch/${index}/icon`,
        colorAddress: `/ch/${index}/col`,
        faderAddress: channel.faderAddress(),
        muteAddress: `/ch/${index}/mute`,
        getName: () => channel.getName(),
        getFader: () => channel.getFader(),
        getFaderNormalized: () => channel.getFaderNormalized(),
        getMuted: () => channel.getMuted()
    };
}

async function readInitialValues(): Promise<InitialValues> {
    const [name, icon, color, fader, normalized, mute] = await Promise.all([
        readStringValue("Name", target.nameAddress, target.getName),
        readNumericAddress("Icon", target.iconAddress),
        readNumericAddress("Color", target.colorAddress),
        readNumericValue("Fader", target.faderAddress, target.getFader),
        readNumericValue("Normalized", target.faderAddress, target.getFaderNormalized),
        readBooleanValue("Mute", target.muteAddress, target.getMuted)
    ]);

    return {
        name,
        icon,
        color,
        fader: formatFader(fader),
        normalized: formatNormalized(normalized),
        mute: `${mute}`
    };
}

async function readStringValue(label: string, address: string, read: () => Promise<string>): Promise<string> {
    try {
        return await read();
    } catch (error) {
        return errorValue(label, address, error);
    }
}

async function readNumericValue(label: string, address: string, read: () => Promise<number>): Promise<number | string> {
    try {
        return await read();
    } catch (error) {
        return errorValue(label, address, error);
    }
}

async function readBooleanValue(label: string, address: string, read: () => Promise<boolean>): Promise<boolean | string> {
    try {
        return await read();
    } catch (error) {
        return errorValue(label, address, error);
    }
}

async function readNumericAddress(label: string, address: string): Promise<string> {
    try {
        const response = await connection.request(address);
        const value = lastNumericArg(response.args);

        return value === undefined ? "missing" : `${value}`;
    } catch (error) {
        return errorValue(label, address, error);
    }
}

function errorValue(label: string, address: string, error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);

    return `ERR ${label} ${address}: ${message}`;
}

function seedLatestValues(values: InitialValues): void {
    latestValues.set("name", values.name);
    latestValues.set("icon", values.icon);
    latestValues.set("color", values.color);
    latestValues.set("fader", `${values.fader} / ${values.normalized}`);
    latestValues.set("mute", values.mute);
}

function printReport(values: InitialValues): void {
    console.log("");
    console.log("==================================================");
    console.log(`Target: ${target.label}`);
    console.log("==================================================");
    console.log("");
    console.log(reportRow("Name", values.name));
    console.log(reportRow("Color ID", values.color));
    console.log(reportRow("Icon ID", values.icon));
    console.log(reportRow("Mute", values.mute));
    console.log(reportRow("Fader", values.fader));
    console.log(reportRow("Normalized", values.normalized));
    console.log("");
    console.log("Addresses");
    console.log("");
    console.log(target.nameAddress);
    console.log(target.iconAddress);
    console.log(target.colorAddress);
    console.log(target.muteAddress);
    console.log(target.faderAddress);
    console.log("");
}

function reportRow(label: string, value: string): string {
    return `${label.padEnd(18, ".")} ${value}`;
}

function subscribeToChanges(): Array<() => void> {
    return [
        connection.subscribe(target.faderAddress, (message) => {
            printChange(target.faderAddress, "fader", parseFaderMessage(message));
        }),
        connection.subscribe(target.muteAddress, (message) => {
            printChange(target.muteAddress, "mute", parseMuteMessage(message));
        }),
        connection.subscribe(target.iconAddress, (message) => {
            printChange(target.iconAddress, "icon", parseNumericMessage(message));
        }),
        connection.subscribe(target.colorAddress, (message) => {
            printChange(target.colorAddress, "color", parseNumericMessage(message));
        }),
        connection.subscribe(target.nameAddress, (message) => {
            printChange(target.nameAddress, "name", parseNameMessage(message));
        })
    ];
}

async function subscribeRemote(): Promise<void> {
    await connection.subscribeRemote(target.faderAddress);
    await connection.subscribeRemote(target.muteAddress);
    await connection.subscribeRemote(target.iconAddress);
    await connection.subscribeRemote(target.colorAddress);
    await connection.subscribeRemote(target.nameAddress);
}

function printChange(address: string, key: AppearanceValueKey, nextValue: string | undefined): void {
    if (nextValue === undefined) {
        return;
    }

    const oldValue = latestValues.get(key);

    if (oldValue === nextValue) {
        return;
    }

    latestValues.set(key, nextValue);
    console.log("");
    console.log(`[${new Date().toISOString()}]`);
    console.log(address);
    console.log(`OLD VALUE ${oldValue ?? "unknown"}`);
    console.log(`NEW VALUE ${nextValue}`);
}

function parseNameMessage(message: OscResponse): string | undefined {
    return firstStringArg(message.args);
}

function parseNumericMessage(message: OscResponse): string | undefined {
    const value = lastNumericArg(message.args);

    return value === undefined ? undefined : `${value}`;
}

function parseMuteMessage(message: OscResponse): string | undefined {
    const value = lastNumericArg(message.args);

    return value === undefined ? undefined : `${value !== 0}`;
}

function parseFaderMessage(message: OscResponse): string | undefined {
    const fader = lastNumericArg(message.args);
    const normalized = numericArgAt(message.args, 1);

    if (fader === undefined && normalized === undefined) {
        return undefined;
    }

    return `${formatFader(fader ?? "missing")} / ${formatNormalized(normalized ?? "missing")}`;
}

function formatFader(value: number | string): string {
    if (typeof value !== "number") {
        return value;
    }

    if (value <= -144) {
        return "-oo dB";
    }

    return `${value.toFixed(1)} dB`;
}

function formatNormalized(value: number | string): string {
    return typeof value === "number" ? value.toFixed(3) : value;
}

function firstStringArg(args: unknown[] | undefined): string | undefined {
    if (!args) {
        return undefined;
    }

    return args.find((arg): arg is string => typeof arg === "string" && arg.trim().length > 0);
}

function lastNumericArg(args: unknown[] | undefined): number | undefined {
    if (!args) {
        return undefined;
    }

    for (let index = args.length - 1; index >= 0; index--) {
        const arg = args[index];

        if (typeof arg === "number") {
            return arg;
        }
    }

    return undefined;
}

function numericArgAt(args: unknown[] | undefined, numericIndex: number): number | undefined {
    if (!args) {
        return undefined;
    }

    let seenNumericArgs = 0;

    for (const arg of args) {
        if (typeof arg !== "number") {
            continue;
        }

        if (seenNumericArgs === numericIndex) {
            return arg;
        }

        seenNumericArgs++;
    }

    return undefined;
}

async function delay(milliseconds: number): Promise<void> {
    await new Promise((resolve) => {
        setTimeout(resolve, milliseconds);
    });
}
