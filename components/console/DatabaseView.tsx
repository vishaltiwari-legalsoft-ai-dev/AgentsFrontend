"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  getDbCollections,
  getDbCollection,
  type DbCollection,
  type DbCollectionData,
} from "@/lib/api";
import { Icon, Button } from "@/lib/kit-ui";

const LIMIT_OPTIONS = [25, 50, 100, 250, 500];

/** Render any Firestore value as a short, human-readable cell string. */
function cellText(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** Pretty-print a whole document for the expanded detail panel. */
function prettyDoc(row: Record<string, unknown>): string {
  return JSON.stringify(row, null, 2);
}

/** Build a CSV string from the loaded columns + rows (objects become JSON). */
function toCsv(columns: string[], rows: Record<string, unknown>[]): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const head = columns.map(esc).join(",");
  const body = rows
    .map((r) => columns.map((c) => esc(cellText(r[c]))).join(","))
    .join("\n");
  return `${head}\n${body}`;
}

function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const card: React.CSSProperties = {
  background: "var(--glass)",
  backdropFilter: "var(--glass-blur)",
  WebkitBackdropFilter: "var(--glass-blur)",
  border: "1px solid var(--border-subtle)",
  borderRadius: "var(--radius-2xl)",
  boxShadow: "var(--shadow-xs), var(--glass-edge)",
};

export function DatabaseView({ onBack }: { onBack: () => void }) {
  const [collections, setCollections] = useState<DbCollection[] | null>(null);
  const [conn, setConn] = useState<{ connected: boolean; database: string; project: string } | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [data, setData] = useState<DbCollectionData | null>(null);
  const [limit, setLimit] = useState(50);
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the collection list (with counts) once on mount; pick the first.
  useEffect(() => {
    let cancelled = false;
    getDbCollections()
      .then((res) => {
        if (cancelled) return;
        setCollections(res.collections);
        setConn({ connected: res.connected, database: res.database, project: res.project });
        if (res.collections.length) setActive(res.collections[0].name);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(
    (name: string, lim: number) => {
      setLoading(true);
      setError(null);
      setExpanded(null);
      getDbCollection(name, lim)
        .then((d) => setData(d))
        .catch((err: unknown) =>
          setError(err instanceof Error ? err.message : "Failed to load"),
        )
        .finally(() => setLoading(false));
    },
    [],
  );

  // (Re)load whenever the active collection or row limit changes.
  useEffect(() => {
    if (active) load(active, limit);
  }, [active, limit, load]);

  const rows = data?.rows ?? [];
  const columns = data?.columns ?? [];

  // Client-side free-text filter across every cell of the loaded rows.
  const visibleRows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      columns.some((c) => cellText(r[c]).toLowerCase().includes(q)),
    );
  }, [rows, columns, filter]);

  const activeMeta = collections?.find((c) => c.name === active);

  return (
    <div className="cview" style={{ maxWidth: "100%" }}>
      <div className="csechead">
        <div>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="database" /> Database
          </h3>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
            Live, read-only view of every record in the cloud database — proof of exactly what the platform is storing.
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={onBack}>
          Back
        </Button>
      </div>

      {error && (
        <div style={{ background: "var(--danger-bg, #fef2f2)", color: "var(--danger, #dc2626)", padding: 14, borderRadius: "var(--radius-lg)", fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Connection state — so an unreachable database is never mistaken for an
          empty one. */}
      {conn && !conn.connected && (
        <div style={{ background: "var(--danger-bg, #fef2f2)", color: "var(--danger, #dc2626)", padding: 14, borderRadius: "var(--radius-lg)", fontSize: 13, lineHeight: 1.5 }}>
          <strong>Couldn&apos;t reach the database.</strong> The server could not read any collection from
          project <code>{conn.project || "—"}</code>, database <code>{conn.database || "—"}</code>. This is a
          connection/credentials issue, not proof the data is empty.
        </div>
      )}
      {conn?.connected && (
        <div style={{ fontSize: 12, color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="check" size={13} /> Connected to <code>{conn.database}</code> (project <code>{conn.project}</code>).
        </div>
      )}

      {/* Collection picker — each pill shows the live document count. */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {(collections ?? []).map((c) => {
          const on = c.name === active;
          return (
            <button
              key={c.name}
              onClick={() => { setActive(c.name); setFilter(""); }}
              title={c.description}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "9px 14px",
                borderRadius: "var(--radius-lg)",
                border: `1px solid ${on ? "transparent" : "var(--border)"}`,
                background: on ? "var(--grad-brand)" : "var(--surface)",
                color: on ? "#fff" : "var(--text-secondary)",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                transition: "all var(--dur-fast, 120ms)",
              }}
            >
              {c.label}
              <span style={{
                padding: "1px 8px",
                borderRadius: 99,
                fontSize: 11,
                fontWeight: 700,
                background: on ? "rgba(255,255,255,0.22)" : "var(--brand-subtle)",
                color: on ? "#fff" : "var(--brand)",
              }}>
                {c.count === null ? "—" : c.count}
              </span>
            </button>
          );
        })}
        {!collections && (
          <span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Loading collections…</span>
        )}
      </div>

      {/* Toolbar: search, row limit, refresh, CSV export. */}
      {active && (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
          <div style={{ position: "relative", flex: "1 1 260px", minWidth: 200 }}>
            <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)", display: "flex" }}>
              <Icon name="search" size={15} />
            </span>
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={`Filter ${activeMeta?.label ?? "rows"}…`}
              style={{ width: "100%", padding: "9px 12px 9px 34px", borderRadius: "var(--radius-lg)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-primary)", fontSize: 13 }}
            />
          </div>
          <label style={{ fontSize: 12.5, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6 }}>
            Show
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              style={{ padding: "8px 10px", borderRadius: "var(--radius-lg)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-primary)", fontSize: 12.5 }}
            >
              {LIMIT_OPTIONS.map((n) => (
                <option key={n} value={n}>{n} rows</option>
              ))}
            </select>
          </label>
          <Button variant="secondary" size="sm" onClick={() => active && load(active, limit)} disabled={loading}>
            <Icon name="refresh-cw" size={14} /> Refresh
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={!rows.length}
            onClick={() => data && downloadCsv(`${data.name}.csv`, toCsv(columns, visibleRows))}
          >
            <Icon name="download" size={14} /> CSV
          </Button>
        </div>
      )}

      {/* Count summary line. */}
      {data && (
        <div style={{ fontSize: 12.5, color: "var(--text-tertiary)" }}>
          {activeMeta?.description}{" "}
          <strong style={{ color: "var(--text-secondary)" }}>
            Showing {visibleRows.length}
            {filter && ` of ${data.returned} loaded`}
            {!filter && data.count !== null && data.returned < data.count && ` of ${data.count} total`}
          </strong>
          {!filter && data.count !== null && data.returned < data.count && (
            <> — raise the row limit to load more.</>
          )}
        </div>
      )}

      {/* The table. */}
      <section style={{ ...card, overflow: "hidden" }}>
        {loading && !data ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
            Loading…
          </div>
        ) : !visibleRows.length ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
            {filter ? "No rows match your filter." : "This collection is empty."}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)", color: "var(--text-tertiary)", fontSize: 11, textTransform: "uppercase" }}>
                  <th style={{ width: 28 }} />
                  {columns.map((c) => (
                    <th key={c} style={{ textAlign: "left", padding: "11px 16px", whiteSpace: "nowrap", fontFamily: "var(--font-mono)", letterSpacing: "0.02em" }}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, i) => {
                  const open = expanded === i;
                  return (
                    <Fragment key={i}>
                      <tr
                        onClick={() => setExpanded(open ? null : i)}
                        style={{ borderBottom: "1px solid var(--border-subtle)", cursor: "pointer", background: open ? "var(--brand-subtle)" : undefined }}
                      >
                        <td style={{ padding: "10px 0 10px 12px", color: "var(--text-tertiary)" }}>
                          <Icon name={open ? "chevron-down" : "chevron-right"} size={14} />
                        </td>
                        {columns.map((c) => {
                          const raw = row[c];
                          const isObj = raw !== null && typeof raw === "object";
                          const text = cellText(raw);
                          return (
                            <td
                              key={c}
                              title={isObj ? text : undefined}
                              style={{
                                padding: "10px 16px",
                                maxWidth: 320,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                color: raw === null || raw === undefined || raw === "" ? "var(--text-tertiary)" : "var(--text-secondary)",
                                fontFamily: isObj ? "var(--font-mono)" : undefined,
                                fontSize: isObj ? 11.5 : undefined,
                              }}
                            >
                              {text}
                            </td>
                          );
                        })}
                      </tr>
                      {open && (
                        <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                          <td colSpan={columns.length + 1} style={{ padding: 0, background: "var(--bg-app)" }}>
                            <pre style={{ margin: 0, padding: "16px 20px", fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.55, color: "var(--text-primary)", overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                              {prettyDoc(row)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
