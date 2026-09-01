import { describe, expect, it } from "vitest";
import { computeAuthTag } from "@/protocol/nipOA";
import type { SignedEvent } from "@/protocol/relayMessages";
import { projectEvent } from "@/readmodel/projector";
import { effectivePresence, PRESENCE_TTL_SECONDS } from "@/readmodel/presence";

const OWNER_SECRET = "0000000000000000000000000000000000000000000000000000000000000001";
const OWNER_PUBKEY = "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";
const AGENT_PUBKEY = "c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5";
const CHANNEL = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const AT = 1_700_000_000;

function event(overrides: Partial<SignedEvent>): SignedEvent {
  return {
    id: "a".repeat(64),
    pubkey: AGENT_PUBKEY,
    created_at: AT,
    kind: 1,
    tags: [],
    content: "",
    sig: "c".repeat(128),
    ...overrides,
  };
}

function agentProfile(content: string, conditions = "kind=1"): SignedEvent {
  const authTag = computeAuthTag(OWNER_SECRET, AGENT_PUBKEY, conditions);
  return event({ kind: 0, content, tags: [[...authTag]] });
}

describe("agents are discovered from verified attestations, not claims", () => {
  it("records an agent whose profile carries a valid auth tag", () => {
    const mutations = projectEvent(agentProfile(JSON.stringify({ display_name: "Release Bot" })));
    expect(mutations).toEqual([
      {
        store: "agents",
        op: "put",
        value: {
          pubkey: AGENT_PUBKEY,
          ownerPubkey: OWNER_PUBKEY,
          conditions: "kind=1",
          displayName: "Release Bot",
          picture: undefined,
          about: undefined,
          observedAt: AT,
        },
      },
    ]);
  });

  it("ignores a profile with no auth tag — that's just a person", () => {
    expect(projectEvent(event({ kind: 0, content: "{}" }))).toEqual([]);
  });

  it("ignores a forged auth tag rather than recording unverified provenance", () => {
    const forged = computeAuthTag(OWNER_SECRET, AGENT_PUBKEY, "kind=1");
    const tampered = [...forged];
    tampered[3] = "0".repeat(128);
    expect(projectEvent(event({ kind: 0, content: "{}", tags: [tampered] }))).toEqual([]);
  });

  it("still records the agent when its profile metadata is unparseable", () => {
    const mutations = projectEvent(agentProfile("not json"));
    expect(mutations).toHaveLength(1);
    expect(mutations[0]).toMatchObject({ value: { ownerPubkey: OWNER_PUBKEY } });
  });

  it("keeps the conditions the owner actually signed", () => {
    const mutations = projectEvent(agentProfile("{}", "kind=1&created_at<1913957000"));
    expect(mutations[0]).toMatchObject({ value: { conditions: "kind=1&created_at<1913957000" } });
  });
});

describe("channels", () => {
  it("projects a create-channel event", () => {
    const created = event({
      kind: 9007,
      tags: [
        ["h", CHANNEL],
        ["name", "general"],
        ["visibility", "private"],
      ],
    });
    expect(projectEvent(created)).toEqual([
      {
        store: "channels",
        op: "put",
        value: {
          channelId: CHANNEL,
          name: "general",
          visibility: "private",
          channelType: undefined,
          about: undefined,
          observedAt: AT,
        },
      },
    ]);
  });

  it("ignores a malformed create-channel event missing its name", () => {
    expect(projectEvent(event({ kind: 9007, tags: [["h", CHANNEL]] }))).toEqual([]);
  });
});

describe("membership", () => {
  it("adds the p-tagged pubkey with its role", () => {
    const added = event({
      kind: 9000,
      tags: [["h", CHANNEL], ["p", AGENT_PUBKEY], ["role", "bot"]],
    });
    expect(projectEvent(added)).toEqual([
      {
        store: "members",
        op: "put",
        value: { channelId: CHANNEL, pubkey: AGENT_PUBKEY, role: "bot", observedAt: AT },
      },
    ]);
  });

  it("removes the p-tagged pubkey on kind:9001", () => {
    const removed = event({ kind: 9001, tags: [["h", CHANNEL], ["p", AGENT_PUBKEY]] });
    expect(projectEvent(removed)).toEqual([
      { store: "members", op: "delete", channelId: CHANNEL, pubkey: AGENT_PUBKEY },
    ]);
  });

  it("treats join/leave as acting on the signer itself, not a p tag", () => {
    const joined = projectEvent(event({ kind: 9021, tags: [["h", CHANNEL]] }));
    expect(joined[0]).toMatchObject({ op: "put", value: { pubkey: AGENT_PUBKEY } });
    const left = projectEvent(event({ kind: 9022, tags: [["h", CHANNEL]] }));
    expect(left[0]).toMatchObject({ op: "delete", pubkey: AGENT_PUBKEY });
  });
});

describe("presence", () => {
  it("projects the status tag", () => {
    const seen = event({ kind: 20001, tags: [["status", "online"]], content: "online" });
    expect(projectEvent(seen)).toEqual([
      { store: "presence", op: "put", value: { pubkey: AGENT_PUBKEY, status: "online", observedAt: AT } },
    ]);
  });

  it("expires to unknown past the relay's TTL, rather than showing a stale dot", () => {
    const record = { pubkey: AGENT_PUBKEY, status: "online", observedAt: AT };
    expect(effectivePresence(record, AT + PRESENCE_TTL_SECONDS)).toBe("online");
    expect(effectivePresence(record, AT + PRESENCE_TTL_SECONDS + 1)).toBe("unknown");
  });

  it("distinguishes never-heard-of from explicitly offline", () => {
    expect(effectivePresence(undefined, AT)).toBe("unknown");
    expect(effectivePresence({ pubkey: AGENT_PUBKEY, status: "offline", observedAt: AT }, AT)).toBe(
      "offline",
    );
  });
});

describe("audit log", () => {
  function auditEvent(
    action: string,
    conditions = "kind=1",
    signerPubkey: string = OWNER_PUBKEY,
  ): SignedEvent {
    const authTag = computeAuthTag(OWNER_SECRET, AGENT_PUBKEY, conditions);
    return event({
      kind: 7373,
      pubkey: signerPubkey,
      tags: [["p", AGENT_PUBKEY], ["action", action], [...authTag]],
    });
  }

  it("records a register entry, keyed by the owner the auth tag actually names", () => {
    expect(projectEvent(auditEvent("register"))).toEqual([
      {
        store: "auditLog",
        op: "put",
        value: {
          id: "a".repeat(64),
          agentPubkey: AGENT_PUBKEY,
          ownerPubkey: OWNER_PUBKEY,
          action: "register",
          conditions: "kind=1",
          observedAt: AT,
        },
      },
    ]);
  });

  it("accepts renew the same way", () => {
    expect(projectEvent(auditEvent("renew"))[0]).toMatchObject({ value: { action: "renew" } });
  });

  it("ignores an unrecognized action", () => {
    expect(projectEvent(auditEvent("revoke"))).toEqual([]);
  });

  it("ignores an entry signed by a key other than the one its own auth tag names as owner", () => {
    expect(projectEvent(auditEvent("register", "kind=1", AGENT_PUBKEY))).toEqual([]);
  });

  it("ignores an entry with no auth tag to serve as evidence", () => {
    const stripped = auditEvent("register");
    stripped.tags = stripped.tags.filter((tag) => tag[0] !== "auth");
    expect(projectEvent(stripped)).toEqual([]);
  });
});

describe("everything else", () => {
  it("projects nothing for kinds this app does not model", () => {
    expect(projectEvent(event({ kind: 9, content: "a chat message" }))).toEqual([]);
  });
});
