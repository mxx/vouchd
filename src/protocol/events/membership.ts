/**
 * Channel membership events.
 *
 * Tag shapes ported from `buzz-sdk/src/builders.rs` (build_add_member,
 * build_remove_member, build_join, build_leave). The `h` tag carries the
 * channel id and `p` the target pubkey — this is Buzz's convention, not
 * generic NIP-28, so don't "correct" it toward another chat NIP.
 *
 * Who may publish these is the relay's decision, not ours: a third-party add
 * is checked against the target's `channel_add_policy` (kind:10100), while a
 * self-add (`join`) takes a different path. We build the event; the relay
 * accepts or rejects it. Failing loudly on rejection beats pre-guessing a
 * policy we don't hold.
 */

import {
  KIND_ADD_MEMBER,
  KIND_JOIN_CHANNEL,
  KIND_LEAVE_CHANNEL,
  KIND_REMOVE_MEMBER,
} from "../kinds";
import { type EventTemplate, type MemberRole, nowSeconds } from "./types";
import { assertChannelId, normalizePubkey } from "./validate";

/** Add someone else to a channel. An agent joins as role "bot". */
export function buildAddMember(
  channelId: string,
  targetPubkey: string,
  role?: MemberRole,
  createdAt: number = nowSeconds(),
): EventTemplate {
  const tags = [
    ["h", assertChannelId(channelId)],
    ["p", normalizePubkey(targetPubkey, "target_pubkey")],
  ];
  if (role) tags.push(["role", role]);
  return { kind: KIND_ADD_MEMBER, tags, content: "", created_at: createdAt };
}

/** Remove someone else from a channel. */
export function buildRemoveMember(
  channelId: string,
  targetPubkey: string,
  createdAt: number = nowSeconds(),
): EventTemplate {
  return {
    kind: KIND_REMOVE_MEMBER,
    tags: [
      ["h", assertChannelId(channelId)],
      ["p", normalizePubkey(targetPubkey, "target_pubkey")],
    ],
    content: "",
    created_at: createdAt,
  };
}

/** Join a channel as the signing key itself (self-add). */
export function buildJoin(channelId: string, createdAt: number = nowSeconds()): EventTemplate {
  return {
    kind: KIND_JOIN_CHANNEL,
    tags: [["h", assertChannelId(channelId)]],
    content: "",
    created_at: createdAt,
  };
}

/** Leave a channel as the signing key itself (self-remove). */
export function buildLeave(channelId: string, createdAt: number = nowSeconds()): EventTemplate {
  return {
    kind: KIND_LEAVE_CHANNEL,
    tags: [["h", assertChannelId(channelId)]],
    content: "",
    created_at: createdAt,
  };
}
