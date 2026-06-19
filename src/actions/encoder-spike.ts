import {
	action,
	DialDownEvent,
	DialRotateEvent,
	DialUpEvent,
	SingletonAction,
	TouchTapEvent,
	WillAppearEvent,
	WillDisappearEvent
} from "@elgato/streamdeck";

type EncoderSpikeSettings = {
	[key: string]: string | number | boolean | null | undefined;
};

@action({ UUID: "com.jrg-willke.openwing-control.encoder-spike" })
export class EncoderSpike extends SingletonAction<EncoderSpikeSettings> {
	private readonly rotations = new Map<string, number>();

	override async onWillAppear(ev: WillAppearEvent<EncoderSpikeSettings>): Promise<void> {
		this.logEvent("willAppear", ev);
		this.rotations.set(ev.action.id, 0);

		if (ev.action.isDial()) {
			await this.updateDisplay(ev.action, 0);
		}
	}

	override onWillDisappear(ev: WillDisappearEvent<EncoderSpikeSettings>): void {
		this.logEvent("willDisappear", ev);
		this.rotations.delete(ev.action.id);
	}

	override async onDialRotate(ev: DialRotateEvent<EncoderSpikeSettings>): Promise<void> {
		this.logEvent("dialRotate", ev);

		const rotation = (this.rotations.get(ev.action.id) ?? 0) + ev.payload.ticks;
		this.rotations.set(ev.action.id, rotation);
		await this.updateDisplay(ev.action, rotation);
	}

	override onDialDown(ev: DialDownEvent<EncoderSpikeSettings>): void {
		this.logEvent("dialDown", ev);
	}

	override onDialUp(ev: DialUpEvent<EncoderSpikeSettings>): void {
		this.logEvent("dialUp", ev);
	}

	override async onTouchTap(ev: TouchTapEvent<EncoderSpikeSettings>): Promise<void> {
		this.logEvent("touchTap", ev);
		await this.updateDisplay(ev.action, this.rotations.get(ev.action.id) ?? 0);
	}

	private async updateDisplay(action: DialRotateEvent<EncoderSpikeSettings>["action"], rotation: number): Promise<void> {
		await action.setFeedback({
			title: "Encoder Spike",
			value: `${rotation}`,
			indicator: this.normalizedRotation(rotation)
		});
	}

	private normalizedRotation(rotation: number): number {
		return Math.max(0, Math.min(100, rotation + 50));
	}

	private logEvent(label: string, event: unknown): void {
		console.log(`[${new Date().toISOString()}] encoder-spike ${label}`, JSON.stringify(event, null, 2));
	}
}
