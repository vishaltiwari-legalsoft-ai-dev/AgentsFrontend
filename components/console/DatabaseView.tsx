"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getDbCollections,
  getDbCollection,
  purgeTelemetry,
  type DbCollection,
  type DbCollectionData,
} from "@/lib/api";
import { Icon, Button } from "@/lib/kit-ui";
import {
  cellText,
  cellKind,
  isNumericKind,
  renderCell,
} from "./db-cells";
import {
  identityColumn,
  defaultVisibleColumns,
  initialVisibleColumns,
  saveColumnPrefs,
} from "@/lib/db-columns";
import { RecordDrawer } from "./RecordDrawer";

const LIMIT_OPTIONS = [25, 50, 100, 250, 500];

/** Build a CSV string from the visible columns + rows (objects become JSON). */
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

// Backgrounds for the frozen header / pinned column must be opaque so scrolled
// content doesn't bleed through.
const FROZEN_BG = "var(--surface, #fff)";

type Sort = { col: string; dir: "asc" | "desc" } | null;

export function DatabaseView({ onBack }: { onBack: () => void }) {
  const [collections, setCollections] = useState<DbCollection[] | null>(null);
  const [conn, setConn] = useState<{ connected: boolean; database: string; project: string } | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [data, setData] = useState<DbCollectionData | null>(null);
  const [limit, setLimit] = useState(50);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Column visibility / sort.
  const [visible, setVisible] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const [sort, setSort] = useState<Sort>(null);

  const loadCollections = useCallback(() => {
    return getDbCollections()
      .then((res) => {
        setCollections(res.collections);
        setConn({ connected: res.connected, database: res.database, project: res.project });
        setActive((cur) => cur ?? (res.collections[0]?.name ?? null));
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load");
      });
  }, []);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  const onPurge = useCallback(() => {
    const answer = window.prompt(
      "This deletes the OLD telemetry tables (creative_events, sessions, " +
        "requests, conversations). Your accounts, settings, brands and assets " +
        "are kept. Type DELETE to confirm.",
    );
    if (answer === null) return;
    if (answer !== "DELETE") {
      setError("Cleanup cancelled — you must type DELETE exactly.");
      return;
    }
    setError(null);
    purgeTelemetry("DELETE")
      .then((res) => {
        const summary = Object.entries(res.deleted)
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ");
        setError(`Cleaned up — ${summary}. Kept: ${res.kept}.`);
        return loadCollections();
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Purge failed"),
      );
  }, [loadCollections]);

  const load = useCallback((name: string, lim: number) => {
    setLoading(true);
    setError(null);
    setSelected(null);
    getDbCollection(name, lim)
      .then((d) => setData(d))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load"),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (active) load(active, limit);
  }, [active, limit, load]);

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const allColumns = useMemo(() => data?.columns ?? [], [data]);

  // When a new collection's data arrives, resolve its column view (saved or default)
  // and reset the sort.
  useEffect(() => {
    if (!data) return;
    const prefs = initialVisibleColumns(data.name, data.columns);
    setVisible(prefs.visible);
    setShowAll(prefs.showAll);
    setSort(null);
    setColMenuOpen(false);
  }, [data]);

  const identity = useMemo(() => identityColumn(allColumns), [allColumns]);

  // The columns actually rendered, in backend order, identity always first.
  const shownColumns = useMemo(() => {
    const base = showAll ? allColumns : allColumns.filter((c) => visible.includes(c));
    const withId = identity && !base.includes(identity) ? [identity, ...base] : base;
    // Move identity to the front.
    return identity ? [identity, ...withId.filter((c) => c !== identity)] : withId;
  }, [allColumns, visible, showAll, identity]);

  // Persist column choices whenever they change (skip the empty initial state).
  useEffect(() => {
    if (data && (visible.length > 0 || showAll)) {
      saveColumnPrefs(data.name, { visible, showAll });
    }
  }, [data, visible, showAll]);

  // Free-text filter across every loaded cell.
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      allColumns.some((c) => cellText(r[c]).toLowerCase().includes(q)),
    );
  }, [rows, allColumns, filter]);

  // Client-side sort on the loaded rows.
  const visibleRows = useMemo(() => {
    if (!sort) return filtered;
    const { col, dir } = sort;
    const factor = dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a[col];
      const bv = b[col];
      if (av === bv) return 0;
      if (av === null || av === undefined || av === "") return 1;
      if (bv === null || bv === undefined || bv === "") return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
      return cellText(av).localeCompare(cellText(bv)) * factor;
    });
  }, [filtered, sort]);

  const activeMeta = collections?.find((c) => c.name === active);

  const toggleColumn = (c: string) => {
    setShowAll(false);
    setVisible((cur) =>
      cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c],
    );
  };

  const onSortHeader = (c: string) => {
    setSort((cur) => {
      if (!cur || cur.col !== c) return { col: c, dir: "asc" };
      if (cur.dir === "asc") return { col: c, dir: "desc" };
      return null; // third click clears the sort
    });
  };

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
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="secondary" size="sm" onClick={onPurge}>
            <Icon name="trash-2" size={14} /> Clean up old tables
          </Button>
          <Button variant="secondary" size="sm" onClick={onBack}>
            Back
          </Button>
        </div>
      </div>

      {error && (
        <div style={{ background: "var(--danger-bg, #fef2f2)", color: "var(--danger, #dc2626)", padding: 14, borderRadius: "var(--radius-lg)", fontSize: 13 }}>
          {error}
        </div>
      )}

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

      {/* Collection picker. */}
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

      {/* Toolbar. */}
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

          {/* Columns menu. */}
          <ColumnsMenu
            open={colMenuOpen}
            onToggle={() => setColMenuOpen((o) => !o)}
            onClose={() => setColMenuOpen(false)}
            allColumns={allColumns}
            visible={visible}
            showAll={showAll}
            identity={identity}
            shownCount={shownColumns.length}
            onToggleColumn={toggleColumn}
            onSetShowAll={setShowAll}
            onReset={() => {
              if (!data) return;
              setShowAll(false);
              setVisible(defaultVisibleColumns(data.name, data.columns));
            }}
          />

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
            disabled={!visibleRows.length}
            onClick={() => data && downloadCsv(`${data.name}.csv`, toCsv(shownColumns, visibleRows))}
          >
            <Icon name="download" size={14} /> CSV
          </Button>
        </div>
      )}

      {/* Count summary. */}
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

      {/* The grid. */}
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
          <div style={{ overflow: "auto", maxHeight: "calc(100vh - 360px)" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 12.5 }}>
              <thead>
                <tr>
                  {shownColumns.map((c, idx) => {
                    const pinned = idx === 0 && c === identity;
                    const sorted = sort?.col === c;
                    return (
                      <th
                        key={c}
                        onClick={() => onSortHeader(c)}
                        style={{
                          position: "sticky",
                          top: 0,
                          left: pinned ? 0 : undefined,
                          zIndex: pinned ? 3 : 2,
                          textAlign: "left",
                          padding: "11px 16px",
                          whiteSpace: "nowrap",
                          fontFamily: "var(--font-mono)",
                          fontSize: 11,
                          textTransform: "uppercase",
                          letterSpacing: "0.02em",
                          color: sorted ? "var(--brand)" : "var(--text-tertiary)",
                          background: FROZEN_BG,
                          borderBottom: "1px solid var(--border)",
                          boxShadow: pinned ? "2px 0 0 var(--border-subtle)" : undefined,
                          cursor: "pointer",
                          userSelect: "none",
                        }}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                          {pinned && <Icon name="lock" size={11} />}
                          {c}
                          <Icon
                            name={sorted ? (sort?.dir === "asc" ? "chevron-up" : "chevron-down") : "chevrons-up-down"}
                            size={12}
                            style={{ opacity: sorted ? 1 : 0.35 }}
                          />
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, i) => (
                  <tr
                    key={i}
                    onClick={() => setSelected(row)}
                    style={{ cursor: "pointer" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--brand-subtle)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                  >
                    {shownColumns.map((c, idx) => {
                      const pinned = idx === 0 && c === identity;
                      const raw = row[c];
                      const kind = cellKind(c, raw);
                      return (
                        <td
                          key={c}
                          title={kind === "object" || kind === "array" ? cellText(raw) : undefined}
                          style={{
                            position: pinned ? "sticky" : undefined,
                            left: pinned ? 0 : undefined,
                            zIndex: pinned ? 1 : undefined,
                            padding: "10px 16px",
                            maxWidth: 340,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            textAlign: isNumericKind(kind) ? "right" : "left",
                            color: "var(--text-secondary)",
                            background: pinned ? FROZEN_BG : "inherit",
                            borderBottom: "1px solid var(--border-subtle)",
                            boxShadow: pinned ? "2px 0 0 var(--border-subtle)" : undefined,
                            fontWeight: pinned ? 600 : undefined,
                          }}
                        >
                          {renderCell(c, raw)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected && data && (
        <RecordDrawer
          title={identity ? cellText(selected[identity]) : `Record ${(visibleRows.indexOf(selected) + 1) || ""}`}
          subtitle={data.label}
          row={selected}
          columns={shownColumns}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

// --------------------------------------------------------------------------- //
// Columns dropdown.
// --------------------------------------------------------------------------- //

function ColumnsMenu({
  open,
  onToggle,
  onClose,
  allColumns,
  visible,
  showAll,
  identity,
  shownCount,
  onToggleColumn,
  onSetShowAll,
  onReset,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  allColumns: string[];
  visible: string[];
  showAll: boolean;
  identity: string | null;
  shownCount: number;
  onToggleColumn: (c: string) => void;
  onSetShowAll: (v: boolean) => void;
  onReset: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <Button variant="secondary" size="sm" onClick={onToggle}>
        <Icon name="sliders-horizontal" size={14} /> Columns
        <span style={{ marginLeft: 4, opacity: 0.7 }}>({shownCount}/{allColumns.length})</span>
      </Button>
      {open && (
        <>
          {/* click-away backdrop */}
          <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              zIndex: 41,
              width: 256,
              maxHeight: 360,
              overflowY: "auto",
              background: "var(--surface, #fff)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--shadow-lg, 0 12px 32px rgba(0,0,0,0.14))",
              padding: 8,
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                borderRadius: "var(--radius-md, 8px)",
                fontSize: 12.5,
                fontWeight: 600,
                color: "var(--text-primary)",
                cursor: "pointer",
              }}
            >
              <input type="checkbox" checked={showAll} onChange={(e) => onSetShowAll(e.target.checked)} />
              Show all fields
            </label>
            <div style={{ height: 1, background: "var(--border-subtle)", margin: "4px 0" }} />
            {allColumns.map((c) => {
              const isId = c === identity;
              const checked = showAll || isId || visible.includes(c);
              return (
                <label
                  key={c}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 10px",
                    borderRadius: "var(--radius-md, 8px)",
                    fontSize: 12.5,
                    fontFamily: "var(--font-mono)",
                    color: isId ? "var(--text-tertiary)" : "var(--text-secondary)",
                    cursor: isId || showAll ? "default" : "pointer",
                    opacity: showAll && !isId ? 0.6 : 1,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={isId || showAll}
                    onChange={() => onToggleColumn(c)}
                  />
                  {c}
                  {isId && <Icon name="lock" size={11} style={{ marginLeft: "auto" }} />}
                </label>
              );
            })}
            <div style={{ height: 1, background: "var(--border-subtle)", margin: "4px 0" }} />
            <button
              onClick={onReset}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "7px 10px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: 12.5,
                fontWeight: 600,
                color: "var(--brand)",
                borderRadius: "var(--radius-md, 8px)",
              }}
            >
              Reset to defaults
            </button>
          </div>
        </>
      )}
    </div>
  );
}
