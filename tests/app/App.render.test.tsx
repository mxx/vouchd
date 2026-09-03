// @vitest-environment jsdom

/**
 * A mount test, not a UI test.
 *
 * Typechecking cannot catch a component that throws on first render — a bad
 * import, a hook called conditionally, an effect that explodes when
 * IndexedDB is missing. Those show up as a white screen, which is the one
 * failure mode a purely unit-tested app still ships happily. This renders
 * the real composition root against a fake IndexedDB and asserts the panels
 * are actually there.
 */

import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "@/app/App";
import { applyMutations, openReadModel } from "@/readmodel/db";

afterEach(cleanup);

describe("App mounts", () => {
  it("renders every panel without throwing", async () => {
    render(<App />);
    expect(await screen.findByRole("heading", { name: "vouchd" })).toBeDefined();
    for (const panel of [
      "Community",
      "Owner key",
      "Authorize a member",
      "Channels",
      "Create a channel",
      "Add to a channel",
      "Members",
    ]) {
      expect(screen.getByRole("heading", { name: new RegExp(panel) })).toBeDefined();
    }
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

  it("shows the empty-directory copy before any agent is observed", () => {
    render(<App />);
    // Both the members and channels panels start their empty copy with
    // "None observed yet." -- matching only that would find two elements,
    // so this asserts on the rest of the sentence, which is unique to
    // members.
    expect(screen.getByText(/owner attestation/)).toBeDefined();
  });

  // Seeds a channel directly into the read model (rather than going through
  // a relay event), so this has to run last: nothing resets the shared fake
  // IndexedDB afterward, and the app's own db connection never closes mid-
  // test, so a reset here would hang waiting for a connection that outlives
  // the test. Every other test in this file asserts an *empty* directory,
  // which only holds if it runs before this one.
  it("drills into a channel's own detail via its View button, then back", async () => {
    const channelId = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
    const memberPubkey = "c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5";
    const db = await openReadModel();
    await applyMutations(db, [
      {
        store: "channels",
        op: "put",
        value: {
          channelId,
          name: "general",
          visibility: "open",
          channelType: "text",
          about: "General chat",
          observedAt: 1_700_000_000,
        },
      },
      {
        store: "members",
        op: "put",
        value: { channelId, pubkey: memberPubkey, role: "bot", observedAt: 1_700_000_100 },
      },
    ]);

    render(<App />);
    // "general" also appears as an <option> in MembershipPanel's channel
    // picker, so this waits on the table cell specifically.
    await screen.findByRole("cell", { name: "general" });

    fireEvent.click(screen.getByRole("button", { name: "View" }));
    expect(await screen.findByRole("heading", { name: "Channel: general" })).toBeDefined();
    expect(screen.getByText(channelId)).toBeDefined();
    expect(screen.getByText("bot")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /Back to channels/ }));
    expect(await screen.findByRole("heading", { name: "Channels (1)" })).toBeDefined();
  });

  // Reuses the "general" channel seeded by the test above -- this file's
  // fake IndexedDB is shared and never reset, so ordering after it is what
  // makes that data available here rather than a fresh empty store.
  it("offers a known agent not yet in the selected channel, filling the pubkey field on pick", async () => {
    const channelId = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
    const agentPubkey = "d4f3c2b1a0d4f3c2b1a0d4f3c2b1a0d4f3c2b1a0d4f3c2b1a0d4f3c2b1a0d4f3";
    const db = await openReadModel();
    await applyMutations(db, [
      {
        store: "agents",
        op: "put",
        value: {
          pubkey: agentPubkey,
          ownerPubkey: "0".repeat(64),
          conditions: "kind=1",
          displayName: "Release Bot",
          observedAt: 1_700_000_200,
        },
      },
    ]);

    render(<App />);
    await screen.findByRole("option", { name: "general" });
    fireEvent.change(screen.getByLabelText("Channel"), { target: { value: channelId } });

    const knownAgentSelect = screen.getByLabelText("Known agent") as HTMLSelectElement;
    await screen.findByRole("option", { name: "Release Bot" });
    fireEvent.change(knownAgentSelect, { target: { value: agentPubkey } });

    const pubkeyField = screen.getByLabelText("Pubkey to add") as HTMLInputElement;
    expect(pubkeyField.value).toBe(agentPubkey);
    // The picker is a one-shot shortcut, not a bound value -- it resets to
    // its own placeholder rather than tracking what it just filled.
    expect(knownAgentSelect.value).toBe("");
  });
});
