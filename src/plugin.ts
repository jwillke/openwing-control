import streamDeck from "@elgato/streamdeck";

import { Channel1Mute } from "./actions/channel1-mute";
import { ConfigurableMute } from "./actions/configurable-mute";
import { EncoderSpike } from "./actions/encoder-spike";
import { Main1Mute } from "./actions/main1-mute";
import { TargetEncoder } from "./actions/target-encoder";
import { FeedbackSpike } from "./tools/feedback-spike";

// We can enable "trace" logging so that all messages between the Stream Deck, and the plugin are recorded. When storing sensitive information
streamDeck.logger.setLevel("trace");

// Register the Main 1 mute action.
streamDeck.actions.registerAction(new Main1Mute());
streamDeck.actions.registerAction(new Channel1Mute());
streamDeck.actions.registerAction(new ConfigurableMute());
streamDeck.actions.registerAction(new EncoderSpike());
streamDeck.actions.registerAction(new TargetEncoder());
streamDeck.actions.registerAction(new FeedbackSpike());

// Finally, connect to the Stream Deck.
streamDeck.connect();
