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
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "@/app/App";

afterEach(cleanup);

describe("App mounts", () => {
  it("renders every panel without throwing", async () => {
    render(<App />);
    expect(await screen.findByRole("heading", { name: "vouchd" })).toBeDefined();
    for (const panel of [
      "Community",
      "Owner key",
      "Authorize an agent",
      "Create a channel",
      "Add to a channel",
      "Agents",
    ]) {
      expect(screen.getByRole("heading", { name: new RegExp(panel) })).toBeDefined();
    }
  });

  it("says it is read-only when no NIP-07 extension is present", () => {
    render(<App />);
    expect(screen.getByText(/No NIP-07 extension/)).toBeDefined();
  });

  it("starts disconnected with the connect button disabled until a URL is typed", () => {
    render(<App />);
    expect(screen.getByText(/Status: closed/)).toBeDefined();
    expect(screen.getByRole("button", { name: "Connect" }).hasAttribute("disabled")).toBe(true);
  });

  it("offers to store an owner key when the keystore is empty", async () => {
    render(<App />);
    expect(await screen.findByLabelText(/Owner secret key/)).toBeDefined();
    expect(screen.getByRole("button", { name: /Encrypt and store/ })).toBeDefined();
  });

  it("shows the empty-directory copy before any agent is observed", () => {
    render(<App />);
    expect(screen.getByText(/None observed yet/)).toBeDefined();
  });
});
