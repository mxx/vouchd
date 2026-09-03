import { describe, expect, it } from "vitest";
import {
  attachAuthTag,
  AuthTagError,
  buildAddMember,
  buildAuditEntry,
  buildCreateChannel,
  buildDeleteChannel,
  buildJoin,
  buildLeave,
  buildPresenceUpdate,
  buildProfile,
  buildRemoveMember,
  buildSetChannelArchived,
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

describe("channel archive/unarchive and delete", () => {
  it("archive and unarchive are both kind:9002, differing only in the tag value", () => {
    expect(buildSetChannelArchived(CHANNEL, true, AT)).toEqual({
      kind: 9002,
      tags: [["h", CHANNEL], ["archived", "true"]],
      content: "",
      created_at: AT,
    });
    expect(buildSetChannelArchived(CHANNEL, false, AT).tags).toEqual([
      ["h", CHANNEL],
      ["archived", "false"],
    ]);
  });

  it("delete is kind:9008 with only the h tag", () => {
    expect(buildDeleteChannel(CHANNEL, AT)).toEqual({
      kind: 9008,
      tags: [["h", CHANNEL]],
      content: "",
      created_at: AT,
    });
  });

  it("rejects a malformed channel id before signing, same as create/membership", () => {
    expect(() => buildSetChannelArchived("not-a-uuid", true, AT)).toThrow(EventBuildError);
    expect(() => buildDeleteChannel("not-a-uuid", AT)).toThrow(EventBuildError);
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

describe("audit trail entries", () => {
  const authTag = ["auth", "a".repeat(64), "kind=1", "b".repeat(128)] as unknown as AuthTag;

  it("is kind:7373 carrying the agent, the action, and the auth tag as evidence", () => {
    expect(buildAuditEntry("register", AGENT, authTag, AT)).toEqual({
      kind: 7373,
      tags: [["p", AGENT], ["action", "register"], [...authTag]],
      content: "",
      created_at: AT,
    });
  });

  it("carries whichever action the caller asks for", () => {
    expect(buildAuditEntry("renew", AGENT, authTag, AT).tags[1]).toEqual(["action", "renew"]);
  });
});
