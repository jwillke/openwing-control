import { action, KeyDownEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";

import { MuteBehavior, MuteMode, MuteTargetType } from "./behaviors/MuteBehavior";
import type { OscResponse } from "../wing/IWingConnection";
import { connection, wing } from "../wing/wingRuntime";

type MuteActionSettings = {
	[key: string]: string | number | boolean | null | undefined;
	targetType?: MuteTargetType;
	targetIndex?: number;
	mode?: MuteMode;
};

type ResolvedMuteActionSettings = {
	targetType: MuteTargetType;
	targetIndex: number;
	mode: MuteMode;
};

type TitleAction = {
	setTitle(title: string): Promise<void>;
};

type VisibleAction = {
	action: TitleAction;
	address: string;
	unsubscribe(): void;
};

const defaultSettings: ResolvedMuteActionSettings = {
	targetType: "channel",
	targetIndex: 1,
	mode: "toggle"
};

@action({ UUID: "com.jrg-willke.openwing-control.configurable-mute" })
export class ConfigurableMute extends SingletonAction<MuteActionSettings> {
	private readonly visibleActions = new Map<string, VisibleAction>();

	override async onWillAppear(ev: WillAppearEvent<MuteActionSettings>): Promise<void> {
		const settings = this.resolveSettings(ev.payload.settings);
		const behavior = this.behavior(settings);
		const address = behavior.muteAddress();
		const unsubscribe = connection.subscribe(address, async (message) => {
			await this.updateTitleFromMessage(ev.action, message);
		});

		this.visibleActions.set(ev.action.id, {
			action: ev.action,
			address,
			unsubscribe
		});

		try {
			await this.connectAndSubscribe(address);
			await this.refreshTitle(ev.action, behavior);
		} catch {
			await ev.action.setTitle("ERR");
		}
	}

	override onWillDisappear(ev: WillDisappearEvent<MuteActionSettings>): void {
		const visibleAction = this.visibleActions.get(ev.action.id);

		if (!visibleAction) {
			return;
		}

		visibleAction.unsubscribe();
		this.visibleActions.delete(ev.action.id);
	}

	override async onKeyDown(ev: KeyDownEvent<MuteActionSettings>): Promise<void> {
		const settings = this.resolveSettings(ev.payload.settings);
		const behavior = this.behavior(settings);

		try {
			await this.connectAndSubscribe(behavior.muteAddress());
			await behavior.execute();
			await this.refreshTitle(ev.action, behavior);
		} catch {
			await ev.action.setTitle("ERR");
		}
	}

	private async connectAndSubscribe(address: string): Promise<void> {
		await connection.connect();
		await connection.subscribeRemote(address);
	}

	private async refreshTitle(action: TitleAction, behavior: MuteBehavior): Promise<void> {
		const muted = await behavior.getState();
		await action.setTitle(muted ? "MUTED" : "LIVE");
	}

	private async updateTitleFromMessage(action: TitleAction, message: OscResponse): Promise<void> {
		const muted = this.mutedFromMessage(message);
		await action.setTitle(muted ? "MUTED" : "LIVE");
	}

	private behavior(settings: ResolvedMuteActionSettings): MuteBehavior {
		return new MuteBehavior(wing, settings.targetType, settings.targetIndex, settings.mode);
	}

	private resolveSettings(settings: MuteActionSettings): ResolvedMuteActionSettings {
		return {
			targetType: this.isTargetType(settings.targetType) ? settings.targetType : defaultSettings.targetType,
			targetIndex: this.isPositiveInteger(settings.targetIndex) ? settings.targetIndex : defaultSettings.targetIndex,
			mode: this.isMode(settings.mode) ? settings.mode : defaultSettings.mode
		};
	}

	private isTargetType(value: unknown): value is MuteTargetType {
		return value === "channel" || value === "main";
	}

	private isMode(value: unknown): value is MuteMode {
		return value === "toggle" || value === "mute" || value === "unmute";
	}

	private isPositiveInteger(value: unknown): value is number {
		return typeof value === "number" && Number.isInteger(value) && value > 0;
	}

	private mutedFromMessage(message: OscResponse): boolean {
		const numericArg = this.lastNumericArg(message.args);

		if (numericArg === undefined) {
			throw new Error(`${message.address ?? "OSC message"} did not include a numeric mute value.`);
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
