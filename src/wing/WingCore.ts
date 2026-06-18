import type { IWingConnection } from "./IWingConnection";
import { WingMain } from "./WingMain";

export class WingCore {
    constructor(private readonly connection: IWingConnection) {}

    main(index: number): WingMain {
        return new WingMain(this.connection, index);
    }
}
