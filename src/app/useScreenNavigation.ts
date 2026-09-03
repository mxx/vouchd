/**
 * Which screen the sidebar has selected. Identity (Community + Owner key)
 * is the only one reachable before a connection succeeds -- Sidebar.tsx
 * gates its other links on `connected`, and this hook is the other half:
 * it forces the fallback back to "identity" the instant a live connection
 * is lost (never existed yet, or existed and dropped while the operator
 * was elsewhere), so no gated screen is ever left stranded showing stale
 * data for a connection that no longer exists. Names match the existing
 * i18n/nav vocabulary 1:1 -- no new terms for the same things.
 */

import { useEffect, useState } from "react";

export type Screen = "identity" | "register" | "agents" | "channels" | "create-channel" | "membership";

export interface ScreenNavigation {
  activeScreen: Screen;
  setActiveScreen: (screen: Screen) => void;
}

export function useScreenNavigation(connected: boolean): ScreenNavigation {
  const [activeScreen, setActiveScreen] = useState<Screen>("identity");
  useEffect(() => {
    if (!connected) setActiveScreen("identity");
  }, [connected]);
  return { activeScreen, setActiveScreen };
}
