import { describe, expect, it } from "vitest";
import { finalizeEvent } from "nostr-tools/pure";
import { hexToBytes } from "@noble/hashes/utils";
import { computeAuthTag } from "@/protocol/nipOA";
import type { SignedEvent } from "@/protocol/relayMessages";
import { projectEvent } from "@/readmodel/projector";
import { effectivePresence, PRESENCE_TTL_SECONDS } from "@/readmodel/presence";

const OWNER_SECRET = "0000000000000000000000000000000000000000000000000000000000000001";
const OWNER_PUBKEY = "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";
const AGENT_SECRET = "0000000000000000000000000000000000000000000000000000000000000002";
const AGENT_PUBKEY = "c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5";
const CHANNEL = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const AT = 1_700_000_000;

const OWNER_SECRET_BYTES = hexToBytes(OWNER_SECRET);
const AGENT_SECRET_BYTES = hexToBytes(AGENT_SECRET);

type EventOverrides = Partial<Pick<SignedEvent, "created_at" | "kind" | "tags" | "content">>;

function event(overrides: EventOverrides, signer = AGENT_SECRET_BYTES): SignedEvent {
  return finalizeEvent({
    created_at: AT,
    kind: 1,
    tags: [],
    content: "",
    ...overrides,
  }, Uint8Array.from(signer)) as SignedEvent;
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

  it("records a plain profile (no auth tag) into `profiles`, not `agents` — that's just a person", () => {
    const mutations = projectEvent(event({ kind: 0, content: JSON.stringify({ name: "Alice" }) }));
    expect(mutations).toEqual([
      {
        store: "profiles",
        op: "put",
        value: {
          pubkey: AGENT_PUBKEY,
          displayName: "Alice",
          picture: undefined,
          about: undefined,
          observedAt: AT,
        },
      },
    ]);
  });

  it("ignores a forged auth tag rather than recording unverified provenance", () => {
    const forged = computeAuthTag(OWNER_SECRET, AGENT_PUBKEY, "kind=1");
    const tampered = [...forged];
    tampered[3] = "0".repeat(128);
    expect(projectEvent(event({ kind: 0, content: "{}", tags: [tampered] }))).toEqual([]);
  });

  it("ignores a profile whose Nostr event signature is invalid", () => {
    const forged = agentProfile("{}");
    forged.sig = "0".repeat(128);
    expect(projectEvent(forged)).toEqual([]);
  });

  it("ignores an event whose id is not its canonical hash", () => {
    const forged = agentProfile("{}");
    forged.id = "0".repeat(64);
    expect(projectEvent(forged)).toEqual([]);
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

  it("projects an archive event (kind:9002) into the separate channelArchive store", () => {
    const archived = event({ kind: 9002, tags: [["h", CHANNEL], ["archived", "true"]] });
    expect(projectEvent(archived)).toEqual([
      { store: "channelArchive", op: "put", value: { channelId: CHANNEL, archived: true, observedAt: AT } },
    ]);
  });

  it("unarchive is the same kind with the tag flipped, not a different kind", () => {
    const unarchived = event({ kind: 9002, tags: [["h", CHANNEL], ["archived", "false"]] });
    expect(projectEvent(unarchived)[0]).toMatchObject({ value: { archived: false } });
  });

  it("ignores a kind:9002 event with no archived tag -- not one of ours", () => {
    expect(projectEvent(event({ kind: 9002, tags: [["h", CHANNEL]] }))).toEqual([]);
  });

  it("deletes the channel record on kind:9008, same shape as membership's remove/leave", () => {
    const deleted = event({ kind: 9008, tags: [["h", CHANNEL]] });
    expect(projectEvent(deleted)).toEqual([{ store: "channels", op: "delete", channelId: CHANNEL }]);
  });

  it("ignores a kind:9008 event with no h tag", () => {
    expect(projectEvent(event({ kind: 9008, tags: [] }))).toEqual([]);
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
      tags: [["p", AGENT_PUBKEY], ["action", action], [...authTag]],
    }, signerPubkey === OWNER_PUBKEY ? OWNER_SECRET_BYTES : AGENT_SECRET_BYTES);
  }

  it("records a register entry, keyed by the owner the auth tag actually names", () => {
    expect(projectEvent(auditEvent("register"))).toEqual([
      {
        store: "auditLog",
        op: "put",
        value: {
          id: expect.stringMatching(/^[0-9a-f]{64}$/),
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
    // Signed from scratch without an auth tag -- mutating tags on an
    // already-signed event would invalidate its own Nostr signature and get
    // caught by isValidNostrEvent() instead, never reaching the check this
    // test means to exercise (projectAuditEntry's own "no auth tag" guard).
    const noAuthTag = event(
      { kind: 7373, tags: [["p", AGENT_PUBKEY], ["action", "register"]] },
      OWNER_SECRET_BYTES,
    );
    expect(projectEvent(noAuthTag)).toEqual([]);
  });
});

describe("a relay's roster snapshot (kind:39002) is trusted only from the relay", () => {
  /** The relay signs its own snapshots; here AGENT_SECRET stands in for that
   *  key, so AGENT_PUBKEY is what NIP-11 would advertise as `self`. */
  function roster(members: string[][], signer = AGENT_SECRET_BYTES): SignedEvent {
    return event(
      { kind: 39002, tags: [["d", CHANNEL], ...members] },
      signer,
    );
  }

  it("projects the whole roster, with the role each `p` tag carries", () => {
    const mutations = projectEvent(
      roster([
        ["p", OWNER_PUBKEY, "", "owner"],
        ["p", AGENT_PUBKEY, "", "bot"],
      ]),
      AGENT_PUBKEY,
    );
    expect(mutations).toEqual([
      {
        store: "channelRoster",
        op: "put",
        value: {
          channelId: CHANNEL,
          observedAt: AT,
          members: [
            { channelId: CHANNEL, pubkey: OWNER_PUBKEY, observedAt: AT, role: "owner" },
            { channelId: CHANNEL, pubkey: AGENT_PUBKEY, observedAt: AT, role: "bot" },
          ],
        },
      },
    ]);
  });

  it("keeps a member whose role the relay left blank", () => {
    const mutations = projectEvent(roster([["p", OWNER_PUBKEY]]), AGENT_PUBKEY);
    expect(mutations[0]).toMatchObject({
      value: { members: [{ pubkey: OWNER_PUBKEY, channelId: CHANNEL }] },
    });
  });

  it("ignores a roster signed by anyone other than the relay -- 39002 is addressable, so a member can publish one about a channel they do not run", () => {
    expect(projectEvent(roster([["p", AGENT_PUBKEY, "", "owner"]]), OWNER_PUBKEY)).toEqual([]);
  });

  it("ignores every roster when the relay advertises no `self` to check against", () => {
    expect(projectEvent(roster([["p", AGENT_PUBKEY, "", "owner"]]))).toEqual([]);
  });

  it("ignores a roster with no channel to attach it to", () => {
    expect(projectEvent(event({ kind: 39002, tags: [["p", AGENT_PUBKEY]] }), AGENT_PUBKEY)).toEqual([]);
  });

  it("skips a `p` tag that is not a pubkey rather than storing a malformed member", () => {
    const mutations = projectEvent(
      roster([["p", "not-a-pubkey"], ["p", AGENT_PUBKEY, "", "bot"]]),
      AGENT_PUBKEY,
    );
    expect(mutations[0]).toMatchObject({ value: { members: [{ pubkey: AGENT_PUBKEY }] } });
  });
});

describe("everything else", () => {
  it("projects nothing for kinds this app does not model", () => {
    expect(projectEvent(event({ kind: 9, content: "a chat message" }))).toEqual([]);
  });
});
