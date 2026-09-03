// @vitest-environment jsdom

/**
 * Two kinds of test live here, for two different failure modes.
 *
 * "App mounts" is the original mount test: typechecking cannot catch a
 * component that throws on first render -- a bad import, a hook called
 * conditionally, an effect that explodes when IndexedDB is missing -- so
 * this renders the real composition root against a fake IndexedDB and
 * confirms it comes up at all.
 *
 * "AppScreens" used to be covered by that same full-`<App/>` mount,
 * asserting every panel's heading was simultaneously visible -- true back
 * when the sidebar was pure anchor-scroll into one long page. It no longer
 * is: `AppScreens` now renders exactly one screen at a time, and every
 * screen but "identity" is reachable only once `useVouchdApp`'s `connected`
 * is true, which needs a real relay connection this suite has no fake
 * WebSocket to drive (`VouchdSession` doesn't accept an injectable one).
 * So these tests exercise `AppScreens` directly against a hand-built
 * `VouchdAppState` fixture instead of clicking through `Sidebar` -- the
 * gating itself is `Sidebar`'s job and is covered by Sidebar.test.tsx.
 */

import "fake-indexeddb/auto";
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App, AppScreens } from "@/app/App";
import type { Screen, VouchdAppState } from "@/app/useVouchdApp";
import { LanguageProvider } from "@/i18n";
import type { AgentRow } from "@/features/agents/AgentsPanel";
import type { ChannelRecord, MemberRecord } from "@/readmodel/records";
import { createMemoryStorage, OwnerKeystore } from "@/signer/ownerKeystore";

afterEach(cleanup);

/** Every field a screen might read, at its emptiest/disconnected values -- override per test. */
function buildApp(overrides: Partial<VouchdAppState> = {}): VouchdAppState {
  return {
    keystore: new OwnerKeystore(createMemoryStorage()),
    ownerPubkey: null,
    refreshOwnerPubkey: () => {},
    connection: {
      session: null,
      status: "closed",
      error: null,
      notice: null,
      canPublish: false,
      signer: undefined,
      historyMayBeIncomplete: false,
      relayUrl: null,
      connect: () => {},
      disconnect: () => {},
    },
    passphrasePrompt: { pending: null, requestPassphrase: async () => "" },
    rows: [],
    channels: [],
    nip07: { available: false, pubkey: null, error: null },
    focusedAgent: undefined,
    setFocusedAgent: () => {},
    auditEntries: [],
    focusedChannel: undefined,
    setFocusedChannel: () => {},
    channelMembers: [],
    profiles: new Map(),
    canPublish: false,
    publish: async () => {},
    activeScreen: "identity",
    setActiveScreen: () => {},
    connected: false,
    relayInfo: null,
    ...overrides,
  };
}

function renderScreen(app: VouchdAppState) {
  return render(
    <LanguageProvider>
      <AppScreens app={app} />
    </LanguageProvider>,
  );
}

/** Every panel heading `AppScreens` can show, so a "no others" assertion has a fixed list to check. */
const ALL_HEADINGS = [
  "Community",
  "Owner key",
  "Authorize a member",
  "Members",
  "Channels",
  "Create a channel",
  "Add to a channel",
];

function expectOnlyHeadings(...visible: string[]) {
  for (const heading of visible) {
    expect(screen.getByRole("heading", { name: heading })).toBeDefined();
  }
  for (const heading of ALL_HEADINGS) {
    if (!visible.includes(heading)) expect(screen.queryByRole("heading", { name: heading })).toBeNull();
  }
}

describe("App mounts", () => {
  it("renders without throwing", async () => {
    render(<App />);
    expect(await screen.findByRole("heading", { name: "vouchd" })).toBeDefined();
  });

  it("says it is read-only when no NIP-07 extension is present", () => {
    render(<App />);
    expect(screen.getByText(/No signing extension/)).toBeDefined();
  });

  it("starts disconnected with the connect button disabled until a URL is typed", () => {
    render(<App />);
    expect(screen.getByText(/Status: closed/)).toBeDefined();
    expect(screen.getByRole("button", { name: "Connect" }).hasAttribute("disabled")).toBe(true);
  });

  it("offers to store an owner key when the keystore is empty", async () => {
    render(<App />);
    expect(await screen.findByLabelText(/Owner secret key/)).toBeDefined();
    expect(screen.getByRole("button", { name: /Store owner key/ })).toBeDefined();
  });
});

describe("AppScreens", () => {
  const SCREEN_HEADINGS: Record<Screen, string[]> = {
    identity: ["Community", "Owner key"],
    register: ["Authorize a member"],
    agents: ["Members"],
    channels: ["Channels"],
    "create-channel": ["Create a channel"],
    membership: ["Add to a channel"],
  };

  for (const [screen_, headings] of Object.entries(SCREEN_HEADINGS) as [Screen, string[]][]) {
    it(`shows only the ${screen_} screen's own panel(s)`, () => {
      renderScreen(buildApp({ activeScreen: screen_ }));
      expectOnlyHeadings(...headings);
    });
  }

  it("shows the empty-directory copy on the agents screen before any member is observed", () => {
    renderScreen(buildApp({ activeScreen: "agents" }));
    // Members and Channels both start their empty copy with "None observed
    // yet." -- asserting the rest of the sentence is what's unique to Members.
    expect(screen.getByText(/owner attestation/)).toBeDefined();
  });

  it("drills into a channel's own detail via its View button, then back", () => {
    const channelId = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
    const memberPubkey = "c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5";
    const channel: ChannelRecord = {
      channelId,
      name: "general",
      visibility: "open",
      channelType: "text",
      about: "General chat",
      observedAt: 1_700_000_000,
    };
    const member: MemberRecord = { channelId, pubkey: memberPubkey, role: "bot", observedAt: 1_700_000_100 };

    // A thin stateful wrapper, standing in for useVouchdApp's own
    // focusedChannel state, so the click-through (View, then Back) behaves
    // exactly as it does wired into the real hook.
    function Wrapper() {
      const [focusedChannel, setFocusedChannel] = useState<string | undefined>(undefined);
      const app = buildApp({
        activeScreen: "channels",
        channels: [channel],
        channelMembers: focusedChannel ? [member] : [],
        focusedChannel,
        setFocusedChannel,
      });
      return <AppScreens app={app} />;
    }

    render(
      <LanguageProvider>
        <Wrapper />
      </LanguageProvider>,
    );
    expect(screen.getByRole("cell", { name: "general" })).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "View" }));
    expect(screen.getByRole("heading", { name: "Channel: general" })).toBeDefined();
    expect(screen.getByText(channelId)).toBeDefined();
    expect(screen.getByText("bot")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /Back to channels/ }));
    expect(screen.getByRole("heading", { name: "Channels (1)" })).toBeDefined();
  });

  it("offers a known agent not yet in the selected channel, filling the pubkey field on pick", () => {
    const channelId = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
    const agentPubkey = "d4f3c2b1a0d4f3c2b1a0d4f3c2b1a0d4f3c2b1a0d4f3c2b1a0d4f3c2b1a0d4f3";
    const channel: ChannelRecord = { channelId, name: "general", observedAt: 1_700_000_000 };
    const row: AgentRow = {
      agent: {
        pubkey: agentPubkey,
        ownerPubkey: "0".repeat(64),
        conditions: "kind=1",
        displayName: "Release Bot",
        observedAt: 1_700_000_200,
      },
      presence: "unknown",
      channelNames: [],
    };

    renderScreen(buildApp({ activeScreen: "membership", channels: [channel], rows: [row] }));

    fireEvent.change(screen.getByLabelText("Channel"), { target: { value: channelId } });
    const knownAgentSelect = screen.getByLabelText("Known agent") as HTMLSelectElement;
    fireEvent.change(knownAgentSelect, { target: { value: agentPubkey } });

    const pubkeyField = screen.getByLabelText("Pubkey to add") as HTMLInputElement;
    expect(pubkeyField.value).toBe(agentPubkey);
    // The picker is a one-shot shortcut, not a bound value -- it resets to
    // its own placeholder rather than tracking what it just filled.
    expect(knownAgentSelect.value).toBe("");
  });
});
