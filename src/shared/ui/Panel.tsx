/**
 * Used to also take an `id` prop, an anchor target for the sidebar's old
 * jump links. Navigation is programmatic now (Sidebar.tsx renders a screen
 * switcher, not anchors), and nothing else ever read that id -- an id with
 * no consumer is exactly the drift house rule 1 warns against, so it's
 * removed rather than left to look load-bearing. Re-add only if a future
 * need for deep-linking to a specific screen resurfaces.
 */
import type { ReactNode } from "react";

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function ErrorText({ error }: { error: unknown }) {
  if (!error) return null;
  return <p className="error">{error instanceof Error ? error.message : String(error)}</p>;
}
