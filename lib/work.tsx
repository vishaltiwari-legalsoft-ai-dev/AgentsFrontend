"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/**
 * Global "agent working" registry.
 *
 * Any agent surface reports its busy state via `useReportWork(active)`; the
 * provider keeps a reference count of how many operations are in flight so the
 * global WorkBar can show a single, can't-miss "Working…" signal whenever at
 * least one agent is busy. Agents keep their own local spinners — this is the
 * guaranteed top-level indicator on top of those.
 */

interface WorkContextValue {
  count: number;
  begin: () => void;
  end: () => void;
}

const WorkContext = createContext<WorkContextValue | null>(null);

export function WorkProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);

  const begin = useCallback(() => setCount((c) => c + 1), []);
  const end = useCallback(() => setCount((c) => Math.max(0, c - 1)), []);

  const value = useMemo(() => ({ count, begin, end }), [count, begin, end]);

  return <WorkContext.Provider value={value}>{children}</WorkContext.Provider>;
}

/** Returns true while any agent operation is in flight. */
export function useIsWorking(): boolean {
  const ctx = useContext(WorkContext);
  return (ctx?.count ?? 0) > 0;
}

/**
 * Report an agent's busy state to the global registry. Pass the busy flag the
 * component already tracks; while it's true the global counter is incremented,
 * and it's released on change or unmount. Safe to use even outside a
 * WorkProvider (no-op), so individual agents stay independently testable.
 */
export function useReportWork(active: boolean): void {
  const ctx = useContext(WorkContext);
  useEffect(() => {
    if (!ctx || !active) return;
    ctx.begin();
    return () => ctx.end();
  }, [ctx, active]);
}
