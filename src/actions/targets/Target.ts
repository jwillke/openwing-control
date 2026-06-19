export interface Target {
    getName(): Promise<string>;
    getMuted(): Promise<boolean>;
    setMuted(muted: boolean): Promise<void>;
    toggleMuted(): Promise<boolean>;
    nameAddress(): string;
    muteAddress(): string;
}
