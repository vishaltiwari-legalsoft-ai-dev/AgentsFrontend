"use client";

/** Ctrl-K: every place in the console, by the words someone would type for it.
 *
 *  The prototype could also list every run and every buyer question here,
 *  because it held all of them in one array. This one lists the places — panels,
 *  specialists, and each specialist's sections — because a run is a fetched
 *  thing and a palette that has to make a network call before it can filter is
 *  not a palette. Runs are found on Runs, which has a filter of its own.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Ic } from "./Sprite";
import { LIVE_AGENTS, type Panel, type PanelId } from "./model";
import { WORKSPACES } from "./workspaces";

interface Entry {
  label: string;
  hint: string;
  run: () => void;
}

export function HubPalette({
  open, onClose, panels, onGo, onOpenWork, onBrief,
}: {
  open: boolean;
  onClose: () => void;
  panels: Panel[];
  onGo: (id: PanelId) => void;
  onOpenWork: (slug: string, subject?: string, section?: string) => void;
  onBrief: (agentId: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);

  const all = useMemo<Entry[]>(() => [
    ...panels.map((p) => ({ label: p.title, hint: p.group, run: () => onGo(p.id) })),
    ...LIVE_AGENTS.map((a) => ({ label: a.name, hint: "Give it work", run: () => onBrief(a.id) })),
    // A workspace section is a place, so it is reachable the way every other
    // place is — and named by what is in it, because "Fix list" is what someone
    // types when they want the fix list.
    ...WORKSPACES.flatMap((w) => {
      const agent = LIVE_AGENTS.find((a) => a.id === w.agentId);
      return w.sections.map((s) => ({
        label: `${s.label} — ${agent?.name ?? w.slug}`,
        hint: agent?.role ?? "Workspace",
        run: () => onOpenWork(w.slug, "", s.id),
      }));
    }),
  ], [panels, onGo, onBrief, onOpenWork]);

  const items = useMemo(() => {
    const term = q.trim().toLowerCase();
    const hit = term ? all.filter((i) => (i.label + i.hint).toLowerCase().includes(term)) : all;
    return hit.slice(0, 9);
  }, [q, all]);

  useEffect(() => setIdx(0), [q]);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      setQ("");
      setTimeout(() => input.current?.focus(), 30);
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  const pick = (i: Entry | undefined) => {
    if (!i) return;
    onClose();
    i.run();
  };

  return (
    <dialog
      className="palette"
      ref={dialog}
      aria-label="Search AgentHub"
      onClose={onClose}
      onCancel={onClose}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setIdx((k) => (items.length ? (k + 1) % items.length : 0));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setIdx((k) => (items.length ? (k - 1 + items.length) % items.length : 0));
        } else if (e.key === "Enter") {
          e.preventDefault();
          pick(items[idx]);
        }
      }}
    >
      <label className="palette__field">
        <Ic name="search" />
        <span className="sr">Search panels, specialists and sections</span>
        <input
          type="text"
          ref={input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Go to a panel, a specialist, or a piece of work"
          autoComplete="off"
        />
      </label>
      <ul className="palette__list">
        {items.length === 0 && (
          <li>
            <button type="button" disabled>Nothing matches</button>
          </li>
        )}
        {items.map((i, k) => (
          <li key={`${i.label}-${k}`} className={k === idx ? "is-on" : ""}>
            <button type="button" onMouseEnter={() => setIdx(k)} onClick={() => pick(i)}>
              {i.label}
              <em>{i.hint}</em>
            </button>
          </li>
        ))}
      </ul>
      <p className="palette__foot">Arrow keys move · Enter opens · Esc closes</p>
    </dialog>
  );
}
