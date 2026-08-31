"use client";

/** The console's only notification.
 *
 *  Carried across from the old console rather than from the prototype, because
 *  the prototype had nothing that could fail: it showed one line in one voice
 *  for 2.6 seconds. A real run dies, and rendering a dead 90-second run as a
 *  check that clears itself means the reader never learns it died. So tone is
 *  part of the API — `ok` reassures and clears, `warn` lingers, `error` stays
 *  on screen until dismissed and stacks instead of being overwritten by
 *  whatever happens next.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Ic } from "./Sprite";
import type { ToastFn, ToastTone } from "./context";

export interface ToastItem {
  id: number;
  msg: string;
  tone: ToastTone;
}

/** 0 = never auto-dismiss. An error the reader did not see is an error they act on. */
const TTL_MS: Record<ToastTone, number> = { ok: 2600, warn: 6000, error: 0 };

/** Errors stack, but not without limit — a failing loop must not paper the screen. */
const MAX = 4;

const ICON: Record<ToastTone, string> = { ok: "check", warn: "bell", error: "x" };

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const seq = useRef(0);
  // ok/warn are transient status: the newest replaces the previous one. Errors
  // are not status, so they are tracked apart and only leave on dismiss.
  const transient = useRef<number | null>(null);

  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    if (transient.current === id) transient.current = null;
    setToasts((list) => list.filter((x) => x.id !== id));
  }, []);

  const fire = useCallback<ToastFn>((msg, tone = "ok") => {
    const id = (seq.current += 1);
    if (tone !== "error") {
      const prev = transient.current;
      if (prev !== null) {
        const t = timers.current.get(prev);
        if (t) clearTimeout(t);
        timers.current.delete(prev);
      }
      transient.current = id;
    }
    setToasts((list) => {
      const kept = tone === "error" ? list : list.filter((x) => x.tone === "error");
      return [...kept, { id, msg, tone }].slice(-MAX);
    });
    const ttl = TTL_MS[tone];
    if (ttl > 0) timers.current.set(id, setTimeout(() => dismiss(id), ttl));
  }, [dismiss]);

  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const t of map.values()) clearTimeout(t);
      map.clear();
    };
  }, []);

  return { toasts, fire, dismiss };
}

export function HubToasts({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  if (!toasts.length) return null;
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <p
          key={t.id}
          className={`toast toast--${t.tone}`}
          role={t.tone === "error" ? "alert" : "status"}
          aria-live={t.tone === "error" ? "assertive" : "polite"}
        >
          <Ic name={ICON[t.tone]} className="toast__ic" />
          <span>{t.msg}</span>
          {t.tone === "error" && (
            <button type="button" className="toast__x" onClick={() => onDismiss(t.id)}>
              Dismiss
            </button>
          )}
        </p>
      ))}
    </div>
  );
}
