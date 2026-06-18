import { createRequire } from "node:module";

import type { IWingConnection, OscArgument, OscResponse } from "./IWingConnection";

export type { OscResponse } from "./IWingConnection";

type OscMessage = {
    address: string;
    args?: OscArgument[];
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

export type WingOscConnectionOptions = {
    remoteAddress: string;
    remotePort?: number;
    localAddress?: string;
    localPort?: number;
    onMessage?: (message: OscResponse) => void;
};

const require = createRequire(import.meta.url);
const OSC = require("osc") as OscModule;
const requestTimeoutMilliseconds = 2000;
const remoteSubscriptionKeepaliveMilliseconds = 5000;
const remoteSubscriptionAddress = "/*S";

type PendingRequest = {
    address: string;
    resolve(response: OscResponse): void;
    reject(error: Error): void;
    timeout: ReturnType<typeof setTimeout>;
};

type OscMessageListener = (message: OscResponse) => void | Promise<void>;

export class WingOscConnection implements IWingConnection {
    private readonly options: WingOscConnectionOptions;
    private readonly udpPort: OscUdpPort;
    private readonly pendingRequests: PendingRequest[] = [];
    private readonly messageListeners = new Map<string, Set<OscMessageListener>>();
    private readonly remoteSubscriptions = new Set<string>();
    private remoteSubscriptionKeepalive: ReturnType<typeof setInterval> | undefined;
    private connected = false;
    private connectPromise: Promise<void> | undefined;
    private rejectConnect: ((error: unknown) => void) | undefined;

    constructor(options: WingOscConnectionOptions) {
        this.options = options;
        this.udpPort = new OSC.UDPPort({
            localAddress: options.localAddress ?? "0.0.0.0",
            localPort: options.localPort ?? 0,
            remoteAddress: options.remoteAddress,
            remotePort: options.remotePort ?? 2223
        });

        this.udpPort.on("message", (message) => {
            this.log("received decoded packet", message);
            const response = message as OscResponse;
            this.resolvePendingRequest(response);
            this.notifyMessageListeners(response);
            this.options.onMessage?.(response);
        });

        this.udpPort.on("raw", (packet, ...details) => {
            this.log("received raw packet", details.length > 0 ? [packet, ...details] : packet);
        });

        this.udpPort.on("error", (error) => {
            this.log("error", error);
            this.rejectConnect?.(error);
            this.connectPromise = undefined;
            this.rejectConnect = undefined;
            this.rejectPendingRequests(new Error(`Wing OSC connection error: ${String(error)}`));
        });
    }

    async connect(): Promise<void> {
        if (this.connected) {
            return;
        }

        if (this.connectPromise) {
            await this.connectPromise;
            return;
        }

        this.connectPromise = new Promise<void>((resolve, reject) => {
            this.rejectConnect = reject;

            this.udpPort.on("ready", () => {
                this.connected = true;
                this.connectPromise = undefined;
                this.rejectConnect = undefined;
                this.startRemoteSubscriptionKeepalive();
                void this.renewRemoteSubscriptions();
                resolve();
            });

            this.udpPort.open();
        });

        await this.connectPromise;
    }

    async disconnect(): Promise<void> {
        if (!this.connected) {
            return;
        }

        this.udpPort.close();
        this.connected = false;
        this.connectPromise = undefined;
        this.stopRemoteSubscriptionKeepalive();
        this.rejectPendingRequests(new Error("Wing OSC connection was disconnected before a response was received."));
    }

    async send(address: string, ...args: OscArgument[]): Promise<void> {
        if (!this.connected) {
            throw new Error("Wing OSC connection is not connected.");
        }

        const message: OscMessage = {
            address
        };

        if (args.length > 0) {
            message.args = args;
        }

        this.log("sent packet", message);
        this.udpPort.send(message);
    }

    async request(address: string): Promise<OscResponse> {
        if (!this.connected) {
            throw new Error("Wing OSC connection is not connected.");
        }

        return await new Promise<OscResponse>((resolve, reject) => {
            const pendingRequest: PendingRequest = {
                address,
                resolve,
                reject,
                timeout: setTimeout(() => {
                    this.removePendingRequest(pendingRequest);
                    reject(new Error(`Timed out after ${requestTimeoutMilliseconds} ms waiting for OSC response from ${address}.`));
                }, requestTimeoutMilliseconds)
            };

            this.pendingRequests.push(pendingRequest);
            const message: OscMessage = { address };
            this.log("sent packet", message);

            try {
                this.udpPort.send(message);
            } catch (error) {
                this.removePendingRequest(pendingRequest);
                reject(error instanceof Error ? error : new Error(String(error)));
            }
        });
    }

    subscribe(address: string, listener: OscMessageListener): () => void {
        const listeners = this.messageListeners.get(address) ?? new Set<OscMessageListener>();

        listeners.add(listener);
        this.messageListeners.set(address, listeners);

        return () => {
            listeners.delete(listener);

            if (listeners.size === 0) {
                this.messageListeners.delete(address);
            }
        };
    }

    async subscribeRemote(address: string): Promise<void> {
        if (!this.connected) {
            throw new Error("Wing OSC connection is not connected.");
        }

        this.remoteSubscriptions.add(address);
        this.startRemoteSubscriptionKeepalive();
        await this.renewRemoteSubscription();
    }

    private resolvePendingRequest(response: OscResponse): void {
        const pendingRequest = this.pendingRequests.find((request) => request.address === response.address);

        if (!pendingRequest) {
            return;
        }

        this.removePendingRequest(pendingRequest);
        pendingRequest.resolve(response);
    }

    private notifyMessageListeners(response: OscResponse): void {
        if (!response.address) {
            return;
        }

        const listeners = this.messageListeners.get(response.address);

        if (!listeners) {
            return;
        }

        for (const listener of listeners) {
            Promise.resolve(listener(response)).catch((error: unknown) => {
                this.log("message listener error", error);
            });
        }
    }

    private async renewRemoteSubscriptions(): Promise<void> {
        if (this.remoteSubscriptions.size === 0) {
            return;
        }

        await this.renewRemoteSubscription();
    }

    private async renewRemoteSubscription(): Promise<void> {
        await this.send(remoteSubscriptionAddress);
    }

    private startRemoteSubscriptionKeepalive(): void {
        if (this.remoteSubscriptionKeepalive || this.remoteSubscriptions.size === 0) {
            return;
        }

        this.remoteSubscriptionKeepalive = setInterval(() => {
            void this.renewRemoteSubscriptions().catch((error: unknown) => {
                this.log("remote subscription keepalive error", error);
            });
        }, remoteSubscriptionKeepaliveMilliseconds);
    }

    private stopRemoteSubscriptionKeepalive(): void {
        if (!this.remoteSubscriptionKeepalive) {
            return;
        }

        clearInterval(this.remoteSubscriptionKeepalive);
        this.remoteSubscriptionKeepalive = undefined;
    }

    private removePendingRequest(pendingRequest: PendingRequest): void {
        const index = this.pendingRequests.indexOf(pendingRequest);

        if (index >= 0) {
            this.pendingRequests.splice(index, 1);
        }

        clearTimeout(pendingRequest.timeout);
    }

    private rejectPendingRequests(error: Error): void {
        const pendingRequests = [...this.pendingRequests];

        for (const pendingRequest of pendingRequests) {
            this.removePendingRequest(pendingRequest);
            pendingRequest.reject(error);
        }
    }

    private log(label: string, packet: unknown): void {
        console.log(`[${new Date().toISOString()}] ${label}`, packet);
    }
}
