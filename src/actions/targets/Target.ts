export interface Target {
    getMuted(): Promise<boolean>;
    setMuted(muted: boolean): Promise<void>;
    toggleMuted(): Promise<boolean>;
    muteAddress(): string;
}
