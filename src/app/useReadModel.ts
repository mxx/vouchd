/**
 * Opens the local projection once and hands it to the tree.
 *
 * Returns `null` until it's open rather than blocking render: the panels
 * that don't need it (owner key setup, minting an attestation) work offline
 * and shouldn't wait on a database they never touch.
 */

import { useEffect, useState } from "react";
import { openReadModel, type ReadModelDb } from "../readmodel/db";

export function useReadModel(): ReadModelDb | null {
  const [db, setDb] = useState<ReadModelDb | null>(null);

  useEffect(() => {
    let live = true;
    void openReadModel().then((opened) => {
      if (live) setDb(opened);
      else opened.close();
    });
    return () => {
      live = false;
    };
  }, []);

  return db;
}
