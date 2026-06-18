type LogLevel = "info" | "warn" | "error" | "debug";

export class Logger {
    private static instance: Logger | undefined;

    private debugEnabled = false;

    private constructor() {}

    static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }

        return Logger.instance;
    }

    setDebugEnabled(enabled: boolean): void {
        this.debugEnabled = enabled;
    }

    isDebugEnabled(): boolean {
        return this.debugEnabled;
    }

    info(message: unknown, ...details: unknown[]): void {
        this.write("info", message, details);
    }

    warn(message: unknown, ...details: unknown[]): void {
        this.write("warn", message, details);
    }

    error(message: unknown, ...details: unknown[]): void {
        this.write("error", message, details);
    }

    debug(message: unknown, ...details: unknown[]): void {
        if (!this.debugEnabled) {
            return;
        }

        this.write("debug", message, details);
    }

    private write(level: LogLevel, message: unknown, details: unknown[]): void {
        const prefixedMessage = `[${new Date().toISOString()}] ${String(message)}`;

        console[level](prefixedMessage, ...details);
    }
}

