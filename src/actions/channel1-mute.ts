import { action, KeyDownEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";

import type { OscResponse } from "../wing/IWingConnection";
import { connection, wing } from "../wing/wingRuntime";

const channel = wing.channel(1);
const channelMuteAddress = "/ch/1/mute";

type TitleAction = {
	setTitle(title: string): Promise<void>;
};

@action({ UUID: "com.jrg-willke.openwing-control.channel1-mute" })
export class Channel1Mute extends SingletonAction {
	private readonly visibleActions = new Map<string, TitleAction>();

	constructor() {
		super();

		connection.subscribe(channelMuteAddress, async (message) => {
			await this.updateTitlesFromMessage(message);
		});
	}

	override async onWillAppear(ev: WillAppearEvent): Promise<void> {
		this.visibleActions.set(ev.action.id, ev.action);

		try {
			await this.connectAndSubscribe();
			await this.refreshTitle(ev.action);
		} catch {
			await ev.action.setTitle("ERR");
		}
	}

	override onWillDisappear(ev: WillDisappearEvent): void {
		this.visibleActions.delete(ev.action.id);
	}

	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		try {
			await this.connectAndSubscribe();
			await channel.toggleMuted();
			await this.refreshTitle(ev.action);
		} catch {
			await ev.action.setTitle("ERR");
		}
	}

	private async connectAndSubscribe(): Promise<void> {
		await connection.connect();
		await connection.subscribeRemote(channelMuteAddress);
	}

	private async refreshTitle(action: TitleAction): Promise<void> {
		const muted = await channel.getMuted();
		await action.setTitle(muted ? "MUTED" : "LIVE");
	}

	private async updateTitlesFromMessage(message: OscResponse): Promise<void> {
		const muted = this.mutedFromMessage(message);
		const title = muted ? "MUTED" : "LIVE";

		await Promise.all([...this.visibleActions.values()].map(async (action) => {
			await action.setTitle(title);
		}));
	}

	private mutedFromMessage(message: OscResponse): boolean {
		const numericArg = this.lastNumericArg(message.args);

		if (numericArg === undefined) {
			throw new Error(`${channelMuteAddress} message did not include a numeric mute value.`);
		}

		return numericArg !== 0;
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
}
