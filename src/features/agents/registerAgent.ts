/**
 * The one use case this whole app exists for: an owner attests to an agent.
 *
 * What happens here is deliberately small — unlock the owner key just long
 * enough to sign, mint the tag, hand it back. What does NOT happen here is
 * as important:
 *
 * - No key is generated for the agent. The agent's operator generates it,
 *   wherever the agent runs; this app never sees an agent's secret.
 * - Nothing is published on the agent's behalf. A kind:0 profile is authored
 *   by the key it describes, so only the agent can publish its own. We hand
 *   the operator a string; their agent attaches it to its own events.
 * - The optional channel-add step is a separate, later act by the operator's
 *   own key, not part of minting — which is why it isn't in this function.
 */

import { computeAuthTag } from "../../protocol/nipOA";
import type { AuthTag } from "../../protocol/nipOA";
import type { OwnerKeystore } from "../../signer/ownerKeystore";
import { buildConditions, type ConditionsDraft } from "./conditionsBuilder";

export interface RegisterAgentRequest {
  agentPubkey: string;
  conditions: ConditionsDraft;
  passphrase: string;
}

export interface RegisterAgentResult {
  authTag: AuthTag;
  /** Ready to paste into the agent's environment, e.g. BUZZ_AUTH_TAG. */
  authTagJson: string;
  ownerPubkey: string;
  conditions: string;
}

export async function registerAgent(
  keystore: OwnerKeystore,
  request: RegisterAgentRequest,
): Promise<RegisterAgentResult> {
  const conditions = buildConditions(request.conditions);
  const authTag = await keystore.withOwnerSecret(request.passphrase, (ownerSecret) =>
    computeAuthTag(ownerSecret, request.agentPubkey.trim().toLowerCase(), conditions),
  );
  return {
    authTag,
    authTagJson: JSON.stringify(authTag),
    ownerPubkey: authTag[1],
    conditions,
  };
}
