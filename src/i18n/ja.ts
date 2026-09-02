/**
 * Japanese strings. Kept in the same shape as en.ts (enforced by
 * `Messages`) so a missing or mis-shaped translation is a `tsc -b`
 * failure, never a runtime blank.
 */

import type { Messages } from "./messages";

export const ja: Messages = {
  app: {
    title: "vouchd",
    tagline: "エージェントがどこで動いていても、あなたのコミュニティで発言できるよう認可します。",
    noBackend: "バックエンドはありません。エージェントが秘密鍵をここに渡すこともありません。",
  },
  identity: {
    readOnly: "署名用の拡張機能が未接続です:読み取り専用です。",
    awaitingPermission: "拡張機能を検出しました。許可待ちです。",
    signingAs: (short) => `${short} として署名中…`,
  },
  nav: {
    groupIdentity: "アイデンティティ",
    groupAgents: "メンバー",
    groupChannels: "チャンネル",
    community: "コミュニティ",
    ownerKey: "オーナー鍵",
    register: "メンバーを認可",
    agents: "メンバー一覧",
    createChannel: "チャンネルを作成",
    membership: "チャンネルに追加",
    channelList: "チャンネル一覧",
    languageLabel: "言語",
  },
  community: {
    title: "コミュニティ",
    relayUrlLabel: "リレー URL",
    relayUrlPlaceholder: "wss://relay.example",
    signInAsLabel: "サインイン方法",
    nip07Option: "ブラウザ拡張機能(NIP-07)",
    ownerKeyOption: "オーナー鍵(署名時にパスフレーズが必要)",
    connect: "接続",
    disconnect: "切断",
    status: (status) => `状態:${status}`,
    relaySays: (notice) => `リレーからの通知:${notice}`,
    authReason: "コミュニティのリレーにサインインする",
  },
  ownerKey: {
    title: "オーナー鍵",
    storedPrefix: "このブラウザに暗号化して保存済み:",
    decryptHint: "attestation に署名する瞬間だけ復号し、その後すぐに消去します。",
    forget: "この鍵を削除",
    caveat:
      "Attestation は event ではない前提データに対する生の Schnorr 署名であり、NIP-07 拡張機能では" +
      "生成できません。だからこそこの鍵はここに置く必要があります——保存時は暗号化し、署名する瞬間" +
      "だけ復号します。すでに暗号化された鍵(ncryptsec)を貼り付けた場合はそのまま保存され、以下の" +
      "パスフレーズは検証にのみ使われ、再暗号化はされません。",
    secretLabel: "オーナーの秘密鍵(64桁の hex、nsec、または暗号化済みの ncryptsec)",
    passphraseLabel: "パスフレーズ(暗号化用、または貼り付けた ncryptsec のロック解除用)",
    store: "オーナー鍵を保存",
  },
  register: {
    title: "メンバーを認可",
    pubkeyLabel: "メンバーの公開鍵(hex または npub)",
    pubkeyPlaceholder: "運用者が生成した鍵——秘密鍵ではありません",
    expiresLabel: "有効期間(日数、0 で無期限)",
    submit: "attestation に署名",
    giveToPrefix: "この鍵の運用者にこれを渡してください——それは彼らの署名環境に組み込まれ(例:",
    giveToSuffix: ")、彼らが署名するイベントに添付されます。",
    auditPublished: "リレーの監査ログに記録されました。",
    auditNotConnected: "未接続——この操作はリレーに記録されませんでした。",
    auditFailedIntro: "リレーの監査ログへの記録に失敗しました:",
    reasonNew: (short) => `${short}… の attestation に署名する`,
    reasonRenew: (short) => `${short}… の更新された attestation に署名する`,
  },
  conditions: {
    none: "制限なし:どのイベントにも有効で、期限もありません。",
    onlyKind: (kind) => `kind ${kind} のイベントのみ。`,
    onlyBefore: (iso) => `${iso} より前の日時のイベントのみ。`,
    onlyAfter: (iso) => `${iso} より後の日時のイベントのみ。`,
    expiryCaveat:
      "有効期限が制約するのはエージェント自身がイベントに記すタイムスタンプなので、行儀の良い検証者" +
      "だけを縛り、乗っ取られたエージェントは縛りません。NIP-OA に失効の仕組みはありません:信頼を" +
      "早く取り消したい場合は、短い有効期間を発行し、更新を止めてください。",
  },
  createChannel: {
    title: "チャンネルを作成",
    nameLabel: "名前",
    namePlaceholder: "general",
    visibilityLabel: "公開設定",
    openOption: "公開——検索可能で、招待なしで参加できます",
    privateOption: "非公開——招待制です",
    submit: "チャンネルを作成",
    createdPrefix: "作成しました。チャンネル ID:",
  },
  membership: {
    title: "チャンネルに追加",
    noExtensionCaveat:
      "公開するには NIP-07 拡張機能を接続してください。attestation には不要です。メンバーシップの" +
      "変更はあなた自身の身元で署名されます。",
    channelLabel: "チャンネル",
    noChannelsOption: "まだチャンネルが見つかっていません",
    chooseChannelOption: "チャンネルを選択",
    pubkeyLabel: "追加する公開鍵",
    roleLabel: "役割",
    submit: "チャンネルに追加",
    done: "リレーがメンバーシップイベントを受理しました。",
  },
  channels: {
    emptyTitle: "チャンネル",
    empty: "まだチャンネルが見つかっていません。誰かがチャンネル作成イベントを公開すると、ここに表示されます。",
    title: (count) => `チャンネル(${count})`,
    colName: "名前",
    colVisibility: "公開設定",
    colType: "種類",
    colAbout: "説明",
    unset: "—",
    view: "表示",
  },
  channelDetail: {
    title: (name) => `チャンネル:${name}`,
    back: "チャンネル一覧に戻る",
    idLabel: "チャンネル ID:",
    visibilityLabel: "公開設定:",
    typeLabel: "種類:",
    aboutLabel: "説明:",
    firstSeen: (when) => `${when} に初めて観測`,
    membersTitle: (count) => `メンバー(${count})`,
    noMembers: "まだメンバーが見つかっていません。",
    colMember: "メンバー",
    colRole: "役割",
    colFirstSeen: "初回確認",
  },
  agents: {
    emptyTitle: "メンバー",
    empty: "まだメンバーが見つかっていません。有効なオーナー attestation を含むプロフィールが公開されると、ここに表示されます。",
    title: (count) => `メンバー(${count})`,
    colName: "名前",
    colChannel: "チャンネル",
    colAuthorizedBy: "認可者",
    colStatus: "状態",
    unnamed: "名前未設定",
    avatarUnavailable:
      "アバターを表示できません:このリレーのメディアホストが、あなたのブラウザへのこの画像の提供を拒否しました。",
    noChannels: "(なし)",
    notSeen: "未確認",
    presenceHint: "リレーの180秒のウィンドウ内でプレゼンスが確認できません",
    lastSeen: (when) => `最終確認:${when}`,
    reauthorize: "再認可",
  },
  audit: {
    title: (short) => `監査ログ:${short}`,
    empty: "このリレー上でこのエージェントの認可操作はまだ記録されていません。",
    colWhen: "日時",
    colAction: "操作",
    colAuthorizedBy: "認可者",
    colConditions: "条件",
    none: "(なし)",
  },
  passphrasePrompt: {
    title: "オーナーのパスフレーズ",
    label: "パスフレーズ",
    unlock: "ロック解除",
    cancel: "キャンセル",
  },
  stats: {
    onlineNow: "現在オンライン",
    totalAgents: "エージェント総数",
    relay: "リレー",
    ownerKey: "オーナー鍵",
    locked: "ロック中",
    empty: "未設定",
  },
};
