export type OscArgument = string | number | boolean | null;

export type OscResponse = {
    address?: string;
    args?: unknown[];
};

export interface IWingConnection {
    connect(): Promise<void>;
    disconnect(): Promise<void>;

    send(address: string, ...args: OscArgument[]): Promise<void>;
    request(address: string): Promise<OscResponse>;
}
