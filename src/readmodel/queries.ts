/**
 * Typed reads for the UI.
 *
 * These return plain records and never reach the network: if something isn't
 * here, the answer is "we haven't observed it", which the caller should
 * render as such rather than as absence-in-the-world. The distinction
 * matters most for presence (see presence.ts).
 */

import type { ReadModelDb } from "./db";
import { effectivePresence, type EffectivePresence } from "./presence";
import type { AgentRecord, AuditRecord, ChannelRecord, MemberRecord, ProfileRecord } from "./records";

export async function listAgents(db: ReadModelDb): Promise<AgentRecord[]> {
  return db.getAll("agents");
}

export async function getAgent(db: ReadModelDb, pubkey: string): Promise<AgentRecord | undefined> {
  return db.get("agents", pubkey);
}

/** Agents this owner has attested. The owner pubkey came from a verified signature. */
export async function listAgentsByOwner(
  db: ReadModelDb,
  ownerPubkey: string,
): Promise<AgentRecord[]> {
  const agents = await db.getAll("agents");
  return agents.filter((agent) => agent.ownerPubkey === ownerPubkey);
}

export async function listChannels(db: ReadModelDb): Promise<ChannelRecord[]> {
  return db.getAll("channels");
}

export async function listMembers(db: ReadModelDb, channelId: string): Promise<MemberRecord[]> {
  const members = await db.getAll("members");
  return members.filter((member) => member.channelId === channelId);
}

export async function presenceOf(
  db: ReadModelDb,
  pubkey: string,
  nowSeconds: number,
): Promise<EffectivePresence> {
  return effectivePresence(await db.get("presence", pubkey), nowSeconds);
}

/** The audit trail for one agent, oldest first -- a permanent history, not just the latest state. */
export async function listAuditEntries(db: ReadModelDb, agentPubkey: string): Promise<AuditRecord[]> {
  const entries = await db.getAll("auditLog");
  return entries
    .filter((entry) => entry.agentPubkey === agentPubkey)
    .sort((a, b) => a.observedAt - b.observedAt);
}

/** Every pubkey we've seen a valid kind:0 for -- agent or not. */
export async function listProfiles(db: ReadModelDb): Promise<ProfileRecord[]> {
  return db.getAll("profiles");
}
