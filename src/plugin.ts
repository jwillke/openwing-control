import streamDeck from "@elgato/streamdeck";

import { Channel1Mute } from "./actions/channel1-mute";
import { ConfigurableMute } from "./actions/configurable-mute";
import { EncoderSpike } from "./actions/encoder-spike";
import { Main1Mute } from "./actions/main1-mute";
import { TargetEncoder } from "./actions/target-encoder";
import { FeedbackSpike } from "./tools/feedback-spike";
import { channelRepository, connection } from "./wing/wingRuntime";

type ChannelSummariesRequest = {
	type: "openwing.requestChannelSummaries";
	count?: number;
};

let unsubscribeChannelSummaryUpdates: (() => void) | undefined;
let channelSummarySessionId = 0;

// We can enable "trace" logging so that all messages between the Stream Deck, and the plugin are recorded. When storing sensitive information
streamDeck.logger.setLevel("trace");

streamDeck.ui.onSendToPlugin(async (ev) => {
	if (!isChannelSummariesRequest(ev.payload)) {
		return;
	}

	try {
		await startChannelSummaryUpdates(normalizeChannelSummaryCount(ev.payload.count));
	} catch (error) {
		await streamDeck.ui.sendToPropertyInspector({
			type: "openwing.channelSummariesError",
			message: error instanceof Error ? error.message : "Unable to load channel summaries."
		});
	}
});

streamDeck.ui.onDidDisappear(() => {
	stopChannelSummaryUpdates();
});

// Register the Main 1 mute action.
streamDeck.actions.registerAction(new Main1Mute());
streamDeck.actions.registerAction(new Channel1Mute());
streamDeck.actions.registerAction(new ConfigurableMute());
streamDeck.actions.registerAction(new EncoderSpike());
streamDeck.actions.registerAction(new TargetEncoder());
streamDeck.actions.registerAction(new FeedbackSpike());

// Finally, connect to the Stream Deck.
streamDeck.connect();

function isChannelSummariesRequest(payload: unknown): payload is ChannelSummariesRequest {
	return (
		typeof payload === "object" &&
		payload !== null &&
		"type" in payload &&
		payload.type === "openwing.requestChannelSummaries"
	);
}

function normalizeChannelSummaryCount(count: unknown): number {
	return typeof count === "number" && Number.isInteger(count) && count > 0 ? Math.min(count, 64) : 40;
}

async function startChannelSummaryUpdates(count: number): Promise<void> {
	unsubscribeChannelSummaryUpdates?.();
	unsubscribeChannelSummaryUpdates = undefined;

	const sessionId = ++channelSummarySessionId;
	await connection.connect();

	const states = await Promise.all(
		Array.from({ length: count }, (_, index) => channelRepository.getChannel(index + 1))
	);

	if (sessionId !== channelSummarySessionId) {
		return;
	}

	const unsubscribes = states.map((state) =>
		state.subscribe(() => {
			void sendChannelSummaries(sessionId, count);
		})
	);

	unsubscribeChannelSummaryUpdates = () => {
		for (const unsubscribe of unsubscribes) {
			unsubscribe();
		}
	};

	await sendChannelSummaries(sessionId, count);
}

function stopChannelSummaryUpdates(): void {
	unsubscribeChannelSummaryUpdates?.();
	unsubscribeChannelSummaryUpdates = undefined;
	channelSummarySessionId++;
}

async function sendChannelSummaries(sessionId: number, count: number): Promise<void> {
	const summaries = await channelRepository.getChannelSummaries(count);

	if (sessionId !== channelSummarySessionId) {
		return;
	}

	await streamDeck.ui.sendToPropertyInspector({
		type: "openwing.channelSummaries",
		summaries: summaries.map((summary) => ({
			index: summary.index,
			name: summary.name,
			color: summary.color ?? null,
			icon: summary.icon ?? null,
			muted: summary.muted,
			faderDb: summary.faderDb ?? null
		}))
	});
}
