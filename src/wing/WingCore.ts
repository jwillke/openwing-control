import type { IWingConnection } from "./IWingConnection";
import { WingChannel } from "./WingChannel";
import { WingMain } from "./WingMain";

export class WingCore {
    constructor(private readonly connection: IWingConnection) {}

    main(index: number): WingMain {
        return new WingMain(this.connection, index);
    }

    channel(index: number): WingChannel {
        return new WingChannel(this.connection, index);
    }
}
