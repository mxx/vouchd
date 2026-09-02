/**
 * Korean strings. Kept in the same shape as en.ts (enforced by
 * `Messages`) so a missing or mis-shaped translation is a `tsc -b`
 * failure, never a runtime blank.
 */

import type { Messages } from "./messages";

export const ko: Messages = {
  app: {
    title: "vouchd",
    tagline: "에이전트가 어디에서 실행되든 커뮤니티에서 발언할 수 있도록 인가합니다.",
    noBackend: "백엔드가 없습니다. 에이전트가 자신의 키를 여기에 넘기는 일도 없습니다.",
  },
  identity: {
    readOnly: "서명 확장 프로그램 없음: 읽기 전용입니다.",
    awaitingPermission: "확장 프로그램을 찾았습니다. 권한을 기다리는 중입니다.",
    signingAs: (short) => `${short}(으)로 서명 중…`,
  },
  nav: {
    groupIdentity: "신원",
    groupAgents: "멤버",
    groupChannels: "채널",
    community: "커뮤니티",
    ownerKey: "소유자 키",
    register: "멤버 인가",
    agents: "멤버 목록",
    createChannel: "채널 만들기",
    membership: "채널에 추가",
    channelList: "채널 목록",
    languageLabel: "언어",
  },
  community: {
    title: "커뮤니티",
    relayUrlLabel: "릴레이 URL",
    relayUrlPlaceholder: "wss://relay.example",
    signInAsLabel: "로그인 방식",
    nip07Option: "브라우저 확장 프로그램(NIP-07)",
    ownerKeyOption: "소유자 키(서명 시 암호문구 필요)",
    connect: "연결",
    disconnect: "연결 해제",
    status: (status) => `상태: ${status}`,
    relaySays: (notice) => `릴레이 알림: ${notice}`,
    authReason: "커뮤니티 릴레이에 로그인",
  },
  ownerKey: {
    title: "소유자 키",
    storedPrefix: "이 브라우저에 암호화되어 저장됨:",
    decryptHint: "attestation에 서명하는 순간에만 복호화되고, 즉시 삭제됩니다.",
    forget: "이 키 삭제",
    caveat:
      "Attestation은 이벤트가 아닌 원문 데이터에 대한 순수 Schnorr 서명이며, NIP-07 확장 프로그램은 " +
      "이를 생성할 수 없습니다. 그래서 이 키는 반드시 여기에 있어야 합니다 — 저장 시 암호화되고, " +
      "서명하는 순간에만 복호화됩니다. 이미 암호화된 키(ncryptsec)를 붙여넣으면 그대로 저장되며, " +
      "아래 암호문구는 검증에만 사용되고 다시 암호화하는 데는 쓰이지 않습니다.",
    secretLabel: "소유자 비밀 키(64자리 hex, nsec, 또는 암호화된 ncryptsec)",
    passphraseLabel: "암호문구(암호화용, 또는 붙여넣은 ncryptsec의 잠금 해제용)",
    store: "소유자 키 저장",
  },
  register: {
    title: "멤버 인가",
    pubkeyLabel: "멤버 공개 키(hex 또는 npub)",
    pubkeyPlaceholder: "운영자가 생성한 키 — 절대 비밀 키가 아닙니다",
    expiresLabel: "유효 기간(일수, 0은 무기한)",
    submit: "attestation 서명",
    giveToPrefix: "이것을 해당 키의 운영자에게 전달하세요 — 이는 그들의 서명 환경에 들어가며(예:",
    giveToSuffix: "), 그들이 서명하는 이벤트에 첨부됩니다.",
    auditPublished: "릴레이의 감사 기록에 저장되었습니다.",
    auditNotConnected: "연결되지 않음 — 이 작업은 릴레이에 기록되지 않았습니다.",
    auditFailedIntro: "릴레이의 감사 기록에 저장하지 못했습니다:",
    reasonNew: (short) => `${short}…의 attestation에 서명`,
    reasonRenew: (short) => `${short}…의 갱신된 attestation에 서명`,
  },
  conditions: {
    none: "제한 없음: 모든 이벤트에 유효하며 만료되지 않습니다.",
    onlyKind: (kind) => `kind ${kind} 이벤트에만 해당합니다.`,
    onlyBefore: (iso) => `${iso} 이전 날짜의 이벤트에만 해당합니다.`,
    onlyAfter: (iso) => `${iso} 이후 날짜의 이벤트에만 해당합니다.`,
    expiryCaveat:
      "만료는 에이전트가 자신의 이벤트에 스스로 기록하는 타임스탬프를 제한하므로, 규칙을 따르는 " +
      "검증자만 구속하며 이미 침해된 에이전트는 구속하지 못합니다. NIP-OA에는 철회 기능이 없습니다: " +
      "신뢰를 더 빨리 거두고 싶다면 짧은 기간으로 발급하고 갱신을 멈추세요.",
  },
  createChannel: {
    title: "채널 만들기",
    nameLabel: "이름",
    namePlaceholder: "general",
    visibilityLabel: "공개 범위",
    openOption: "공개 — 검색 가능하며 초대 없이 참여 가능",
    privateOption: "비공개 — 초대로만 참여 가능",
    submit: "채널 만들기",
    createdPrefix: "생성되었습니다. 채널 ID:",
  },
  membership: {
    title: "채널에 추가",
    noExtensionCaveat:
      "게시하려면 NIP-07 확장 프로그램을 연결하세요. attestation에는 필요 없습니다. 멤버십 변경은 " +
      "본인 신원으로 서명됩니다.",
    channelLabel: "채널",
    noChannelsOption: "아직 발견된 채널이 없습니다",
    chooseChannelOption: "채널 선택",
    pubkeyLabel: "추가할 공개 키",
    roleLabel: "역할",
    submit: "채널에 추가",
    done: "릴레이가 멤버십 이벤트를 수락했습니다.",
  },
  channels: {
    emptyTitle: "채널",
    empty: "아직 발견된 채널이 없습니다. 누군가 채널 생성 이벤트를 게시하면 여기에 표시됩니다.",
    title: (count) => `채널 (${count})`,
    colName: "이름",
    colVisibility: "공개 범위",
    colType: "유형",
    colAbout: "설명",
    unset: "—",
  },
  agents: {
    emptyTitle: "멤버",
    empty: "아직 발견된 멤버가 없습니다. 유효한 소유자 attestation을 포함한 프로필이 게시되면 여기에 표시됩니다.",
    title: (count) => `멤버 (${count})`,
    colName: "이름",
    colChannel: "채널",
    colAuthorizedBy: "인가자",
    colStatus: "상태",
    unnamed: "이름 없음",
    avatarUnavailable:
      "아바타를 사용할 수 없습니다: 이 릴레이의 미디어 호스트가 이 이미지를 브라우저에 제공하지 않았습니다.",
    noChannels: "(없음)",
    notSeen: "확인되지 않음",
    presenceHint: "릴레이의 180초 창 내에서 접속이 확인되지 않았습니다",
    lastSeen: (when) => `마지막 접속: ${when}`,
    reauthorize: "다시 인가",
  },
  audit: {
    title: (short) => `감사 기록: ${short}`,
    empty: "이 릴레이에서 이 에이전트에 대한 인가 기록이 아직 없습니다.",
    colWhen: "시간",
    colAction: "작업",
    colAuthorizedBy: "인가자",
    colConditions: "조건",
    none: "(없음)",
  },
  passphrasePrompt: {
    title: "소유자 암호문구",
    label: "암호문구",
    unlock: "잠금 해제",
    cancel: "취소",
  },
  stats: {
    onlineNow: "현재 온라인",
    totalAgents: "전체 에이전트 수",
    relay: "릴레이",
    ownerKey: "소유자 키",
    locked: "잠김",
    empty: "비어 있음",
  },
};
