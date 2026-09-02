/**
 * The sidebar's nav glyphs. Stroke-based, one consistent 20px grid, so they
 * scale and recolor with `currentColor` instead of shipping raster assets
 * or a whole icon-font dependency for four shapes.
 */

import type { ReactNode } from "react";

function IconBase({ children }: { children: ReactNode }) {
  return (
    <svg
      fill="none"
      height="15"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.6"
      viewBox="0 0 20 20"
      width="15"
    >
      {children}
    </svg>
  );
}

export function IconCommunity() {
  return (
    <IconBase>
      <circle cx="5" cy="5" r="2.1" />
      <circle cx="15" cy="7" r="2.1" />
      <circle cx="9.5" cy="15" r="2.1" />
      <path d="M6.6 6.2 L13.4 6.9 M6.6 6.9 L8.5 13.4 M11 14.1 L13.4 8.5" />
    </IconBase>
  );
}

export function IconOwnerKey() {
  return (
    <IconBase>
      <circle cx="7.2" cy="7.2" r="3.4" />
      <path d="M9.6 9.6 L16.2 16.2 M12.6 12.6 L14.7 14.7 M10.9 10.9 L13 13" />
    </IconBase>
  );
}

export function IconAgents() {
  return (
    <IconBase>
      <rect height="9.5" rx="1.8" width="12" x="4" y="6.5" />
      <path d="M10 6.5 L10 3.4" />
      <circle cx="10" cy="2.6" r="1" />
      <circle cx="7.6" cy="11" fill="currentColor" r="1" stroke="none" />
      <circle cx="12.4" cy="11" fill="currentColor" r="1" stroke="none" />
    </IconBase>
  );
}

export function IconChannels() {
  return (
    <IconBase>
      <path d="M7 4 L5.5 16 M14.5 4 L13 16 M4 8 L16 8 M4 12.5 L16 12.5" />
    </IconBase>
  );
}
