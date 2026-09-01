/**
 * The full NIP-OA round trip against a real relay: an owner key mints an
 * attestation for a throwaway agent key, and this checks whether the
 * relay's AUTH handler actually grants that agent relay access on the
 * strength of it — the exact mechanism `events/auth.ts` documents, but
 * nothing until now has exercised against a live relay. Everything else in
 * `tests/live/relayLive.check.ts` only proved that an *unrecognized* key
 * gets refused; this proves whether a *properly authorized* one gets in.
 *
 * Needs an owner secret key the target relay already recognizes as a
 * member/owner. NEVER hardcode one here — pass it only as an environment
 * variable at run time, so it never touches a file or git history:
 *
 *   VOUCHD_OWNER_NSEC=nsec1... npx vitest run --config vitest.live.config.ts -t "owner-minted"
 *
 * (a 64-char hex secret works too). Without VOUCHD_OWNER_NSEC set, this
 * file skips itself — there's nothing useful to check without a real key.
 */
import { describe, it } from "vitest";
import { nip19 } from "nostr-tools";
import { finalizeEvent, generateSecretKey, getPublicKey } from "nostr-tools/pure";
import { computeAuthTag } from "../../src/protocol/nipOA";
import { createRelayClient, type ConnectionStatus } from "../../src/protocol/relayClient";
import type { EventTemplate } from "../../src/protocol/events/types";
import type { SignedEvent } from "../../src/protocol/relayMessages";

const RELAY_URL = process.env.VOUCHD_LIVE_RELAY ?? "wss://buzz.fudu.space";
const OWNER_SECRET_INPUT = process.env.VOUCHD_OWNER_NSEC;

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

/** Accepts either bech32 `nsec1...` or raw 64-char hex, since both are common. */
function decodeOwnerSecret(input: string): Uint8Array {
  if (!input.startsWith("nsec1")) return hexToBytes(input);
  const decoded = nip19.decode(input);
  if (decoded.type !== "nsec") throw new Error(`expected an nsec, got: ${decoded.type}`);
  return decoded.data;
}

/** Same polling wait used in relayLive.check.ts — no fake timers here, this is real network. */
function waitForStatus(
  statuses: ConnectionStatus[],
  target: ConnectionStatus,
  timeoutMs: number,
): Promise<void> {
  if (statuses.at(-1) === target) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`never reached "${target}"`)), timeoutMs);
    const poll = setInterval(() => {
      if (statuses.at(-1) !== target) return;
      clearInterval(poll);
      clearTimeout(timer);
      resolve();
    }, 50);
  });
}

async function reportOwnerAuthedPublish(
  client: ReturnType<typeof createRelayClient>,
  agentSecret: Uint8Array,
  agentPubkey: string,
  statuses: ConnectionStatus[],
  notices: string[],
): Promise<void> {
  const template: EventTemplate = {
    kind: 1,
    tags: [["client", "vouchd-owner-auth-check"]],
    content: `vouchd owner-authorized agent ping (throwaway, ${new Date().toISOString()})`,
    created_at: Math.floor(Date.now() / 1000),
  };
  const signed = finalizeEvent(template, agentSecret) as SignedEvent;
  try {
    await client.publish(signed);
    console.log("[live] owner-authorized agent publish ACCEPTED. agent pubkey:", agentPubkey);
  } catch (error) {
    console.log("[live] owner-authorized agent publish rejected:", (error as Error).message);
  } finally {
    console.log("[live] status transitions:", statuses, "notices:", notices);
  }
}

describe.skipIf(!OWNER_SECRET_INPUT)("live relay: owner-minted NIP-OA attestation", () => {
  it(
    "lets an owner-authorized throwaway agent authenticate and publish",
    async () => {
      const ownerSecret = decodeOwnerSecret(OWNER_SECRET_INPUT as string);
      const agentSecret = generateSecretKey();
      const agentPubkey = getPublicKey(agentSecret);
      const authTag = computeAuthTag(ownerSecret, agentPubkey, "kind=1");

      const statuses: ConnectionStatus[] = [];
      const notices: string[] = [];
      const client = createRelayClient(RELAY_URL, {
        authTag,
        signAuthEvent: async (template) => finalizeEvent(template, agentSecret) as SignedEvent,
        onStatusChange: (s) => statuses.push(s),
        onNotice: (m) => notices.push(m),
      });

      await client.connect();
      await waitForStatus(statuses, "authenticated", 10_000).catch((error) =>
        notices.push(`[test] ${(error as Error).message}`),
      );

      await reportOwnerAuthedPublish(client, agentSecret, agentPubkey, statuses, notices);
      client.close();
    },
    20_000,
  );
});
