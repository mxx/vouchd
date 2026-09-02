/**
 * The shape every language's dictionary must satisfy.
 *
 * TypeScript enforces completeness here the same way `AuthTag`'s 4-tuple
 * enforces shape elsewhere (AGENTS.md rule "types encode invariants") -- a
 * language file missing a key, or shipping the wrong parameter list for
 * one, fails `tsc -b`, not a runtime lookup with a silently blank label.
 *
 * Parameterized strings are functions, not `{{placeholder}}` templates:
 * this app has no template engine, and a function signature is itself the
 * documentation of what a string needs to render (rule 1). Deliberately
 * flat and grouped by the component that owns each string, not by grammar
 * (no shared "buttons.submit") -- two panels' submit buttons happen to
 * both say "Sign attestation" or "Create channel" in English, but they are
 * different ideas that a translator must be free to render differently.
 *
 * Out of scope for this dictionary, on purpose: thrown `Error` messages
 * from the protocol/signer layers (`KeystoreError`, `SessionError`,
 * `ConditionsError`, `KeyFormatError`, ...). Translating exception text
 * well needs error *codes* the UI maps to copy, not string translation of
 * whatever `.message` happens to say -- a larger, separate piece of work.
 * Those still surface in English via `<ErrorText>` regardless of the
 * chosen UI language.
 */

export interface Messages {
  app: {
    title: string;
    tagline: string;
    noBackend: string;
  };
  identity: {
    readOnly: string;
    awaitingPermission: string;
    signingAs: (short: string) => string;
  };
  nav: {
    groupIdentity: string;
    groupAgents: string;
    groupChannels: string;
    community: string;
    ownerKey: string;
    register: string;
    agents: string;
    createChannel: string;
    membership: string;
    channelList: string;
    languageLabel: string;
  };
  community: {
    title: string;
    relayUrlLabel: string;
    relayUrlPlaceholder: string;
    signInAsLabel: string;
    nip07Option: string;
    ownerKeyOption: string;
    connect: string;
    disconnect: string;
    status: (status: string) => string;
    relaySays: (notice: string) => string;
    authReason: string;
  };
  ownerKey: {
    title: string;
    storedPrefix: string;
    decryptHint: string;
    forget: string;
    caveat: string;
    secretLabel: string;
    passphraseLabel: string;
    store: string;
  };
  register: {
    title: string;
    pubkeyLabel: string;
    pubkeyPlaceholder: string;
    expiresLabel: string;
    submit: string;
    giveToPrefix: string;
    giveToSuffix: string;
    auditPublished: string;
    auditNotConnected: string;
    auditFailedIntro: string;
    reasonNew: (short: string) => string;
    reasonRenew: (short: string) => string;
  };
  conditions: {
    none: string;
    onlyKind: (kind: number) => string;
    onlyBefore: (iso: string) => string;
    onlyAfter: (iso: string) => string;
    expiryCaveat: string;
  };
  createChannel: {
    title: string;
    nameLabel: string;
    namePlaceholder: string;
    visibilityLabel: string;
    openOption: string;
    privateOption: string;
    submit: string;
    createdPrefix: string;
  };
  membership: {
    title: string;
    noExtensionCaveat: string;
    channelLabel: string;
    noChannelsOption: string;
    chooseChannelOption: string;
    pubkeyLabel: string;
    roleLabel: string;
    submit: string;
    done: string;
  };
  channels: {
    emptyTitle: string;
    empty: string;
    title: (count: number) => string;
    colName: string;
    colVisibility: string;
    colType: string;
    colAbout: string;
    unset: string;
  };
  agents: {
    emptyTitle: string;
    empty: string;
    title: (count: number) => string;
    colName: string;
    colChannel: string;
    colAuthorizedBy: string;
    colStatus: string;
    unnamed: string;
    noChannels: string;
    notSeen: string;
    presenceHint: string;
    lastSeen: (when: string) => string;
    reauthorize: string;
  };
  audit: {
    title: (short: string) => string;
    empty: string;
    colWhen: string;
    colAction: string;
    colAuthorizedBy: string;
    colConditions: string;
    none: string;
  };
  passphrasePrompt: {
    title: string;
    label: string;
    unlock: string;
    cancel: string;
  };
  stats: {
    onlineNow: string;
    totalAgents: string;
    relay: string;
    ownerKey: string;
    locked: string;
    empty: string;
  };
}

export type Language = "en" | "zh";
export const LANGUAGES: Language[] = ["en", "zh"];

/**
 * Each language's own name, in its own script -- shown in the picker
 * regardless of which language is currently active (the standard
 * convention: a Chinese reader picking "English" from a dropdown should
 * see "English", not a translation of the word). Kept beside `LANGUAGES`
 * rather than inside `Messages`: it is not something the active language
 * translates, it is data about the roster itself.
 */
export const LANGUAGE_LABELS: Record<Language, string> = {
  en: "English",
  zh: "简体中文",
};
