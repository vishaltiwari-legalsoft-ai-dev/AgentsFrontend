"use client";

// Airtable-style record panel. Opening a row slides this in from the right and
// lists every field as a clean Label : Value pair — nested objects/arrays render
// as collapsible indented sub-rows instead of a raw JSON blob. A "Copy JSON"
// button keeps the power-user escape hatch.

import { useEffect, useState } from "react";
import { Icon } from "@/lib/kit-ui";
import { renderCell, cellText } from "./db-cells";

function isContainer(v: unknown): boolean {
  return v !== null && typeof v === "object";
}

/** One field row; objects/arrays expand into indented children. */
function FieldRow({ label, value, depth }: { label: string; value: unknown; depth: number }) {
  const container = isContainer(value);
  const [open, setOpen] = useState(depth < 1); // top-level containers start open
  const entries = container
    ? Array.isArray(value)
      ? value.map((v, i) => [String(i), v] as const)
      : Object.entries(value as Record<string, unknown>)
    : [];

  return (
    <div style={{ paddingLeft: depth ? 14 : 0 }}>
      <div
        onClick={container ? () => setOpen((o) => !o) : undefined}
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          padding: "8px 0",
          borderBottom: depth === 0 ? "1px solid var(--border-subtle)" : undefined,
          cursor: container ? "pointer" : "default",
        }}
      >
        <span
          style={{
            flex: "0 0 132px",
            fontSize: 11.5,
            fontWeight: 600,
            color: "var(--text-tertiary)",
            fontFamily: "var(--font-mono)",
            display: "flex",
            alignItems: "center",
            gap: 4,
            wordBreak: "break-word",
          }}
        >
          {container && (
            <Icon name={open ? "chevron-down" : "chevron-right"} size={13} />
          )}
          {label}
        </span>
        <span style={{ flex: 1, fontSize: 13, color: "var(--text-primary)", minWidth: 0, wordBreak: "break-word" }}>
          {container ? (
            <span style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", fontSize: 11.5 }}>
              {Array.isArray(value) ? `[ ] ${entries.length} items` : `{ } ${entries.length} fields`}
            </span>
          ) : (
            renderCell(label, value)
          )}
        </span>
      </div>
      {container && open && (
        <div style={{ borderLeft: "1px solid var(--border-subtle)", marginLeft: 4 }}>
          {entries.length === 0 ? (
            <div style={{ padding: "6px 0 6px 14px", fontSize: 12, color: "var(--text-tertiary)", fontStyle: "italic" }}>
              empty
            </div>
          ) : (
            entries.map(([k, v]) => <FieldRow key={k} label={k} value={v} depth={depth + 1} />)
          )}
        </div>
      )}
    </div>
  );
}

export function RecordDrawer({
  title,
  subtitle,
  row,
  columns,
  onClose,
}: {
  title: string;
  subtitle: string;
  row: Record<string, unknown>;
  columns: string[];
  onClose: () => void;
}) {
  const [entered, setEntered] = useState(false);
  const [copied, setCopied] = useState(false);

  // Slide-in on mount; close on Escape.
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setEntered(true));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.cancelAnimationFrame(id);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Order fields by the table's column order, then any extras the table hid.
  const keys = [
    ...columns.filter((c) => c in row),
    ...Object.keys(row).filter((k) => !columns.includes(k)),
  ];

  const copyJson = () => {
    const text = JSON.stringify(row, null, 2);
    navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      },
      () => {},
    );
  };

  return (
    <>
      {/* Scrim — click to dismiss. */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15,15,15,0.32)",
          opacity: entered ? 1 : 0,
          transition: "opacity var(--dur-fast, 160ms) ease",
          zIndex: 60,
        }}
      />
      {/* Panel. */}
      <aside
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          height: "100vh",
          width: "min(440px, 92vw)",
          background: "var(--bg-app, #fff)",
          borderLeft: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-lg, -8px 0 28px rgba(0,0,0,0.12))",
          transform: entered ? "translateX(0)" : "translateX(100%)",
          transition: "transform var(--dur, 220ms) cubic-bezier(0.22,1,0.36,1)",
          zIndex: 61,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            padding: "16px 18px",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-tertiary)" }}>
              {subtitle}
            </div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "var(--text-primary)",
                fontFamily: "var(--font-mono)",
                wordBreak: "break-all",
                marginTop: 2,
              }}
            >
              {title}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-secondary)", padding: 4, display: "flex" }}
          >
            <Icon name="x" size={18} />
          </button>
        </header>

        <div style={{ flex: 1, overflowY: "auto", padding: "4px 18px 18px" }}>
          {keys.map((k) => (
            <FieldRow key={k} label={k} value={row[k]} depth={0} />
          ))}
          {keys.length === 0 && (
            <div style={{ padding: 20, textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
              This record has no fields.
            </div>
          )}
        </div>

        <footer style={{ padding: "12px 18px", borderTop: "1px solid var(--border-subtle)" }}>
          <button
            onClick={copyJson}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "8px 14px",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text-secondary)",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Icon name={copied ? "check" : "download"} size={14} />
            {copied ? "Copied!" : "Copy JSON"}
          </button>
          <span style={{ marginLeft: 12, fontSize: 11.5, color: "var(--text-tertiary)" }}>{cellText(title)}</span>
        </footer>
      </aside>
    </>
  );
}
