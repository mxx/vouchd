import { describe, expect, it } from "vitest";
import {
  encodeAuth,
  encodeClose,
  encodeEvent,
  encodeReq,
  parseRelayMessage,
  RelayProtocolError,
  type SignedEvent,
} from "@/protocol/relayMessages";

const EVENT: SignedEvent = {
  id: "a".repeat(64),
  pubkey: "b".repeat(64),
  created_at: 1_700_000_000,
  kind: 1,
  tags: [],
  content: "hi",
  sig: "c".repeat(128),
};

describe("parseRelayMessage", () => {
  it("decodes an EVENT frame with its subscription id", () => {
    expect(parseRelayMessage(JSON.stringify(["EVENT", "sub0", EVENT]))).toEqual({
      type: "EVENT",
      subscriptionId: "sub0",
      event: EVENT,
    });
  });

  it("decodes EOSE", () => {
    expect(parseRelayMessage(JSON.stringify(["EOSE", "sub0"]))).toEqual({
      type: "EOSE",
      subscriptionId: "sub0",
    });
  });

  it("decodes OK with its acceptance flag and message", () => {
    expect(parseRelayMessage(JSON.stringify(["OK", EVENT.id, true, "stored"]))).toEqual({
      type: "OK",
      eventId: EVENT.id,
      accepted: true,
      message: "stored",
    });
  });

  it("decodes NOTICE", () => {
    expect(parseRelayMessage(JSON.stringify(["NOTICE", "slow down"]))).toEqual({
      type: "NOTICE",
      message: "slow down",
    });
  });

  it("decodes CLOSED with the relay's reason", () => {
    expect(parseRelayMessage(JSON.stringify(["CLOSED", "sub0", "auth-required"]))).toEqual({
      type: "CLOSED",
      subscriptionId: "sub0",
      message: "auth-required",
    });
  });

  it("decodes a NIP-42 AUTH challenge", () => {
    expect(parseRelayMessage(JSON.stringify(["AUTH", "challenge-string"]))).toEqual({
      type: "AUTH",
      challenge: "challenge-string",
    });
  });

  it("treats a missing OK message as empty rather than failing the frame", () => {
    const parsed = parseRelayMessage(JSON.stringify(["OK", EVENT.id, false]));
    expect(parsed).toEqual({ type: "OK", eventId: EVENT.id, accepted: false, message: "" });
  });

  it("throws on anything it cannot recognize, instead of coercing", () => {
    expect(() => parseRelayMessage("not json")).toThrow(RelayProtocolError);
    expect(() => parseRelayMessage("{}")).toThrow(RelayProtocolError);
    expect(() => parseRelayMessage("[]")).toThrow(RelayProtocolError);
    expect(() => parseRelayMessage(JSON.stringify(["MYSTERY", 1]))).toThrow(RelayProtocolError);
    expect(() => parseRelayMessage(JSON.stringify(["EOSE", 7]))).toThrow(RelayProtocolError);
    expect(() => parseRelayMessage(JSON.stringify(["EVENT", "sub0", { no: "id" }]))).toThrow(
      RelayProtocolError,
    );
  });
});

describe("encoders", () => {
  it("produce the NIP-01 frames verbatim", () => {
    expect(encodeReq("sub0", [{ kinds: [1], limit: 10 }])).toBe(
      '["REQ","sub0",{"kinds":[1],"limit":10}]',
    );
    expect(encodeClose("sub0")).toBe('["CLOSE","sub0"]');
    expect(JSON.parse(encodeEvent(EVENT))[0]).toBe("EVENT");
    expect(JSON.parse(encodeAuth(EVENT))[0]).toBe("AUTH");
  });
});
