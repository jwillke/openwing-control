import {
	action,
	DialAction,
	DialDownEvent,
	DialRotateEvent,
	SingletonAction,
	WillAppearEvent,
	WillDisappearEvent
} from "@elgato/streamdeck";

import { getAppearance } from "../appearance/WingAppearance";
import { LevelBehavior } from "./behaviors/LevelBehavior";
import { MuteBehavior } from "./behaviors/MuteBehavior";
import type { Target } from "./targets/Target";
import { ChannelState } from "../state/ChannelState";
import { connection, wing } from "../wing/wingRuntime";

type TargetEncoderSettings = {
	[key: string]: string | number | boolean | null | undefined;
	targetType?: TargetEncoderTargetType;
	targetIndex?: number;
	stepDb?: number;
};

type TargetEncoderTargetType = "channel" | "main";

type ResolvedTargetEncoderSettings = {
	targetType: TargetEncoderTargetType;
	targetIndex: number;
	stepDb: number;
};

type EncoderTarget = Target & {
	getFader(): Promise<number>;
	getFaderNormalized(): Promise<number>;
	setFader(value: number): Promise<void>;
	faderAddress(): string;
};

type VisibleEncoder = {
	action: DialAction<TargetEncoderSettings>;
	state: ChannelState;
	unsubscribeState(): void;
};

const defaultSettings: ResolvedTargetEncoderSettings = {
	targetType: "channel",
	targetIndex: 1,
	stepDb: 0.5
};
const faderNegativeInfinity = -144;
const faderLiftOffValue = -90;

@action({ UUID: "com.jrg-willke.openwing-control.target-encoder" })
export class TargetEncoder extends SingletonAction<TargetEncoderSettings> {
	private readonly visibleEncoders = new Map<string, VisibleEncoder>();

	override async onWillAppear(ev: WillAppearEvent<TargetEncoderSettings>): Promise<void> {
		if (!ev.action.isDial()) {
			return;
		}

		const action = ev.action;
		const settings = this.resolveSettings(ev.payload.settings);
		const target = this.target(settings);
		const fallbackTitle = this.targetTitle(settings);
		const state = new ChannelState(connection);
		const visibleEncoder: VisibleEncoder = {
			action,
			state,
			unsubscribeState: () => undefined
		};
		const unsubscribeState = state.subscribe(async () => {
			await this.updateDisplay(action, state, fallbackTitle);
		});

		visibleEncoder.unsubscribeState = unsubscribeState;
		this.visibleEncoders.set(action.id, visibleEncoder);

		try {
			await connection.connect();
			await state.attach(target);
			await this.updateDisplay(action, state, fallbackTitle);
		} catch {
			await this.updateErrorDisplay(action, fallbackTitle);
		}
	}

	override onWillDisappear(ev: WillDisappearEvent<TargetEncoderSettings>): void {
		const visibleEncoder = this.visibleEncoders.get(ev.action.id);

		if (!visibleEncoder) {
			return;
		}

		visibleEncoder.unsubscribeState();
		visibleEncoder.state.dispose();
		this.visibleEncoders.delete(ev.action.id);
	}

	override async onDialRotate(ev: DialRotateEvent<TargetEncoderSettings>): Promise<void> {
		const settings = this.resolveSettings(ev.payload.settings);
		const visibleEncoder = this.visibleEncoders.get(ev.action.id);
		const target = this.target(settings);
		const fallbackTitle = this.targetTitle(settings);
		const levelBehavior = new LevelBehavior(target);

		try {
			await connection.connect();
			const currentValue = await levelBehavior.getState();
			const nextValue = this.nextFaderValue(currentValue, ev.payload.ticks, settings.stepDb);

			await levelBehavior.setState(nextValue);
			await visibleEncoder?.state.attach(target);
		} catch {
			await this.updateErrorDisplay(ev.action, this.displayTitle(visibleEncoder?.state, fallbackTitle));
		}
	}

	override async onDialDown(ev: DialDownEvent<TargetEncoderSettings>): Promise<void> {
		const settings = this.resolveSettings(ev.payload.settings);
		const visibleEncoder = this.visibleEncoders.get(ev.action.id);
		const target = this.target(settings);
		const fallbackTitle = this.targetTitle(settings);
		const muteBehavior = new MuteBehavior(target, "toggle");

		try {
			await connection.connect();
			await muteBehavior.execute();
			await visibleEncoder?.state.attach(target);
		} catch {
			await this.updateErrorDisplay(ev.action, this.displayTitle(visibleEncoder?.state, fallbackTitle));
		}
	}

	private async updateDisplay(action: DialAction<TargetEncoderSettings>, state: ChannelState, fallbackTitle: string): Promise<void> {
		const indicator = this.indicatorValue(state.normalized);
		const title = this.displayTitle(state, fallbackTitle);
		const appearance = getAppearance(state.color, state.icon);
		const accentColor = state.muted ? "#dc2626" : appearance.streamDeckColor;
		const valueBackground = state.muted ? "#450a0a" : "#111827";

		await action.setFeedback({
			title: {
				value: state.muted ? `${title} MUTED` : title,
				color: "#ffffff",
				background: accentColor
			},
			value: {
				value: this.formatDisplayValue(state),
				color: state.muted ? "#fecaca" : "#f8fafc",
				background: valueBackground
			},
			level: {
				value: indicator,
				bar_bg_c: state.muted ? "#7f1d1d" : "#1f2937",
				bar_border_c: accentColor,
				bar_fill_c: accentColor
			},
			mute: {
				value: "MUTED",
				enabled: state.muted,
				color: "#ffffff",
				background: "#dc2626"
			}
		});
	}

	private async updateErrorDisplay(action: DialAction<TargetEncoderSettings>, title: string): Promise<void> {
		await action.setFeedback({
			title: {
				value: title,
				color: "#ffffff",
				background: "#dc2626"
			},
			value: {
				value: "ERR",
				color: "#ffffff",
				background: "#450a0a"
			},
			level: {
				value: 0,
				bar_bg_c: "#7f1d1d",
				bar_border_c: "#dc2626",
				bar_fill_c: "#dc2626"
			},
			mute: {
				value: "ERR",
				enabled: true,
				color: "#ffffff",
				background: "#dc2626"
			}
		});
	}

	private target(settings: ResolvedTargetEncoderSettings): EncoderTarget {
		if (settings.targetType === "main") {
			const main = wing.main(settings.targetIndex);

			return {
				getName: () => main.getName(),
				getMuted: () => main.getMuted(),
				setMuted: (muted) => main.setMuted(muted),
				toggleMuted: () => main.toggleMuted(),
				nameAddress: () => main.nameAddress(),
				muteAddress: () => `/main/${settings.targetIndex}/mute`,
				getFader: () => main.getFader(),
				getFaderNormalized: () => main.getFaderNormalized(),
				setFader: (value) => main.setFader(value),
				faderAddress: () => main.faderAddress()
			};
		}

		const channel = wing.channel(settings.targetIndex);

		return {
			getName: () => channel.getName(),
			getMuted: () => channel.getMuted(),
			setMuted: (muted) => channel.setMuted(muted),
			toggleMuted: () => channel.toggleMuted(),
			nameAddress: () => channel.nameAddress(),
			muteAddress: () => `/ch/${settings.targetIndex}/mute`,
			getFader: () => channel.getFader(),
			getFaderNormalized: () => channel.getFaderNormalized(),
			setFader: (value) => channel.setFader(value),
			faderAddress: () => channel.faderAddress()
		};
	}

	private targetTitle(settings: ResolvedTargetEncoderSettings): string {
		if (settings.targetType === "main") {
			return `MAIN ${settings.targetIndex}`;
		}

		return `CH ${settings.targetIndex}`;
	}

	private formatFaderValue(value: number): string {
		if (value <= faderNegativeInfinity) {
			return "-oo dB";
		}

		return `${value.toFixed(1)} dB`;
	}

	private formatDisplayValue(state: ChannelState): string {
		if (state.faderDb === undefined) {
			return "--";
		}

		return this.formatFaderValue(state.faderDb);
	}

	private nextFaderValue(currentValue: number, ticks: number, stepDb: number): number {
		const startingValue = currentValue <= faderNegativeInfinity && ticks > 0 ? faderLiftOffValue : currentValue;

		return startingValue + ticks * stepDb;
	}

	private indicatorValue(normalizedValue: number | undefined): number {
		if (normalizedValue === undefined) {
			return 0;
		}

		return this.clampIndicator(Math.round(normalizedValue * 100));
	}

	private clampIndicator(indicator: number): number {
		return Math.max(0, Math.min(100, indicator));
	}

	private displayTitle(state: ChannelState | undefined, fallbackTitle: string): string {
		const name = state?.name.trim();

		return name && name.length > 0 ? name : fallbackTitle;
	}

	private resolveSettings(settings: TargetEncoderSettings): ResolvedTargetEncoderSettings {
		return {
			targetType: this.isTargetType(settings.targetType) ? settings.targetType : defaultSettings.targetType,
			targetIndex: this.isPositiveInteger(settings.targetIndex) ? settings.targetIndex : defaultSettings.targetIndex,
			stepDb: this.isStepDb(settings.stepDb) ? settings.stepDb : defaultSettings.stepDb
		};
	}

	private isTargetType(value: unknown): value is TargetEncoderTargetType {
		return value === "channel" || value === "main";
	}

	private isPositiveInteger(value: unknown): value is number {
		return typeof value === "number" && Number.isInteger(value) && value > 0;
	}

	private isStepDb(value: unknown): value is number {
		return typeof value === "number" && Number.isFinite(value) && value >= 0.1;
	}
}
