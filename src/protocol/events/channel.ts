/**
 * Channel creation.
 *
 * Ported from `buzz-sdk/src/builders.rs` (build_create_channel). The channel
 * id is supplied by the caller rather than generated here: Buzz treats it as
 * a client-chosen UUID, so a caller that wants to reference the channel
 * before the relay acknowledges it (optimistic UI, or adding members in the
 * same batch) already has the id in hand.
 */

import { KIND_CREATE_CHANNEL } from "../kinds";
import {
  type ChannelType,
  type ChannelVisibility,
  type EventTemplate,
  nowSeconds,
} from "./types";
import { assertChannelId, canonicalChannelName } from "./validate";

export interface CreateChannelOptions {
  visibility?: ChannelVisibility;
  channelType?: ChannelType;
  about?: string;
  /** Message retention in seconds. Omit for the community default. */
  ttlSeconds?: number;
}

export function buildCreateChannel(
  channelId: string,
  name: string,
  options: CreateChannelOptions = {},
  createdAt: number = nowSeconds(),
): EventTemplate {
  const tags = [
    ["h", assertChannelId(channelId)],
    ["name", canonicalChannelName(name)],
  ];
  if (options.visibility) tags.push(["visibility", options.visibility]);
  if (options.channelType) tags.push(["channel_type", options.channelType]);
  if (options.about) tags.push(["about", options.about]);
  if (options.ttlSeconds !== undefined) tags.push(["ttl", String(options.ttlSeconds)]);
  return { kind: KIND_CREATE_CHANNEL, tags, content: "", created_at: createdAt };
}
