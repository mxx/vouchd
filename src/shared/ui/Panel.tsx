import type { ReactNode } from "react";

export function Panel({
  id,
  title,
  children,
}: {
  /** Anchor target for the sidebar nav (Sidebar.tsx) -- omitted for panels nothing links to. */
  id?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="panel" id={id}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function ErrorText({ error }: { error: unknown }) {
  if (!error) return null;
  return <p className="error">{error instanceof Error ? error.message : String(error)}</p>;
}
