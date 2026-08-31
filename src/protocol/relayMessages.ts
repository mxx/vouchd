/**
 * The relay wire protocol: typed encoding and decoding of the JSON arrays
 * that travel over the WebSocket (NIP-01, plus NIP-42's AUTH).
 *
 * Split out from relayClient.ts on purpose: everything here is pure, so the
 * protocol can be tested exhaustively without a socket, a relay, or fake
 * timers. The stateful half — connection, retries, subscription bookkeeping
 * — is the part that needs a running relay to exercise, and keeping it thin
 * is only possible if the parsing lives somewhere else.
 *
 * Parsing is deliberately strict and total: a relay message that doesn't fit
 * a known shape throws rather than being silently coerced. A malformed frame
 * is either a relay bug or a protocol drift, and both are things we want to
 * see immediately, not paper over.
 */

export class RelayProtocolError extends Error {}

/** A fully signed Nostr event, as it appears on the wire. */
export interface SignedEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

/** A NIP-01 subscription filter. Tag filters use the `#<letter>` keys. */
export interface Filter {
  ids?: string[];
  authors?: string[];
  kinds?: number[];
  since?: number;
  until?: number;
  limit?: number;
  [tagFilter: `#${string}`]: string[] | undefined | number | number[] | string;
}

export type RelayMessage =
  | { type: "EVENT"; subscriptionId: string; event: SignedEvent }
  | { type: "EOSE"; subscriptionId: string }
  | { type: "OK"; eventId: string; accepted: boolean; message: string }
  | { type: "NOTICE"; message: string }
  | { type: "CLOSED"; subscriptionId: string; message: string }
  | { type: "AUTH"; challenge: string };

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new RelayProtocolError(`${label} must be a string, got ${JSON.stringify(value)}`);
  }
  return value;
}

function requireEvent(value: unknown): SignedEvent {
  const event = value as SignedEvent | undefined;
  if (!event || typeof event !== "object" || typeof event.id !== "string") {
    throw new RelayProtocolError(`EVENT payload is not an event: ${JSON.stringify(value)}`);
  }
  return event;
}

/** Decode one frame. Throws `RelayProtocolError` on anything unrecognized. */
export function parseRelayMessage(raw: string): RelayMessage {
  let frame: unknown;
  try {
    frame = JSON.parse(raw);
  } catch {
    throw new RelayProtocolError(`frame is not JSON: ${raw.slice(0, 120)}`);
  }
  if (!Array.isArray(frame) || frame.length === 0) {
    throw new RelayProtocolError(`frame is not a non-empty array: ${raw.slice(0, 120)}`);
  }
  const [label, ...rest] = frame;
  switch (label) {
    case "EVENT":
      return {
        type: "EVENT",
        subscriptionId: requireString(rest[0], "EVENT subscription id"),
        event: requireEvent(rest[1]),
      };
    case "EOSE":
      return { type: "EOSE", subscriptionId: requireString(rest[0], "EOSE subscription id") };
    case "OK":
      return {
        type: "OK",
        eventId: requireString(rest[0], "OK event id"),
        accepted: rest[1] === true,
        message: typeof rest[2] === "string" ? rest[2] : "",
      };
    case "NOTICE":
      return { type: "NOTICE", message: requireString(rest[0], "NOTICE message") };
    case "CLOSED":
      return {
        type: "CLOSED",
        subscriptionId: requireString(rest[0], "CLOSED subscription id"),
        message: typeof rest[1] === "string" ? rest[1] : "",
      };
    case "AUTH":
      return { type: "AUTH", challenge: requireString(rest[0], "AUTH challenge") };
    default:
      throw new RelayProtocolError(`unknown relay message type: ${JSON.stringify(label)}`);
  }
}

export function encodeReq(subscriptionId: string, filters: Filter[]): string {
  return JSON.stringify(["REQ", subscriptionId, ...filters]);
}

export function encodeClose(subscriptionId: string): string {
  return JSON.stringify(["CLOSE", subscriptionId]);
}

export function encodeEvent(event: SignedEvent): string {
  return JSON.stringify(["EVENT", event]);
}

export function encodeAuth(event: SignedEvent): string {
  return JSON.stringify(["AUTH", event]);
}
