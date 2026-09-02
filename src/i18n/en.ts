/**
 * English strings -- the source of truth for wording, not just one
 * translation among equals. Every string here is copied verbatim from what
 * the app already said before i18n existed, so the render/e2e tests that
 * assert on exact English copy keep passing unchanged: this file IS the
 * English the app has always spoken, just relocated.
 */

import type { Messages } from "./messages";

export const en: Messages = {
  app: {
    title: "vouchd",
    tagline: "Authorize agents to speak in your community, wherever they run.",
    noBackend: "No backend. No agent ever hands you its key.",
  },
  identity: {
    readOnly: "No NIP-07 extension: read-only.",
    awaitingPermission: "Extension found; awaiting permission.",
    signingAs: (short) => `Signing as ${short}…`,
  },
  nav: {
    groupIdentity: "Identity",
    groupAgents: "Members",
    groupChannels: "Channels",
    community: "Community",
    ownerKey: "Owner key",
    register: "Authorize a member",
    agents: "Member list",
    createChannel: "Create a channel",
    membership: "Add to a channel",
    channelList: "Channel list",
    languageLabel: "Language",
  },
  community: {
    title: "Community",
    relayUrlLabel: "Relay URL",
    relayUrlPlaceholder: "wss://relay.example",
    signInAsLabel: "Sign in as",
    nip07Option: "Browser extension (NIP-07)",
    ownerKeyOption: "Owner key (asks for its passphrase to sign)",
    connect: "Connect",
    disconnect: "Disconnect",
    status: (status) => `Status: ${status}`,
    relaySays: (notice) => `Relay says: ${notice}`,
    authReason: "sign in to the community relay",
  },
  ownerKey: {
    title: "Owner key",
    storedPrefix: "Encrypted in this browser:",
    decryptHint: "It is decrypted only for the moment an attestation is signed, then wiped.",
    forget: "Forget this key",
    caveat:
      "Attestations are raw Schnorr signatures over a non-event preimage, which a NIP-07 " +
      "extension cannot produce. That is why this key has to live here — encrypted at rest, " +
      "decrypted only for the instant it signs. Pasting an already-encrypted key (ncryptsec) " +
      "stores it as-is; the passphrase below is only checked, not re-applied.",
    secretLabel: "Owner secret key (64 hex, nsec, or an encrypted ncryptsec)",
    passphraseLabel: "Passphrase (to encrypt it with, or to unlock an ncryptsec paste)",
    store: "Store owner key",
  },
  register: {
    title: "Authorize a member",
    pubkeyLabel: "Member public key (hex or npub)",
    pubkeyPlaceholder: "the key its operator generated — never its secret",
    expiresLabel: "Valid for (days, 0 for no expiry)",
    submit: "Sign attestation",
    giveToPrefix: "Give this to whoever operates that key — it goes into their signing environment (e.g.",
    giveToSuffix: "), and gets attached to the events they sign.",
    auditPublished: "Recorded on the relay's audit trail.",
    auditNotConnected: "Not connected — this action was not recorded on the relay.",
    auditFailedIntro: "Could not record this on the relay's audit trail:",
    reasonNew: (short) => `sign an attestation for ${short}…`,
    reasonRenew: (short) => `sign a renewed attestation for ${short}…`,
  },
  conditions: {
    none: "No restrictions: valid for any event, with no expiry.",
    onlyKind: (kind) => `Only events of kind ${kind}.`,
    onlyBefore: (iso) => `Only events dated before ${iso}.`,
    onlyAfter: (iso) => `Only events dated after ${iso}.`,
    expiryCaveat:
      "Expiry constrains the timestamp an agent puts on its own events, so it binds " +
      "well-behaved verifiers, not a compromised agent. There is no revocation in " +
      "NIP-OA: to withdraw trust sooner, issue short windows and stop renewing them.",
  },
  createChannel: {
    title: "Create a channel",
    nameLabel: "Name",
    namePlaceholder: "general",
    visibilityLabel: "Visibility",
    openOption: "open — searchable, joinable without an invite",
    privateOption: "private — invite only",
    submit: "Create channel",
    createdPrefix: "Created. Channel id:",
  },
  membership: {
    title: "Add to a channel",
    noExtensionCaveat:
      "Connect a NIP-07 extension to publish. Attestations don't need one; membership " +
      "changes are signed as you.",
    channelLabel: "Channel",
    noChannelsOption: "no channels observed yet",
    chooseChannelOption: "choose a channel",
    pubkeyLabel: "Pubkey to add",
    roleLabel: "Role",
    submit: "Add to channel",
    done: "Relay accepted the membership event.",
  },
  channels: {
    emptyTitle: "Channels",
    empty: "None observed yet. A channel appears here once someone publishes a create-channel event.",
    title: (count) => `Channels (${count})`,
    colName: "Name",
    colVisibility: "Visibility",
    colType: "Type",
    colAbout: "About",
    unset: "—",
  },
  agents: {
    emptyTitle: "Members",
    empty: "None observed yet. A pubkey appears here once it publishes a profile carrying a valid owner attestation.",
    title: (count) => `Members (${count})`,
    colName: "Name",
    colChannel: "Channel",
    colAuthorizedBy: "Authorized by",
    colStatus: "Status",
    unnamed: "unnamed",
    avatarUnavailable:
      "Avatar unavailable: this relay's media host doesn't allow browsers to load pictures yet (a server-side CORS gap, not something retrying fixes).",
    noChannels: "(none)",
    notSeen: "not seen",
    presenceHint: "no presence within the relay's 180s window",
    lastSeen: (when) => `last seen ${when}`,
    reauthorize: "Re-authorize",
  },
  audit: {
    title: (short) => `Audit trail: ${short}`,
    empty: "No recorded authorization actions yet for this agent on this relay.",
    colWhen: "When",
    colAction: "Action",
    colAuthorizedBy: "Authorized by",
    colConditions: "Conditions",
    none: "(none)",
  },
  passphrasePrompt: {
    title: "Owner passphrase",
    label: "Passphrase",
    unlock: "Unlock",
    cancel: "Cancel",
  },
  stats: {
    onlineNow: "Online now",
    totalAgents: "Total agents",
    relay: "Relay",
    ownerKey: "Owner key",
    locked: "Locked",
    empty: "Empty",
  },
};
