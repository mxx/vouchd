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

/** Joins in each channel's archived flag from the separate `channelArchive`
 *  store -- see ChannelRecord.archived for why that's a separate store
 *  rather than a field projectChannel() writes directly. */
export async function listChannels(db: ReadModelDb): Promise<ChannelRecord[]> {
  const [channels, archiveFlags] = await Promise.all([db.getAll("channels"), db.getAll("channelArchive")]);
  const archivedById = new Map(archiveFlags.map((flag) => [flag.channelId, flag.archived]));
  return channels.map((channel) => ({ ...channel, archived: archivedById.get(channel.channelId) ?? false }));
}

/**
 * Who is in each channel, preferring the relay's own roster snapshot
 * (kind:39002) over the memberships this client reconstructed from add/
 * remove events.
 *
 * The two are not equally good and shouldn't be merged. A snapshot is the
 * relay's complete answer at a moment in time, signed by its own key; the
 * `members` rows are whatever membership events happened to reach this
 * client, which the structural backfill limit alone can leave short -- and
 * for a member added before that window there is no event left to see. So a
 * channel with a snapshot uses it *instead of* those rows rather than in
 * addition to them: unioning would let a membership the relay no longer
 * reports survive underneath a roster that omits it.
 *
 * Channels with no snapshot keep the old behaviour, which is what a relay
 * that doesn't publish 39002 -- or one whose `self` key this app couldn't
 * read -- still gives us.
 */
async function effectiveMembers(db: ReadModelDb): Promise<MemberRecord[]> {
  const [members, rosters] = await Promise.all([db.getAll("members"), db.getAll("channelRoster")]);
  const snapshotted = new Set(rosters.map((roster) => roster.channelId));
  return [
    ...members.filter((member) => !snapshotted.has(member.channelId)),
    ...rosters.flatMap((roster) => roster.members),
  ];
}

export async function listMembers(db: ReadModelDb, channelId: string): Promise<MemberRecord[]> {
  const members = await effectiveMembers(db);
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

/**
 * Which channels (by name) each pubkey currently belongs to -- one pass over
 * both stores rather than a query per pubkey, since the agents directory
 * needs this for every row on every reload.
 */
export async function channelNamesByPubkey(db: ReadModelDb): Promise<Map<string, string[]>> {
  const [members, channels] = await Promise.all([effectiveMembers(db), db.getAll("channels")]);
  const nameById = new Map(channels.map((channel) => [channel.channelId, channel.name]));
  const result = new Map<string, string[]>();
  for (const member of members) {
    const name = nameById.get(member.channelId);
    if (!name) continue;
    const names = result.get(member.pubkey) ?? [];
    names.push(name);
    result.set(member.pubkey, names);
  }
  return result;
}
