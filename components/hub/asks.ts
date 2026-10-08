/** Asks — the decisions behind the admin's inbox of feedback, problems and
 *  agent requests.
 *
 *  Pure on purpose, like `panels/issues.ts`: which rows a filter keeps, what a
 *  row is titled, which lines it shows and which status buttons it offers are
 *  rules, not I/O, so they live here where `format.test.ts` proves them in
 *  node with no DOM. `AdminView` only draws what these functions decide.
 */

import type { Ask, AskKind, AskStatus } from "@/lib/api";

/** The tag each kind wears. */
export const KIND_LABEL: Record<AskKind, string> = {
  feedback: "Feedback",
  issue: "Problem",
  agent: "Agent request",
};

/** A kind the catalogue does not know is shown as it came, never hidden. */
export const kindLabel = (kind: string): string =>
  (KIND_LABEL as Record<string, string>)[kind] ?? kind;

export type AskFilter = "new" | "all";

/** `new` keeps the unseen rows; `all` keeps every row. Order is untouched —
 *  the backend already sends newest first. */
export function filterAsks(asks: readonly Ask[], filter: AskFilter): Ask[] {
  return filter === "new" ? asks.filter((a) => a.status === "new") : [...asks];
}

const text = (ask: Ask, key: string): string => (ask.fields[key] ?? "").trim();

/** The line a row leads with, or "" when the kind has no headline of its own:
 *  the agent's name, the place a problem happened. Feedback is only its note. */
export function askTitle(ask: Ask): string {
  if (ask.kind === "agent") return text(ask, "name");
  if (ask.kind === "issue") return text(ask, "where");
  return "";
}

/** The body lines under the title, empties dropped. An agent request spells
 *  out what it hands back and how often it would be used; the other two are
 *  their note. */
export function askLines(ask: Ask): string[] {
  if (ask.kind === "agent") {
    const gets = text(ask, "gets");
    const cadence = text(ask, "cadence");
    return [
      text(ask, "job"),
      gets ? `Hands back: ${gets}` : "",
      cadence ? `Used: ${cadence.toLowerCase()}` : "",
    ].filter(Boolean);
  }
  return [text(ask, "note")].filter(Boolean);
}

/** Who sent it: their name, else their email, else their id. Never blank. */
export function askWho(ask: Ask): string {
  return ask.from.name.trim() || ask.from.email.trim() || ask.from.user_id || "Someone";
}

/** The email shown dim beside the name — only when it adds something. */
export function askEmail(ask: Ask): string {
  const email = ask.from.email.trim();
  return email && email !== askWho(ask) ? email : "";
}

/** The status buttons a row offers: every status but the one it already has,
 *  and never back to `new` — a row is new until somebody looks at it. */
export function nextStatuses(status: AskStatus): Exclude<AskStatus, "new">[] {
  return (["seen", "done"] as const).filter((s) => s !== status);
}

export const STATUS_ACTION: Record<Exclude<AskStatus, "new">, string> = {
  seen: "Mark seen",
  done: "Done",
};

/** The inbox with one row replaced, and the `new` figure moved with it. */
export function replaceAsk<T extends { asks: Ask[]; new: number }>(list: T, updated: Ask): T {
  const prev = list.asks.find((a) => a.id === updated.id);
  if (!prev) return list;
  const delta = (updated.status === "new" ? 1 : 0) - (prev.status === "new" ? 1 : 0);
  return {
    ...list,
    asks: list.asks.map((a) => (a.id === updated.id ? updated : a)),
    new: Math.max(0, list.new + delta),
  };
}
