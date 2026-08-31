import { describe, expect, it } from "vitest";
import {
  attachAuthTag,
  AuthTagError,
  buildAddMember,
  buildCreateChannel,
  buildJoin,
  buildLeave,
  buildPresenceUpdate,
  buildProfile,
  buildRemoveMember,
  canonicalChannelName,
  EventBuildError,
} from "@/protocol/events";
import type { AuthTag } from "@/protocol/nipOA";

const CHANNEL = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const AGENT = "c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5";
const AT = 1_700_000_000;

describe("membership events match the Buzz wire shapes", () => {
  it("add-member is kind:9000 with h + p, and role when given", () => {
    expect(buildAddMember(CHANNEL, AGENT, "bot", AT)).toEqual({
      kind: 9000,
      tags: [["h", CHANNEL], ["p", AGENT], ["role", "bot"]],
      content: "",
      created_at: AT,
    });
  });

  it("omits the role tag entirely when no role is given", () => {
    expect(buildAddMember(CHANNEL, AGENT, undefined, AT).tags).toEqual([
      ["h", CHANNEL],
      ["p", AGENT],
    ]);
  });

  it("remove/join/leave carry their own kinds", () => {
    expect(buildRemoveMember(CHANNEL, AGENT, AT).kind).toBe(9001);
    expect(buildJoin(CHANNEL, AT).kind).toBe(9021);
    expect(buildLeave(CHANNEL, AT).kind).toBe(9022);
  });

  it("lowercases a pubkey rather than rejecting it, as the Rust builders do", () => {
    const tags = buildAddMember(CHANNEL, AGENT.toUpperCase(), undefined, AT).tags;
    expect(tags[1]).toEqual(["p", AGENT]);
  });

  it("rejects a malformed pubkey or channel id before signing", () => {
    expect(() => buildAddMember(CHANNEL, "nope", undefined, AT)).toThrow(EventBuildError);
    expect(() => buildAddMember("not-a-uuid", AGENT, undefined, AT)).toThrow(EventBuildError);
  });
});

describe("channel creation", () => {
  it("is kind:9007 with optional tags appended only when supplied", () => {
    const bare = buildCreateChannel(CHANNEL, "general", {}, AT);
    expect(bare.kind).toBe(9007);
    expect(bare.tags).toEqual([["h", CHANNEL], ["name", "general"]]);

    const full = buildCreateChannel(
      CHANNEL,
      "general",
      { visibility: "private", channelType: "forum", about: "why", ttlSeconds: 60 },
      AT,
    );
    expect(full.tags).toEqual([
      ["h", CHANNEL],
      ["name", "general"],
      ["visibility", "private"],
      ["channel_type", "forum"],
      ["about", "why"],
      ["ttl", "60"],
    ]);
  });

  it("canonicalizes the name the way buzz_core does", () => {
    expect(canonicalChannelName("  #general  ")).toBe("general");
    expect(() => canonicalChannelName("###")).toThrow(EventBuildError);
  });
});

describe("profile and presence", () => {
  it("serializes only the profile fields actually supplied", () => {
    const event = buildProfile({ display_name: "Release Bot", about: undefined }, AT);
    expect(JSON.parse(event.content)).toEqual({ display_name: "Release Bot" });
    expect(event.kind).toBe(0);
  });

  it("presence is kind:20001 with the status in both content and tag", () => {
    expect(buildPresenceUpdate("away", AT)).toEqual({
      kind: 20001,
      tags: [["status", "away"]],
      content: "away",
      created_at: AT,
    });
  });
});

describe("attaching a NIP-OA auth tag", () => {
  const tag = ["auth", "a".repeat(64), "kind=1", "b".repeat(128)] as unknown as AuthTag;

  it("appends the tag without mutating the original template", () => {
    const original = buildPresenceUpdate("online", AT);
    const attested = attachAuthTag(original, tag);
    expect(attested.tags).toHaveLength(2);
    expect(original.tags).toHaveLength(1);
  });

  it("refuses a second auth tag instead of overwriting the first", () => {
    const once = attachAuthTag(buildPresenceUpdate("online", AT), tag);
    expect(() => attachAuthTag(once, tag)).toThrow(AuthTagError);
  });
});
