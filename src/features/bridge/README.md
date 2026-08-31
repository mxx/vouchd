# features/bridge/

Deliberately NOT built in the MVP. Bridging a bot that can't speak Nostr
itself (receiving/sending over a webhook) structurally needs an always-on
server process — a browser tab can't receive inbound HTTP. This directory
exists only to record that decision; see docs/ARCHITECTURE.md. If this is
ever needed, build it as an independent, optional service, not as a
dependency the core app requires to function.
