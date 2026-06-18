# OpenWING Control Development Guidelines

OpenWING Control provides native Stream Deck integration for the Behringer WING mixer.

## Core Principles

- Use TypeScript only.
- Use the official Elgato Stream Deck SDK.
- Favor readability over cleverness.
- Keep classes small and focused.
- Prefer composition over inheritance.
- Keep public APIs stable.
- Never introduce breaking architectural changes without discussion.

## Architecture

- Never access OSC directly from Stream Deck actions.
- All communication with the mixer must go through an `IWingConnection` interface.
- Keep Stream Deck action code focused on user interaction, presentation, and SDK integration.
- Keep mixer communication isolated behind connection abstractions.

## Code Style

- Use `async`/`await` instead of callbacks.
- Add comments only when they explain intent, tradeoffs, or non-obvious behavior.
- Do not add comments that merely restate what the code already says.

## Testing

- Every commit must build successfully.
- Keep the plugin runnable at all times.
- Prefer incremental changes over large refactorings.

## Architecture

- There must only be one active connection to the mixer.
- Actions must never keep their own OSC state.

## Dependencies

- Avoid adding new dependencies unless there is a clear benefit.