import {
	action,
	DialAction,
	DialRotateEvent,
	FeedbackPayload,
	SingletonAction,
	TouchTapEvent,
	WillAppearEvent,
	WillDisappearEvent
} from "@elgato/streamdeck";

type FeedbackSpikeSettings = {
	[key: string]: string | number | boolean | null | undefined;
};

type FeedbackScenario = {
	label: string;
	layout?: string;
	payload?: FeedbackPayload;
	image?: string;
};

const feedbackScenarios: FeedbackScenario[] = [
	{
		label: "basic title/value/indicator",
		payload: {
			title: "Feedback",
			value: "basic",
			indicator: 25
		}
	},
	{
		label: "high indicator",
		payload: {
			title: "Indicator",
			value: "75",
			indicator: 75
		}
	},
	{
		label: "built-in layout $B1",
		layout: "$B1",
		payload: {
			title: "Layout $B1",
			value: "B1",
			indicator: 50
		}
	},
	{
		label: "built-in layout $A1",
		layout: "$A1",
		payload: {
			title: "Layout $A1",
			value: "A1",
			indicator: 50
		}
	},
	{
		label: "text item objects",
		payload: {
			title: {
				value: "Title object"
			},
			value: {
				value: "Value object"
			},
			indicator: 40
		}
	},
	{
		label: "icon key as pixmap path",
		payload: {
			title: "Icon key",
			value: "icon",
			indicator: 45,
			icon: "imgs/actions/counter/icon.png"
		}
	},
	{
		label: "image key as pixmap path",
		payload: {
			title: "Image key",
			value: "image",
			indicator: 55,
			image: "imgs/actions/counter/key.png"
		}
	},
	{
		label: "setImage SVG",
		image:
			'<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144"><rect width="144" height="144" fill="#334155"/><text x="72" y="78" fill="#f8fafc" font-size="24" text-anchor="middle">IMG</text></svg>',
		payload: {
			title: "setImage",
			value: "svg",
			indicator: 65
		}
	},
	{
		label: "background/color candidate fields",
		payload: {
			title: "Color fields",
			value: "bg",
			indicator: 80,
			background: "#ef4444",
			backgroundColor: "#ef4444",
			color: "#ffffff",
			valueColor: "#ffffff"
		} as FeedbackPayload
	},
	{
		label: "bar/color object candidates",
		payload: {
			title: "Bar color",
			value: "bar",
			indicator: {
				value: 90,
				bar_bg_c: "#1f2937",
				bar_fill_c: "#22c55e"
			}
		} as FeedbackPayload
	}
];

@action({ UUID: "com.jrg-willke.openwing-control.feedback-spike" })
export class FeedbackSpike extends SingletonAction<FeedbackSpikeSettings> {
	private readonly scenarioIndexes = new Map<string, number>();
	private readonly intervals = new Map<string, ReturnType<typeof setInterval>>();

	override async onWillAppear(ev: WillAppearEvent<FeedbackSpikeSettings>): Promise<void> {
		if (!ev.action.isDial()) {
			return;
		}

		const action = ev.action;

		this.scenarioIndexes.set(action.id, 0);
		await this.applyCurrentScenario(action);

		const interval = setInterval(() => {
			void this.advanceScenario(action).catch((error: unknown) => {
				this.log("cycle failed", error);
			});
		}, 2500);

		this.intervals.set(action.id, interval);
	}

	override onWillDisappear(ev: WillDisappearEvent<FeedbackSpikeSettings>): void {
		const interval = this.intervals.get(ev.action.id);

		if (interval) {
			clearInterval(interval);
		}

		this.intervals.delete(ev.action.id);
		this.scenarioIndexes.delete(ev.action.id);
	}

	override async onDialRotate(ev: DialRotateEvent<FeedbackSpikeSettings>): Promise<void> {
		if (ev.payload.ticks === 0) {
			return;
		}

		await this.advanceScenario(ev.action, ev.payload.ticks > 0 ? 1 : -1);
	}

	override async onTouchTap(ev: TouchTapEvent<FeedbackSpikeSettings>): Promise<void> {
		await this.advanceScenario(ev.action);
	}

	private async advanceScenario(action: DialAction<FeedbackSpikeSettings>, direction = 1): Promise<void> {
		const currentIndex = this.scenarioIndexes.get(action.id) ?? 0;
		const nextIndex = (currentIndex + direction + feedbackScenarios.length) % feedbackScenarios.length;

		this.scenarioIndexes.set(action.id, nextIndex);
		await this.applyCurrentScenario(action);
	}

	private async applyCurrentScenario(action: DialAction<FeedbackSpikeSettings>): Promise<void> {
		const index = this.scenarioIndexes.get(action.id) ?? 0;
		const scenario = feedbackScenarios[index];

		this.log("testing feedback scenario", {
			index,
			label: scenario.label,
			layout: scenario.layout,
			payload: scenario.payload,
			image: scenario.image ? "(provided)" : undefined
		});

		try {
			if (scenario.layout) {
				await action.setFeedbackLayout(scenario.layout);
				this.log("layout accepted", scenario.layout);
			}

			if (scenario.image) {
				await action.setImage(scenario.image);
				this.log("image accepted", scenario.label);
			}

			if (scenario.payload) {
				await action.setFeedback(scenario.payload);
				this.log("payload accepted", scenario.payload);
			}
		} catch (error) {
			this.log("scenario rejected or unsupported", {
				label: scenario.label,
				error: error instanceof Error ? error.message : String(error)
			});
		}
	}

	private log(label: string, value: unknown): void {
		console.log(`[${new Date().toISOString()}] feedback-spike ${label}`, value);
	}
}
