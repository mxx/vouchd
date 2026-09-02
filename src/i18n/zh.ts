/**
 * Simplified Chinese strings. Kept in the same shape as en.ts (enforced by
 * `Messages`) so a missing or mis-shaped translation is a `tsc -b` failure,
 * never a runtime blank.
 */

import type { Messages } from "./messages";

export const zh: Messages = {
  app: {
    title: "vouchd",
    tagline: "为你的社区中的 agent 授权发言——无论它们运行在哪里。",
    noBackend: "没有后端服务器,agent 也永远不会把私钥交给这里。",
  },
  identity: {
    readOnly: "未连接 NIP-07 扩展:只读模式。",
    awaitingPermission: "已检测到扩展,等待授权。",
    signingAs: (short) => `以 ${short} 身份签名…`,
  },
  nav: {
    groupIdentity: "身份",
    groupAgents: "Agent",
    groupChannels: "频道",
    community: "社区",
    ownerKey: "Owner 密钥",
    register: "授权成员",
    agents: "Agent 列表",
    createChannel: "创建频道",
    membership: "加入频道",
    languageLabel: "语言",
  },
  community: {
    title: "社区",
    relayUrlLabel: "Relay 地址",
    relayUrlPlaceholder: "wss://relay.example",
    signInAsLabel: "登录身份",
    nip07Option: "浏览器扩展(NIP-07)",
    ownerKeyOption: "Owner 密钥(签名时需要密码)",
    connect: "连接",
    disconnect: "断开",
    status: (status) => `状态:${status}`,
    relaySays: (notice) => `Relay 提示:${notice}`,
    authReason: "登录社区 relay",
  },
  ownerKey: {
    title: "Owner 密钥",
    storedPrefix: "已加密保存在此浏览器中:",
    decryptHint: "仅在签署 attestation 的瞬间解密,随后立即清除。",
    forget: "忘记此密钥",
    caveat:
      "Attestation 是对非 event 原始数据的 Schnorr 签名,NIP-07 扩展无法生成这种签名。这就是为什么" +
      "这把密钥必须留在本地——静态加密存储,仅在签名瞬间解密。粘贴一个已加密的密钥(ncryptsec)会" +
      "原样保存;下面的密码只用于校验,不会重新加密。",
    secretLabel: "Owner 私钥(64 位 hex、nsec,或已加密的 ncryptsec)",
    passphraseLabel: "密码(用于加密,或解锁粘贴的 ncryptsec)",
    store: "保存 Owner 密钥",
  },
  register: {
    title: "授权成员",
    pubkeyLabel: "成员公钥(hex 或 npub)",
    pubkeyPlaceholder: "由其运营者生成的公钥——绝不是私钥",
    expiresLabel: "有效期(天数,0 表示永不过期)",
    submit: "签署 attestation",
    giveToPrefix: "把这个交给该公钥的运营者——它会被放进其签名环境(例如",
    giveToSuffix: "),并附加到它自己签名的事件上。",
    auditPublished: "已记录到 relay 的审计日志。",
    auditNotConnected: "未连接——此操作未被记录到 relay。",
    auditFailedIntro: "未能记录到 relay 的审计日志:",
    reasonNew: (short) => `为 ${short}… 签署 attestation`,
    reasonRenew: (short) => `为 ${short}… 签署续期 attestation`,
  },
  conditions: {
    none: "无限制:对任何事件有效,永不过期。",
    onlyKind: (kind) => `仅限 kind ${kind} 的事件。`,
    onlyBefore: (iso) => `仅限时间早于 ${iso} 的事件。`,
    onlyAfter: (iso) => `仅限时间晚于 ${iso} 的事件。`,
    expiryCaveat:
      "过期时间约束的是 agent 自己在事件上声明的时间戳,因此它只能约束遵守规则的验证方,而非已被" +
      "攻破的 agent。NIP-OA 没有撤销机制:若想更快收回信任,应签发更短的窗口并停止续期。",
  },
  createChannel: {
    title: "创建频道",
    nameLabel: "名称",
    namePlaceholder: "general",
    visibilityLabel: "可见性",
    openOption: "公开——可被搜索,无需邀请即可加入",
    privateOption: "私密——仅限邀请",
    submit: "创建频道",
    createdPrefix: "已创建。频道 ID:",
  },
  membership: {
    title: "加入频道",
    noExtensionCaveat:
      "需要连接 NIP-07 扩展才能发布。签署 attestation 不需要它;而频道成员变更是以你自己的身份" +
      "签名的。",
    channelLabel: "频道",
    noChannelsOption: "尚未发现任何频道",
    chooseChannelOption: "选择一个频道",
    pubkeyLabel: "要添加的公钥",
    roleLabel: "角色",
    submit: "加入频道",
    done: "Relay 已接受此成员变更事件。",
  },
  agents: {
    emptyTitle: "Agent",
    empty: "尚未发现任何 agent。一旦某个 agent 发布了携带有效 owner attestation 的 profile,就会出现在这里。",
    title: (count) => `Agent(${count})`,
    colName: "名称",
    colMember: "成员",
    colAuthorizedBy: "授权方",
    colStatus: "状态",
    unnamed: "未命名",
    notSeen: "未见",
    presenceHint: "在 relay 180 秒窗口内未观测到在线状态",
    reauthorize: "重新授权",
  },
  audit: {
    title: (short) => `审计记录:${short}`,
    empty: "此 agent 在该 relay 上暂无授权记录。",
    colWhen: "时间",
    colAction: "操作",
    colAuthorizedBy: "授权方",
    colConditions: "条件",
    none: "(无)",
  },
  passphrasePrompt: {
    title: "Owner 密码",
    label: "密码",
    unlock: "解锁",
    cancel: "取消",
  },
  stats: {
    onlineNow: "当前在线",
    totalAgents: "Agent 总数",
    relay: "Relay",
    ownerKey: "Owner 密钥",
    locked: "已锁定",
    empty: "未设置",
  },
};
