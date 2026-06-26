"use client";

// Typed rendering for Database-view cells. Replaces the old "JSON.stringify every
// object into a gray blob" approach: dates read as dates, booleans and statuses
// as pills, collections as compact chips — so a row is scannable at a glance.

import type { ReactNode } from "react";

export type CellKind = "empty" | "bool" | "number" | "date" | "status" | "statusmap" | "object" | "array" | "text";

/** Short, human-readable string for any value (used for CSV export + filtering). */
export function cellText(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

// An ISO-8601-ish timestamp, e.g. "2026-06-26T14:02:11.000Z" or "2026-06-26".
const ISO_RE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?/;

function isIsoDate(v: unknown): v is string {
  return typeof v === "string" && ISO_RE.test(v) && !Number.isNaN(Date.parse(v));
}

function isStatusKey(key: string): boolean {
  return key === "status" || key === "state" || key.endsWith("_status");
}

/** True for a plain object whose every value is a string (a stage→state map). */
function isStringMap(v: object): v is Record<string, string> {
  const vals = Object.values(v);
  return vals.length > 0 && vals.every((x) => typeof x === "string");
}

/** Classify a value so the table can both render and align it correctly. */
export function cellKind(key: string, v: unknown): CellKind {
  if (v === null || v === undefined || v === "") return "empty";
  if (typeof v === "boolean") return "bool";
  if (typeof v === "number") return "number";
  if (isStatusKey(key) && typeof v === "string") return "status";
  if (isIsoDate(v)) return "date";
  if (Array.isArray(v)) return "array";
  // A status field that's an object of sub-states, e.g. {"a":"approved","c":"pending"}.
  if (isStatusKey(key) && typeof v === "object" && isStringMap(v)) return "statusmap";
  if (typeof v === "object") return "object";
  return "text";
}

// Map common status words to a tone. Anything unknown falls back to neutral.
const STATUS_TONE: Record<string, "ok" | "bad" | "warn" | "muted"> = {
  done: "ok", success: "ok", complete: "ok", completed: "ok", ready: "ok", active: "ok",
  error: "bad", failed: "bad", failure: "bad", cancelled: "bad", canceled: "bad",
  running: "warn", pending: "warn", processing: "warn", queued: "warn", in_progress: "warn",
  idle: "muted", paused: "muted", draft: "muted",
};

const TONE_STYLE: Record<string, { bg: string; fg: string }> = {
  ok: { bg: "var(--success-bg, #ecfdf5)", fg: "var(--success, #059669)" },
  bad: { bg: "var(--danger-bg, #fef2f2)", fg: "var(--danger, #dc2626)" },
  warn: { bg: "var(--warning-bg, #fffbeb)", fg: "var(--warning, #d97706)" },
  muted: { bg: "var(--surface-muted, #f3f4f6)", fg: "var(--text-tertiary, #9ca3af)" },
};

function Pill({ tone, children }: { tone: keyof typeof TONE_STYLE; children: ReactNode }) {
  const s = TONE_STYLE[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "2px 9px",
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 600,
        background: s.bg,
        color: s.fg,
        whiteSpace: "nowrap",
        lineHeight: 1.5,
      }}
    >
      {children}
    </span>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "2px 8px",
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 600,
        fontFamily: "var(--font-mono)",
        background: "var(--brand-subtle, #eef2ff)",
        color: "var(--brand, #6366f1)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

/** Local datetime string, e.g. "26 Jun 2026, 14:02". */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hasTime = /[T ]\d{2}:\d{2}/.test(iso);
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(hasTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

/** Coarse "2h ago" / "3d ago" relative label for hover tooltips. */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.round((Date.now() - then) / 1000);
  const abs = Math.abs(secs);
  const suffix = secs >= 0 ? "ago" : "from now";
  if (abs < 60) return "just now";
  const mins = Math.round(abs / 60);
  if (mins < 60) return `${mins}m ${suffix}`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ${suffix}`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ${suffix}`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ${suffix}`;
  return `${Math.round(months / 12)}y ${suffix}`;
}

/** Render one cell value as a typed, scannable node. */
export function renderCell(key: string, v: unknown): ReactNode {
  const kind = cellKind(key, v);
  switch (kind) {
    case "empty":
      return <span style={{ color: "var(--text-tertiary)" }}>—</span>;

    case "bool":
      return v ? (
        <Pill tone="ok">✓ true</Pill>
      ) : (
        <Pill tone="muted">✕ false</Pill>
      );

    case "number":
      return (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
          {(v as number).toLocaleString()}
        </span>
      );

    case "status": {
      const word = String(v).toLowerCase().replace(/\s+/g, "_");
      const tone = STATUS_TONE[word] ?? "muted";
      return <Pill tone={tone}>● {String(v)}</Pill>;
    }

    case "statusmap": {
      // Per-stage states, e.g. {"a":"approved","c":"pending"} → one mini pill per
      // stage, colored by its state, full "stage: state" on hover.
      const entries = Object.entries(v as Record<string, string>);
      return (
        <span style={{ display: "inline-flex", gap: 4, flexWrap: "nowrap" }}>
          {entries.map(([k, val]) => {
            const tone = STATUS_TONE[val.toLowerCase().replace(/\s+/g, "_")] ?? "muted";
            const s = TONE_STYLE[tone];
            return (
              <span
                key={k}
                title={`${k}: ${val}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "2px 7px",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 700,
                  background: s.bg,
                  color: s.fg,
                  fontFamily: "var(--font-mono)",
                  textTransform: "uppercase",
                }}
              >
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor" }} />
                {k}
              </span>
            );
          })}
        </span>
      );
    }

    case "date":
      return (
        <span title={relativeTime(v as string)} style={{ whiteSpace: "nowrap" }}>
          {formatDateTime(v as string)}
        </span>
      );

    case "array": {
      const n = (v as unknown[]).length;
      return <Chip>[ ] {n} item{n === 1 ? "" : "s"}</Chip>;
    }

    case "object": {
      const n = Object.keys(v as object).length;
      return <Chip>{"{ }"} {n} field{n === 1 ? "" : "s"}</Chip>;
    }

    default:
      return <>{String(v)}</>;
  }
}

/** Cells that should sit right-aligned (numbers). */
export function isNumericKind(kind: CellKind): boolean {
  return kind === "number";
}
