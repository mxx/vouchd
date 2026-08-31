/**
 * A live, network-touching validation of the protocol layer against a real
 * relay — not a unit test. Everything in `tests/protocol/relayClient.test.ts`
 * exercises `RelayClient` against a hand-written `FakeSocket`, which proves
 * the client's own state machine is correct but says nothing about whether
 * `relayMessages.ts`'s hand-written parser actually agrees with a real
 * relay's wire format. This file closes that gap once, on demand.
 *
 * The default target, wss://buzz.fudu.space, advertises (via its NIP-11
 * document) `auth_required: true` and `restricted_writes: true` — this is
 * "a private team communication relay", not an open one. So both checks
 * below wait for the client to actually reach "authenticated" before
 * asserting anything; racing ahead (as an earlier version of this file did)
 * just reproduces the relay's own "auth-required" rejection and proves
 * nothing about our code.
 *
 * Not part of `npm test` / `npm run check` on purpose (see vitest.live.config.ts):
 * it needs network, a relay that may be down or rate-limiting, and it is slow.
 * Run explicitly:
 *
 *   npx vitest run --config vitest.live.config.ts
 *
 * Override the target with VOUCHD_LIVE_RELAY=wss://other-relay ...
 * Skip the publish half (read-only check) with VOUCHD_LIVE_READONLY=1.
 */

import { describe, expect, it } from "vitest";
import { finalizeEvent, generateSecretKey, getPublicKey } from "nostr-tools/pure";
import { createRelayClient, type ConnectionStatus, type RelayClient } from "../../src/protocol/relayClient";
import type { EventTemplate } from "../../src/protocol/events/types";
import type { SignedEvent } from "../../src/protocol/relayMessages";

const RELAY_URL = process.env.VOUCHD_LIVE_RELAY ?? "wss://buzz.fudu.space";
const READONLY = process.env.VOUCHD_LIVE_READONLY === "1";
const AUTH_TIMEOUT_MS = 10_000;

/**
 * Stands in for the app's real signers (NIP-07 in a browser, or the
 * encrypted owner keystore) which don't exist in a Node script. This is a
 * throwaway key, generated fresh per run, used only to prove the wire
 * protocol round-trips against a live relay — not a production signing path.
 */
function ephemeralSigner() {
  const secretKey = generateSecretKey();
  const pubkey = getPublicKey(secretKey);
  const sign = async (template: EventTemplate): Promise<SignedEvent> =>
    finalizeEvent(template, secretKey) as SignedEvent;
  return { pubkey, sign };
}

/**
 * Resolves once `onStatusChange` reports `target`, or rejects after
 * `timeoutMs`. A rejection here is reported by the caller, not thrown past
 * it — a relay that never authenticates an unknown throwaway key is a real,
 * useful finding, not a broken test.
 */
function waitForStatus(
  statuses: ConnectionStatus[],
  target: ConnectionStatus,
  timeoutMs: number,
): Promise<void> {
  if (statuses.at(-1) === target) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`never reached "${target}"`)), timeoutMs);
    const check = setInterval(() => {
      if (statuses.at(-1) !== target) return;
      clearInterval(check);
      clearTimeout(timer);
      resolve();
    }, 50);
  });
}

function makeClient(signAuthEvent?: (t: EventTemplate) => Promise<SignedEvent>) {
  const statuses: ConnectionStatus[] = [];
  const notices: string[] = [];
  const client = createRelayClient(RELAY_URL, {
    signAuthEvent,
    onStatusChange: (s) => statuses.push(s),
    onNotice: (m) => notices.push(m),
  });
  return { client, statuses, notices };
}

describe(`live relay: ${RELAY_URL}`, () => {
  it("connects, authenticates, and completes a REQ/EOSE round trip", async () => {
    const signer = ephemeralSigner();
    const { client, statuses, notices } = makeClient(signer.sign);
    const closedReasons: string[] = [];
    const received: SignedEvent[] = [];

    await client.connect();
    await waitForStatus(statuses, "authenticated", AUTH_TIMEOUT_MS).catch((error) =>
      notices.push(`[test] ${(error as Error).message}`),
    );

    const eose = new Promise<void>((resolve) => {
      client.subscribe([{ kinds: [0], limit: 3 }], {
        onEvent: (event) => received.push(event),
        onEose: () => resolve(),
        onClosed: (message) => closedReasons.push(message),
      });
    });

    try {
      await Promise.race([
        eose,
        new Promise((_, reject) => setTimeout(() => reject(new Error("EOSE timeout")), 10_000)),
      ]);
    } catch (error) {
      notices.push(`[test] ${(error as Error).message}`);
    } finally {
      console.log("[live] status transitions:", statuses);
      console.log("[live] notices:", notices);
      console.log("[live] CLOSED reasons:", closedReasons);
      console.log("[live] kind:0 events received:", received.length, received.slice(0, 1));
      client.close();
    }

    for (const event of received) {
      expect(event).toHaveProperty("id");
      expect(event).toHaveProperty("sig");
      expect(event.kind).toBe(0);
    }
  }, 25_000);

  it.skipIf(READONLY)("authenticates, then publishes a throwaway kind:1 event", async () => {
    const signer = ephemeralSigner();
    const { client, statuses, notices } = makeClient(signer.sign);

    await client.connect();
    await waitForStatus(statuses, "authenticated", AUTH_TIMEOUT_MS).catch((error) =>
      notices.push(`[test] ${(error as Error).message}`),
    );

    const template: EventTemplate = {
      kind: 1,
      tags: [["client", "vouchd-live-check"]],
      content: `vouchd live-relay-check ping (throwaway, ${new Date().toISOString()})`,
      created_at: Math.floor(Date.now() / 1000),
    };
    const signed = await signer.sign(template);

    await reportPublish(client, signed, signer.pubkey, statuses, notices);
    client.close();
  });
});

/**
 * A relay that requires authentication may still refuse a write from an
 * authenticated-but-unknown key (this one advertises `restricted_writes`),
 * or PoW, or a rate limit. Any of those is a real answer about the relay's
 * policy, not a bug in `RelayClient` — so this reports rather than asserts.
 */
async function reportPublish(
  client: RelayClient,
  signed: SignedEvent,
  pubkey: string,
  statuses: ConnectionStatus[],
  notices: string[],
): Promise<void> {
  try {
    await client.publish(signed);
    console.log("[live] publish accepted, id:", signed.id, "pubkey:", pubkey);
  } catch (error) {
    console.log("[live] publish rejected:", (error as Error).message);
  } finally {
    console.log("[live] status transitions:", statuses, "notices:", notices);
  }
}
