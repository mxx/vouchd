// @vitest-environment jsdom

/**
 * Covers the gating `AppScreens`' own tests deliberately don't: that the
 * five non-identity nav buttons are actually disabled (and don't invoke
 * `onNavigate`) before a connection succeeds, and enabled once it has.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "@/shared/ui/Sidebar";
import type { Screen } from "@/app/useVouchdApp";
import { LanguageProvider } from "@/i18n";
import type { Nip07State } from "@/app/useNip07";

afterEach(cleanup);

const NIP07: Nip07State = { available: false, pubkey: null, error: null };

function renderSidebar(connected: boolean, onNavigate: (screen: Screen) => void) {
  return render(
    <LanguageProvider>
      <Sidebar activeScreen="identity" connected={connected} nip07={NIP07} onNavigate={onNavigate} />
    </LanguageProvider>,
  );
}

describe("Sidebar", () => {
  it("disables every screen but identity, and ignores clicks, before a connection succeeds", () => {
    const onNavigate = vi.fn();
    renderSidebar(false, onNavigate);

    expect(screen.getByRole("button", { name: /Community/ }).hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("button", { name: /Owner key/ }).hasAttribute("disabled")).toBe(false);

    for (const name of [/Member list/, /Authorize a member/, /Channel list/, /Create a channel/, /Add to a channel/]) {
      const button = screen.getByRole("button", { name });
      expect(button.hasAttribute("disabled")).toBe(true);
      fireEvent.click(button);
    }
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("enables every screen once connected, and clicking one navigates to it", () => {
    const onNavigate = vi.fn();
    renderSidebar(true, onNavigate);

    const registerButton = screen.getByRole("button", { name: /Authorize a member/ });
    expect(registerButton.hasAttribute("disabled")).toBe(false);
    fireEvent.click(registerButton);
    expect(onNavigate).toHaveBeenCalledWith("register");
  });
});
