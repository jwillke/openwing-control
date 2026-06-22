import type { IWingConnection, OscResponse } from "../wing/IWingConnection";
import type { WingChannel } from "../wing/WingChannel";

type ChannelStateConnection = IWingConnection & {
    subscribe(address: string, listener: (message: OscResponse) => void | Promise<void>): () => void;
    subscribeRemote(address: string): Promise<void>;
};

type ChannelStateAddresses = {
    name: string;
    nameEvent: string;
    color: string;
    colorEvent: string;
    icon: string;
    iconEvent: string;
    mute: string;
    fader: string;
    clink: string;
};

type ChannelStateListener = (state: ChannelState) => void;

export class ChannelState {
    name = "";
    color: number | undefined;
    icon: number | undefined;
    muted = false;
    faderDb: number | undefined;
    normalized: number | undefined;
    linkedToSource: boolean | undefined;

    private channel: WingChannel | undefined;
    private addresses: ChannelStateAddresses | undefined;
    private readonly unsubscribers: Array<() => void> = [];
    private readonly listeners = new Set<ChannelStateListener>();

    constructor(private readonly connection: ChannelStateConnection) {}

    subscribe(listener: ChannelStateListener): () => void {
        this.listeners.add(listener);

        return () => {
            this.listeners.delete(listener);
        };
    }

    async attach(channel: WingChannel): Promise<void> {
        this.dispose();

        this.channel = channel;
        this.addresses = this.channelAddresses(channel);

        await this.readInitialState(channel, this.addresses);
        this.notifyListeners();
        this.subscribeToUpdates(this.addresses);
        await this.subscribeRemote(this.addresses);
    }

    dispose(): void {
        while (this.unsubscribers.length > 0) {
            this.unsubscribers.pop()?.();
        }

        this.channel = undefined;
        this.addresses = undefined;
    }

    private async readInitialState(channel: WingChannel, addresses: ChannelStateAddresses): Promise<void> {
        const [name, muted, faderDb, normalized, color, icon, linkedToSource] = await Promise.all([
            channel.getName(),
            channel.getMuted(),
            channel.getFader(),
            channel.getFaderNormalized(),
            this.readNumeric(addresses.color),
            this.readNumeric(addresses.icon),
            this.readBoolean(addresses.clink)
        ]);

        this.name = name;
        this.muted = muted;
        this.faderDb = faderDb;
        this.normalized = normalized;
        this.color = color;
        this.icon = icon;
        this.linkedToSource = linkedToSource;
    }

    private subscribeToUpdates(addresses: ChannelStateAddresses): void {
        this.unsubscribers.push(
            this.connection.subscribe(addresses.nameEvent, (message) => {
                const name = this.firstStringArg(message.args);

                if (name !== undefined) {
                    this.name = name;
                    this.notifyListeners();
                }
            })
        );

        this.unsubscribers.push(
            this.connection.subscribe(addresses.colorEvent, (message) => {
                const color = this.lastNumericArg(message.args);

                if (color !== undefined) {
                    this.color = color;
                    this.notifyListeners();
                }
            })
        );

        this.unsubscribers.push(
            this.connection.subscribe(addresses.iconEvent, (message) => {
                const icon = this.lastNumericArg(message.args);

                if (icon !== undefined) {
                    this.icon = icon;
                    this.notifyListeners();
                }
            })
        );

        this.unsubscribers.push(
            this.connection.subscribe(addresses.mute, (message) => {
                const muted = this.lastNumericArg(message.args);

                if (muted !== undefined) {
                    this.muted = muted !== 0;
                    this.notifyListeners();
                }
            })
        );

        this.unsubscribers.push(
            this.connection.subscribe(addresses.fader, (message) => {
                const faderDb = this.lastNumericArg(message.args);
                const normalized = this.numericArgAt(message.args, 1);

                if (faderDb !== undefined) {
                    this.faderDb = faderDb;
                }

                if (normalized !== undefined) {
                    this.normalized = normalized;
                }

                if (faderDb !== undefined || normalized !== undefined) {
                    this.notifyListeners();
                }
            })
        );

        this.unsubscribers.push(
            this.connection.subscribe(addresses.clink, (message) => {
                const linkedToSource = this.lastNumericArg(message.args);

                if (linkedToSource !== undefined) {
                    this.linkedToSource = linkedToSource !== 0;
                    this.notifyListeners();
                }
            })
        );
    }

    private async subscribeRemote(addresses: ChannelStateAddresses): Promise<void> {
        await this.connection.subscribeRemote(addresses.nameEvent);
        await this.connection.subscribeRemote(addresses.colorEvent);
        await this.connection.subscribeRemote(addresses.iconEvent);
        await this.connection.subscribeRemote(addresses.mute);
        await this.connection.subscribeRemote(addresses.fader);
        await this.connection.subscribeRemote(addresses.clink);
    }

    private channelAddresses(channel: WingChannel): ChannelStateAddresses {
        const name = channel.nameAddress();
        const channelPrefix = name.slice(0, name.lastIndexOf("/"));

        return {
            name,
            nameEvent: `${channelPrefix}/$name`,
            color: `${channelPrefix}/col`,
            colorEvent: `${channelPrefix}/$col`,
            icon: `${channelPrefix}/icon`,
            iconEvent: `${channelPrefix}/$icon`,
            mute: `${channelPrefix}/mute`,
            fader: channel.faderAddress(),
            clink: `${channelPrefix}/clink`
        };
    }

    private async readNumeric(address: string): Promise<number | undefined> {
        const response = await this.connection.request(address);

        return this.lastNumericArg(response.args);
    }

    private async readBoolean(address: string): Promise<boolean | undefined> {
        const value = await this.readNumeric(address);

        return value === undefined ? undefined : value !== 0;
    }

    private notifyListeners(): void {
        for (const listener of this.listeners) {
            listener(this);
        }
    }

    private firstStringArg(args: unknown[] | undefined): string | undefined {
        if (!args) {
            return undefined;
        }

        return args.find((arg): arg is string => typeof arg === "string" && arg.trim().length > 0);
    }

    private lastNumericArg(args: unknown[] | undefined): number | undefined {
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

    private numericArgAt(args: unknown[] | undefined, numericIndex: number): number | undefined {
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
}
