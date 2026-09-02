/**
 * Traditional Chinese strings. Kept in the same shape as en.ts (enforced
 * by `Messages`) so a missing or mis-shaped translation is a `tsc -b`
 * failure, never a runtime blank. Wording follows zh.ts (Simplified)
 * sentence for sentence -- this is a script variant of the same
 * translation, not an independently-worded one, so the two stay in sync.
 */

import type { Messages } from "./messages";

export const zhHant: Messages = {
  app: {
    title: "vouchd",
    tagline: "為你的社群成員授權發言——無論它們執行在哪裡。",
    noBackend: "沒有後端伺服器,也永遠不會把私鑰交給這裡。",
  },
  identity: {
    readOnly: "未連接簽名擴充功能:唯讀模式。",
    awaitingPermission: "已偵測到擴充功能,等待授權。",
    signingAs: (short) => `以 ${short} 身分簽名…`,
  },
  nav: {
    groupIdentity: "身分",
    groupAgents: "成員",
    groupChannels: "頻道",
    community: "社群",
    ownerKey: "Owner 金鑰",
    register: "授權成員",
    agents: "成員清單",
    createChannel: "建立頻道",
    membership: "加入頻道",
    channelList: "頻道清單",
    languageLabel: "語言",
  },
  community: {
    title: "社群",
    relayUrlLabel: "Relay 位址",
    relayUrlPlaceholder: "wss://relay.example",
    signInAsLabel: "登入身分",
    nip07Option: "瀏覽器擴充功能(NIP-07)",
    ownerKeyOption: "Owner 金鑰(簽名時需要密碼)",
    connect: "連線",
    disconnect: "中斷連線",
    status: (status) => `狀態:${status}`,
    relaySays: (notice) => `Relay 提示:${notice}`,
    authReason: "登入社群 relay",
  },
  ownerKey: {
    title: "Owner 金鑰",
    storedPrefix: "已加密保存在此瀏覽器中:",
    decryptHint: "僅在簽署 attestation 的瞬間解密,隨後立即清除。",
    forget: "忘記此金鑰",
    caveat:
      "Attestation 是對非 event 原始資料的 Schnorr 簽名,NIP-07 擴充功能無法產生這種簽名。這就是" +
      "為什麼這把金鑰必須留在本地——靜態加密儲存,僅在簽名瞬間解密。貼上一個已加密的金鑰" +
      "(ncryptsec)會原樣保存;下面的密碼只用於驗證,不會重新加密。",
    secretLabel: "Owner 私鑰(64 位元 hex、nsec,或已加密的 ncryptsec)",
    passphraseLabel: "密碼(用於加密,或解鎖貼上的 ncryptsec)",
    store: "儲存 Owner 金鑰",
  },
  register: {
    title: "授權成員",
    pubkeyLabel: "成員公鑰(hex 或 npub)",
    pubkeyPlaceholder: "由其操作者產生的公鑰——絕不是私鑰",
    expiresLabel: "有效期(天數,0 表示永不過期)",
    submit: "簽署 attestation",
    giveToPrefix: "把這個交給該公鑰的操作者——它會被放進其簽名環境(例如",
    giveToSuffix: "),並附加到它自己簽名的事件上。",
    auditPublished: "已記錄到 relay 的稽核日誌。",
    auditNotConnected: "未連接——此操作未被記錄到 relay。",
    auditFailedIntro: "未能記錄到 relay 的稽核日誌:",
    reasonNew: (short) => `為 ${short}… 簽署 attestation`,
    reasonRenew: (short) => `為 ${short}… 簽署續期 attestation`,
  },
  conditions: {
    none: "無限制:對任何事件有效,永不過期。",
    onlyKind: (kind) => `僅限 kind ${kind} 的事件。`,
    onlyBefore: (iso) => `僅限時間早於 ${iso} 的事件。`,
    onlyAfter: (iso) => `僅限時間晚於 ${iso} 的事件。`,
    expiryCaveat:
      "過期時間約束的是 agent 自己在事件上聲明的時間戳記,因此它只能約束遵守規則的驗證方,而非" +
      "已被攻破的 agent。NIP-OA 沒有撤銷機制:若想更快收回信任,應簽發更短的窗口並停止續期。",
  },
  createChannel: {
    title: "建立頻道",
    nameLabel: "名稱",
    namePlaceholder: "general",
    visibilityLabel: "可見性",
    openOption: "公開——可被搜尋,無需邀請即可加入",
    privateOption: "私密——僅限邀請",
    submit: "建立頻道",
    createdPrefix: "已建立。頻道 ID:",
  },
  membership: {
    title: "加入頻道",
    noExtensionCaveat:
      "需要連接 NIP-07 擴充功能才能發布。簽署 attestation 不需要它;而頻道成員異動是以你自己的" +
      "身分簽名的。",
    channelLabel: "頻道",
    noChannelsOption: "尚未發現任何頻道",
    chooseChannelOption: "選擇一個頻道",
    pubkeyLabel: "要新增的公鑰",
    roleLabel: "角色",
    submit: "加入頻道",
    done: "Relay 已接受此成員異動事件。",
  },
  channels: {
    emptyTitle: "頻道",
    empty: "尚未發現任何頻道。一旦有人發布建立頻道事件,就會出現在這裡。",
    title: (count) => `頻道(${count})`,
    colName: "名稱",
    colVisibility: "可見性",
    colType: "類型",
    colAbout: "簡介",
    unset: "—",
  },
  agents: {
    emptyTitle: "成員",
    empty: "尚未發現任何成員。一旦某個 pubkey 發布了帶有有效 owner attestation 的 profile,就會出現在這裡。",
    title: (count) => `成員(${count})`,
    colName: "名稱",
    colChannel: "頻道",
    colAuthorizedBy: "授權方",
    colStatus: "狀態",
    unnamed: "未命名",
    avatarUnavailable: "頭像無法顯示:此 relay 的媒體伺服器拒絕向你的瀏覽器提供這張圖片。",
    noChannels: "(無)",
    notSeen: "未見",
    presenceHint: "在 relay 180 秒視窗內未觀測到上線狀態",
    lastSeen: (when) => `最後上線:${when}`,
    reauthorize: "重新授權",
  },
  audit: {
    title: (short) => `稽核紀錄:${short}`,
    empty: "此 agent 在該 relay 上暫無授權紀錄。",
    colWhen: "時間",
    colAction: "操作",
    colAuthorizedBy: "授權方",
    colConditions: "條件",
    none: "(無)",
  },
  passphrasePrompt: {
    title: "Owner 密碼",
    label: "密碼",
    unlock: "解鎖",
    cancel: "取消",
  },
  stats: {
    onlineNow: "目前在線",
    totalAgents: "Agent 總數",
    relay: "Relay",
    ownerKey: "Owner 金鑰",
    locked: "已鎖定",
    empty: "未設定",
  },
};
