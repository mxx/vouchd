import { describe, expect, it } from "vitest";
import { verifyAuthTag } from "@/protocol/nipOA";
import { createMemoryStorage, OwnerKeystore } from "@/signer/ownerKeystore";
import { buildConditions, describeConditions } from "@/features/agents/conditionsBuilder";
import { en } from "@/i18n/en";
import { registerAgent } from "@/features/agents/registerAgent";

const OWNER_SECRET = "0000000000000000000000000000000000000000000000000000000000000001";
const OWNER_PUBKEY = "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";
const AGENT_PUBKEY = "c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5";
const PASSPHRASE = "correct horse battery staple";

async function loadedKeystore() {
  const keystore = new OwnerKeystore(createMemoryStorage());
  await keystore.store(OWNER_SECRET, PASSPHRASE);
  return keystore;
}

describe("buildConditions", () => {
  it("emits clauses in a fixed order, because order is part of the signature", () => {
    const conditions = buildConditions({
      expiresAt: new Date("2027-01-01T00:00:00Z"),
      kind: 1,
      notBefore: new Date("2026-01-01T00:00:00Z"),
    });
    expect(conditions).toBe("kind=1&created_at>1767225600&created_at<1798761600");
  });

  it("produces an empty string for an unrestricted grant", () => {
    expect(buildConditions({})).toBe("");
  });
});

describe("describeConditions", () => {
  it("renders each clause in words", () => {
    expect(describeConditions("kind=1&created_at<1798761600", en.conditions)).toEqual([
      "Only events of kind 1.",
      "Only events dated before 2027-01-01T00:00:00.000Z.",
    ]);
  });

  it("says plainly when a grant is unrestricted", () => {
    expect(describeConditions("", en.conditions)[0]).toMatch(/No restrictions/);
  });
});

describe("registerAgent", () => {
  it("mints a tag that verifies against the agent it was issued for", async () => {
    const keystore = await loadedKeystore();
    const result = await registerAgent(keystore, {
      agentPubkey: AGENT_PUBKEY,
      conditions: { kind: 1 },
      passphrase: PASSPHRASE,
    });
    expect(result.ownerPubkey).toBe(OWNER_PUBKEY);
    expect(result.conditions).toBe("kind=1");
    expect(verifyAuthTag(result.authTag, AGENT_PUBKEY)).toBe(OWNER_PUBKEY);
    expect(JSON.parse(result.authTagJson)[0]).toBe("auth");
  });

  it("accepts an uppercase pubkey pasted from another tool", async () => {
    const keystore = await loadedKeystore();
    const result = await registerAgent(keystore, {
      agentPubkey: `  ${AGENT_PUBKEY.toUpperCase()}  `,
      conditions: {},
      passphrase: PASSPHRASE,
    });
    expect(verifyAuthTag(result.authTag, AGENT_PUBKEY)).toBe(OWNER_PUBKEY);
  });

  it("accepts an npub, since that is what every Nostr client actually shows", async () => {
    const keystore = await loadedKeystore();
    const result = await registerAgent(keystore, {
      agentPubkey: "npub1ccz8l9zpa47k6vz9gphftsrumpw80rjt3nhnefat4symjhrsnmjs38mnyd",
      conditions: {},
      passphrase: PASSPHRASE,
    });
    expect(verifyAuthTag(result.authTag, AGENT_PUBKEY)).toBe(OWNER_PUBKEY);
  });

  it("fails on a wrong passphrase without producing a tag", async () => {
    const keystore = await loadedKeystore();
    await expect(
      registerAgent(keystore, {
        agentPubkey: AGENT_PUBKEY,
        conditions: {},
        passphrase: "nope",
      }),
    ).rejects.toThrow(/wrong passphrase/);
  });
});
