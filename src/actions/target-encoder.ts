import {
	action,
	DialAction,
	DialDownEvent,
	DialRotateEvent,
	SingletonAction,
	WillAppearEvent,
	WillDisappearEvent
} from "@elgato/streamdeck";

import { LevelBehavior } from "./behaviors/LevelBehavior";
import { MuteBehavior } from "./behaviors/MuteBehavior";
import type { Target } from "./targets/Target";
import type { OscResponse } from "../wing/IWingConnection";
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
	unsubscribeFader(): void;
	unsubscribeMute(): void;
	unsubscribeName(): void;
	state: EncoderDisplayState;
	title: string;
};

type EncoderDisplayState = {
	faderValue?: number;
	normalizedValue?: number;
	muted?: boolean;
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
		const state: EncoderDisplayState = {};
		const visibleEncoder: VisibleEncoder = {
			action,
			unsubscribeFader: () => undefined,
			unsubscribeMute: () => undefined,
			unsubscribeName: () => undefined,
			state,
			title: fallbackTitle
		};
		const unsubscribeFader = connection.subscribe(target.faderAddress(), async (message) => {
			this.updateFaderState(state, message);
			await this.updateDisplay(action, state, visibleEncoder.title);
		});
		const unsubscribeMute = connection.subscribe(target.muteAddress(), async (message) => {
			this.updateMuteState(state, message);
			await this.updateDisplay(action, state, visibleEncoder.title);
		});
		const unsubscribeName = connection.subscribe(target.nameAddress(), async (message) => {
			const name = this.firstStringArg(message.args);

			if (name === undefined) {
				return;
			}

			visibleEncoder.title = name;
			await this.updateDisplay(action, state, visibleEncoder.title);
		});

		visibleEncoder.unsubscribeFader = unsubscribeFader;
		visibleEncoder.unsubscribeMute = unsubscribeMute;
		visibleEncoder.unsubscribeName = unsubscribeName;
		this.visibleEncoders.set(action.id, visibleEncoder);

		try {
			await this.connectAndSubscribe(target);
			visibleEncoder.title = await this.readTargetTitle(target, fallbackTitle);
			await this.refreshDisplay(action, state, target, visibleEncoder.title);
		} catch {
			await action.setFeedback({
				title: visibleEncoder.title,
				value: "ERR",
				indicator: 0
			});
		}
	}

	override onWillDisappear(ev: WillDisappearEvent<TargetEncoderSettings>): void {
		const visibleEncoder = this.visibleEncoders.get(ev.action.id);

		if (!visibleEncoder) {
			return;
		}

		visibleEncoder.unsubscribeFader();
		visibleEncoder.unsubscribeMute();
		visibleEncoder.unsubscribeName();
		this.visibleEncoders.delete(ev.action.id);
	}

	override async onDialRotate(ev: DialRotateEvent<TargetEncoderSettings>): Promise<void> {
		const settings = this.resolveSettings(ev.payload.settings);
		const visibleEncoder = this.visibleEncoders.get(ev.action.id);
		const target = this.target(settings);
		const title = visibleEncoder?.title ?? this.targetTitle(settings);
		const levelBehavior = new LevelBehavior(target);

		try {
			await connection.connect();
			await this.connectAndSubscribe(target);
			const currentValue = await levelBehavior.getState();
			const nextValue = this.nextFaderValue(currentValue, ev.payload.ticks, settings.stepDb);

			await levelBehavior.setState(nextValue);
			await this.refreshDisplay(ev.action, visibleEncoder?.state ?? {}, target, title);
		} catch {
			await ev.action.setFeedback({
				title,
				value: "ERR",
				indicator: 0
			});
		}
	}

	override async onDialDown(ev: DialDownEvent<TargetEncoderSettings>): Promise<void> {
		const settings = this.resolveSettings(ev.payload.settings);
		const visibleEncoder = this.visibleEncoders.get(ev.action.id);
		const target = this.target(settings);
		const title = visibleEncoder?.title ?? this.targetTitle(settings);
		const muteBehavior = new MuteBehavior(target, "toggle");

		try {
			await connection.connect();
			await this.connectAndSubscribe(target);
			await muteBehavior.execute();
			await this.refreshDisplay(ev.action, visibleEncoder?.state ?? {}, target, title);
		} catch {
			await ev.action.setFeedback({
				title,
				value: "ERR",
				indicator: 0
			});
		}
	}

	private async connectAndSubscribe(target: EncoderTarget): Promise<void> {
		await connection.connect();
		await connection.subscribeRemote(target.faderAddress());
		await connection.subscribeRemote(target.muteAddress());
		await connection.subscribeRemote(target.nameAddress());
	}

	private async readTargetTitle(target: EncoderTarget, fallbackTitle: string): Promise<string> {
		try {
			const name = await target.getName();

			return name.trim().length > 0 ? name : fallbackTitle;
		} catch {
			return fallbackTitle;
		}
	}

	private async refreshDisplay(
		action: DialAction<TargetEncoderSettings>,
		state: EncoderDisplayState,
		target: EncoderTarget,
		title: string
	): Promise<void> {
		const levelBehavior = new LevelBehavior(target);
		const muteBehavior = new MuteBehavior(target, "toggle");

		state.faderValue = await levelBehavior.getState();
		state.normalizedValue = await levelBehavior.getNormalized();
		state.muted = await muteBehavior.getState();

		await this.updateDisplay(action, state, title);
	}

	private async updateDisplay(action: DialAction<TargetEncoderSettings>, state: EncoderDisplayState, title: string): Promise<void> {
		const indicator = this.indicatorValue(state.normalizedValue);

		await action.setFeedback({
			title: state.muted ? `${title} MUTED` : title,
			value: this.formatDisplayValue(state),
			indicator
		});
	}

	private updateFaderState(state: EncoderDisplayState, message: OscResponse): void {
		const normalizedValue = this.numericArgAt(message.args, 1);
		const faderValue = this.lastNumericArg(message.args);

		if (faderValue !== undefined) {
			state.faderValue = faderValue;
		}

		if (normalizedValue !== undefined) {
			state.normalizedValue = normalizedValue;
		}
	}

	private updateMuteState(state: EncoderDisplayState, message: OscResponse): void {
		const numericArg = this.lastNumericArg(message.args);

		if (numericArg !== undefined) {
			state.muted = numericArg !== 0;
		}
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

	private formatDisplayValue(state: EncoderDisplayState): string {
		if (state.faderValue === undefined) {
			return "--";
		}

		return this.formatFaderValue(state.faderValue);
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

	private firstStringArg(args: unknown[] | undefined): string | undefined {
		if (!args) {
			return undefined;
		}

		return args.find((arg): arg is string => typeof arg === "string" && arg.trim().length > 0);
	}

	private numericArgAt(args: unknown[] | undefined, numericIndex: number): number | undefined {
		if (!args) {
			return undefined;
		}

		let seenNumericArgs = 0;

		for (const arg of args) {
			if (typeof arg !== "number") {
				continue;
			}

			if (seenNumericArgs === numericIndex) {
				return arg;
			}

			seenNumericArgs++;
		}

		return undefined;
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
