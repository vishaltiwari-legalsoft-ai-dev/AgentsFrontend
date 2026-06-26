// Column strategy for the admin Database view.
//
// The backend already returns columns "preferred-first, then alphabetical", so a
// collection can still expose 15+ fields and force a wide table. Here we pick a
// small, sensible *default* set of columns per collection (the Airtable-style
// clean view) while keeping every field one toggle away via the Columns menu and
// the "Show all fields" switch. The user's choices persist per-collection.

/** Curated default columns for the known collections. Only those that actually
 *  exist in the loaded data are shown — missing ones are silently skipped. */
const CURATED: Record<string, string[]> = {
  runs: ["id", "status", "agent_name", "brand", "category", "title", "created_at", "updated_at"],
  users: ["name", "email", "created_at", "last_login"],
  brands: ["id", "name", "category", "created_at", "updated_at"],
  creatives: ["id", "title", "file_name", "file_type", "brand", "created_at"],
  gd_runs: ["id", "status", "stage", "brand", "created_at", "updated_at"],
  reference_creatives: ["id", "file_name", "file_type", "brand", "created_at"],
  app_config: ["id", "name", "updated_at"],
};

// Per-agent run tables are created on demand as `agent_runs__<id>`; they all
// share one shape, so match them by prefix rather than exact name.
const AGENT_RUNS_PREFIX = "agent_runs__";
const AGENT_RUNS_DEFAULT = ["id", "action", "status", "stage", "agent_name", "created_at"];

// Fallback when a collection has no curated list: lean on the backend's
// preferred-first ordering and just take the leading columns.
const FALLBACK_COUNT = 6;

// Fields that read best as the pinned "identity" column, in priority order.
const IDENTITY_CANDIDATES = ["id", "name", "email", "title", "file_name"];

/** The column pinned to the left — the one you track a row by. Always visible. */
export function identityColumn(allColumns: string[]): string | null {
  if (allColumns.length === 0) return null;
  for (const c of IDENTITY_CANDIDATES) {
    if (allColumns.includes(c)) return c;
  }
  return allColumns[0];
}

/** The default set of visible columns for a collection, intersected with what
 *  the data actually contains and returned in the backend's column order. */
export function defaultVisibleColumns(name: string, allColumns: string[]): string[] {
  let curated: string[] | undefined = CURATED[name];
  if (!curated && name.startsWith(AGENT_RUNS_PREFIX)) curated = AGENT_RUNS_DEFAULT;

  const want = new Set(curated ?? allColumns.slice(0, FALLBACK_COUNT));
  const id = identityColumn(allColumns);
  if (id) want.add(id); // the pinned column is always part of the view

  // Preserve the backend's column order rather than the curated order.
  return allColumns.filter((c) => want.has(c));
}

// --------------------------------------------------------------------------- //
// Per-collection persistence of the user's column choices (localStorage).
// --------------------------------------------------------------------------- //

export interface ColumnPrefs {
  visible: string[];
  showAll: boolean;
}

const STORAGE_PREFIX = "dbview:cols:";

export function loadColumnPrefs(name: string): ColumnPrefs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + name);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ColumnPrefs;
    if (!Array.isArray(parsed.visible)) return null;
    return { visible: parsed.visible, showAll: Boolean(parsed.showAll) };
  } catch {
    return null;
  }
}

export function saveColumnPrefs(name: string, prefs: ColumnPrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + name, JSON.stringify(prefs));
  } catch {
    // Storage full or unavailable — preferences just won't persist.
  }
}

/** Resolve the starting visible-column state for a collection: a saved choice if
 *  present (filtered to columns that still exist), otherwise the curated default. */
export function initialVisibleColumns(
  name: string,
  allColumns: string[],
): ColumnPrefs {
  const saved = loadColumnPrefs(name);
  if (saved) {
    const stillValid = saved.visible.filter((c) => allColumns.includes(c));
    if (stillValid.length > 0 || saved.showAll) {
      return { visible: stillValid, showAll: saved.showAll };
    }
  }
  return { visible: defaultVisibleColumns(name, allColumns), showAll: false };
}
