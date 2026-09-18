/** Inbox Triage — the decisions behind the workspace, with no React in them.
 *
 *  The screen answers one question: is my inbox landing in my sheet, and if
 *  not, which one thing do I fix. Every sentence it shows follows from the
 *  status payload alone, so the reading of that payload lives here, provable
 *  in `inbox.test.ts`, and `InboxWorkspace.tsx` only draws what these return.
 *
 *  Two things are load-bearing:
 *
 *  1. **One state at a time.** The payload can carry several facts that each
 *     deserve the headline — a sheet that stopped being writable *and* a read
 *     that failed. `stateOf` ranks them so the page names the one thing to fix
 *     first, rather than two sentences arguing over the statement.
 *  2. **"Disconnected" is not in the payload.** After a disconnect the server
 *     keeps the sheet and forgets the Gmail grant, which is the same shape as
 *     an account that named its sheet before ever connecting. The workspace
 *     says which happened, because only it saw the button pressed.
 */

import type { InboxSheetCheck, InboxStatus } from "@/lib/api";
import { ago, until } from "../format";
import { Cap, n, word } from "../model";

/** How often the open workspace re-reads the status. The backend reads mail
 *  every five minutes; a minute is enough to see a poll land without the
 *  reader pressing refresh. */
export const INBOX_POLL_MS = 60_000;

/** The backend's own cadence, named once so the arithmetic and the copy that
 *  explains it cannot drift apart. */
export const READ_SIZE = 200;
export const READ_EVERY_MIN = 5;
export const BACKFILL_DAYS = 90;

/* ---------------------------------------------------------------- state -- */

export type InboxState =
  /** Not switched on for this account. Nothing on the page can be changed. */
  | "off"
  /** Enabled, Gmail not connected. The sheet may or may not be named. */
  | "first_run"
  /** Gmail was disconnected in this session; the sheet survives on the server. */
  | "disconnected"
  /** Gmail connected, no sheet named yet. */
  | "no_sheet"
  /** A sheet is named but the last check found it cannot be written to. */
  | "sheet_bad"
  /** Set up, but the last read failed. */
  | "read_failed"
  /** Set up, reading the last 90 days. */
  | "backfilling"
  /** Set up, nothing read yet. */
  | "waiting"
  | "healthy";

export function stateOf(s: InboxStatus, opts: { afterDisconnect?: boolean } = {}): InboxState {
  if (!s.enabled) return "off";
  if (!s.gmail.connected) return opts.afterDisconnect ? "disconnected" : "first_run";
  if (!s.sheet.id) return "no_sheet";
  if (s.sheet.check !== "ok") return "sheet_bad";
  // A failed read outranks a running backfill: the backfill is what is being
  // interrupted, and the failure is the thing to fix.
  if (s.last_poll.ok === false) return "read_failed";
  if (s.backfill.state === "running") return "backfilling";
  if (!s.last_poll.at) return "waiting";
  return "healthy";
}

export const isConnected = (s: InboxStatus): boolean => s.gmail.connected;
export const isSheetOk = (s: InboxStatus): boolean => s.sheet.id !== null && s.sheet.check === "ok";

/* ---------------------------------------------------------------- sheet -- */

/** The sentence under the sheet input for what the last check found. `null`
 *  when there is nothing wrong to say. */
export function sheetCheckSentence(check: InboxSheetCheck | null, serviceAccount: string): string | null {
  switch (check) {
    case "ok":
      return null;
    case "not_shared":
      return `That sheet is not shared with ${serviceAccount}. Open it in Google Sheets, press Share, add that address as an Editor, then save again.`;
    case "not_found":
      return "No sheet was found at that link or ID. Check it is a Google Sheet, not a Doc or a folder, and that the ID was pasted whole.";
    case "not_editable":
      return `That sheet is shared with ${serviceAccount}, but only to view. Change its access to Editor, then save again.`;
    case "not_yours":
      return "That sheet is not one you own or can edit, so nothing was written to it. Use a sheet you own, then save again.";
    case "mr_source":
      return "That sheet is one the Marketing Research agent reads, so nothing was written to it — inbox mail is kept out of team-wide sheets. Use a sheet you own, then save again.";
    default:
      return "The sheet has not been checked since it was named. Press Check again.";
  }
}

/** Whether "Check again" can change the answer. A Marketing Research sheet is
 *  refused for what it is, not for how it is shared, so re-checking the same
 *  sheet only repeats the refusal — the fix is a different sheet. */
export const recheckHelps = (check: InboxSheetCheck | null): boolean =>
  check !== "ok" && check !== "mr_source";

/** The short form beside the row's tag, for when the full sentence is already
 *  under the input. */
export function sheetCheckShort(check: InboxSheetCheck | null): string {
  switch (check) {
    case "ok": return "Writable";
    case "not_shared": return "Not shared with the agent's address";
    case "not_found": return "No sheet at that link or ID";
    case "not_editable": return "Shared to view only";
    case "not_yours": return "Not a sheet you own";
    case "mr_source": return "A Marketing Research sheet";
    default: return "Not checked yet";
  }
}

/* ------------------------------------------------------------- backfill -- */

/** Minutes until the backfill is done at the backend's cadence. A backfill
 *  still marked running has at least one more read to do, so the floor is one
 *  read rather than the zero the bare arithmetic gives when `done` has caught
 *  up with `total`. */
export function minutesToGo(done: number, total: number): number {
  const left = Math.max(0, total - done);
  return Math.max(1, Math.ceil(left / READ_SIZE)) * READ_EVERY_MIN;
}

/* ------------------------------------------------------------- headline -- */

/** The statement, split so the marked phrase can be a `<b>`. */
export interface Statement {
  pre: string;
  strong: string;
  post: string;
}

export interface Headline {
  /** The header's second line. */
  sub: string;
  statement: Statement;
  lede: string;
}

const messages = (v: number): string => `${n(v)} message${v === 1 ? "" : "s"}`;

/** `"…sentence."` → `"…sentence"`, so a server sentence can be quoted inside
 *  one of ours without ending it twice. */
export const trimStop = (s: string): string => s.trim().replace(/\.$/, "");

const HEALTHY_LEDE_HEAD =
  "Your sheet is the dashboard: Status and Notes are yours to fill, and the Upcoming tab lists deadlines nearest first.";

/** Google's permissions page, where a person removes a grant themselves. */
export const GOOGLE_PERMISSIONS_URL = "https://myaccount.google.com/permissions";

/** Said whenever the disconnect reply did not carry `google_revoked: true` —
 *  including an older backend that does not send the field at all. */
const UNCONFIRMED_REVOKE =
  "This hub's copy of your Google permission was deleted, but Google did not confirm the permission itself was removed. To remove it yourself, open myaccount.google.com/permissions and remove access for this app.";

/** The toast after a disconnect. Only an explicit `google_revoked: true`
 *  earns the claim that Google's permission is gone. */
export function disconnectNotice(res: { google_revoked?: boolean }): { text: string; tone: "ok" | "warn" } {
  return res.google_revoked === true
    ? { text: "Disconnected. Your Google permission was removed, and your sheet was left as it is.", tone: "ok" }
    : { text: `Disconnected, and your sheet was left as it is. ${UNCONFIRMED_REVOKE}`, tone: "warn" };
}

export function headline(
  state: InboxState,
  s: InboxStatus,
  /** `googleRevoked` is what the disconnect in this session answered; it is
   *  only read in the `disconnected` state, and anything but `true` is said
   *  as unconfirmed. */
  ctx: { email: string; now?: Date; googleRevoked?: boolean },
): Headline {
  const now = ctx.now ?? new Date();
  const address = s.gmail.address || "your account";

  switch (state) {
    case "off":
      return {
        sub: "not switched on for this account",
        statement: { pre: "Inbox Triage is ", strong: "not switched on", post: " for this account." },
        lede: `It is switched on per account by the people who run this workspace, not from here. If it should be on for you, ask them to add ${ctx.email}. Nothing on this page can be changed until then.`,
      };

    case "first_run":
      return {
        sub: "not connected",
        statement: { pre: "Nothing is being read yet. ", strong: "Two steps", post: " to start: connect Gmail, then name the sheet." },
        lede: "This agent reads your Gmail inbox and writes one row per message to a Google Sheet you own — date, sender, subject, a category, a summary, any deadline, and a link back to the message. The sheet is where you work; this page only shows whether the pipe is running. It never sends, labels, deletes or marks anything as read.",
      };

    case "disconnected":
      return {
        sub: "disconnected",
        statement: { pre: "Disconnected. ", strong: "Nothing is being read.", post: " Your sheet was not touched." },
        lede: ctx.googleRevoked === true
          ? "Connect Gmail again to resume."
          : `${UNCONFIRMED_REVOKE} Connect Gmail again to resume.`,
      };

    case "no_sheet":
      return {
        sub: "connected · no sheet yet",
        statement: { pre: "Gmail is connected as ", strong: address, post: ". Nothing is written until a sheet is named." },
        lede: "Make the sheet, share it with the address below as an Editor — the agent writes as that account, not as you — then paste its link here.",
      };

    case "sheet_bad": {
      const reason = sheetCheckSentence(s.sheet.check, s.service_account_email)
        ?? "The sheet could not be written to.";
      return {
        sub: "sheet not writable",
        statement: { pre: "The sheet ", strong: "can't be written to", post: ", so nothing new is landing." },
        lede: `${reason} Reading pauses until it is fixed.`,
      };
    }

    case "read_failed": {
      const when = s.last_poll.at ? ago(s.last_poll.at, now) : "";
      const again = s.next_poll_at ? until(s.next_poll_at, now) : "on the next read";
      const why = s.last_poll.error
        ? `${trimStop(s.last_poll.error)}.`
        : "No reason was recorded for the failure.";
      return {
        sub: `last read failed${when ? ` ${when}` : ""}`,
        statement: { pre: "The last read ", strong: "failed", post: `${when ? ` ${when}` : ""}. It tries again ${again}.` },
        lede: `${why} Nothing already in the sheet is affected.`,
      };
    }

    case "backfilling": {
      const { done, total } = s.backfill;
      if (total === null) {
        return {
          sub: `reading the last ${BACKFILL_DAYS} days · ${n(done)} so far`,
          statement: { pre: `Reading the last ${BACKFILL_DAYS} days. `, strong: messages(done), post: " so far." },
          lede: `About ${READ_SIZE} every five minutes. Rows appear in the sheet as each read lands — you can start working it now.`,
        };
      }
      return {
        sub: `reading the last ${BACKFILL_DAYS} days · ${n(done)} of ${n(total)}`,
        statement: { pre: `Reading the last ${BACKFILL_DAYS} days. `, strong: `${n(done)} of ${n(total)} messages`, post: " done." },
        lede: `About ${READ_SIZE} every five minutes, so roughly ${minutesToGo(done, total)} minutes to go. Rows appear in the sheet as each read lands — you can start working it now.`,
      };
    }

    case "waiting": {
      const when = s.next_poll_at ? until(s.next_poll_at, now) : "within five minutes";
      return {
        sub: "waiting for the first read",
        statement: { pre: "Set up. ", strong: "The first read", post: ` lands ${when}.` },
        lede: `Rows appear in the sheet as each read lands. ${HEALTHY_LEDE_HEAD}`,
      };
    }

    case "healthy": {
      const when = s.last_poll.at ? ago(s.last_poll.at, now) : "";
      const rows = s.rows_24h;
      const review = s.needs_review;
      // The needs-review clause describes rows that exist only when the count
      // is above zero; with none, the lede stops at the head.
      const reviewLine = review <= 0
        ? ""
        : ` ${review === 1 ? "One message is" : `${Cap(word(review))} messages are`} marked needs review — the summary could not be read, so the row carries only the sender, subject and link.`;
      return {
        sub: `running · last read ${when}`,
        statement: rows > 0
          ? { pre: "Running. ", strong: `${n(rows)} row${rows === 1 ? "" : "s"}`, post: ` written in the last 24 hours, last read ${when}.` }
          : { pre: "Running. ", strong: "Nothing new", post: ` in the last 24 hours — last read ${when}, the inbox is quiet.` },
        lede: `${HEALTHY_LEDE_HEAD}${reviewLine}`,
      };
    }
  }
}

/* ---------------------------------------------------------------- facts -- */

export interface Fact {
  label: string;
  value: string;
  /** The `st` dot beside the value, for the one fact that has an outcome. */
  tone?: "done" | "failed";
}

/** The four figures under "What it has done". Only meaningful once something
 *  has been read — the caller draws a `Blank` before that. */
export function facts(s: InboxStatus, now = new Date()): Fact[] {
  const at = s.last_poll.at;
  const read = s.last_poll.messages_read;
  const last = at
    ? `${ago(at, now)}${read === null ? "" : ` · ${messages(read)}`}`
    : "never";
  return [
    {
      label: "Last read",
      value: last,
      tone: s.last_poll.ok === true ? "done" : s.last_poll.ok === false ? "failed" : undefined,
    },
    { label: "Rows written, last 24 h", value: n(s.rows_24h) },
    { label: "Marked needs review", value: n(s.needs_review) },
    { label: "Next read", value: s.next_poll_at ? until(s.next_poll_at, now) : "not scheduled" },
  ];
}

/** Whether there is anything to put under "What it has done" yet. The sheet
 *  has to be writable as well as Gmail connected: figures left over from a
 *  sheet that has since been changed or broken would read as current. */
export const hasRead = (s: InboxStatus): boolean =>
  s.gmail.connected && s.sheet.check === "ok" && s.last_poll.at !== null;

/* ------------------------------------------------------- the OAuth return -- */

/** What `/oauth/google` left in the hash query when it sent the browser back
 *  here: `#/w/inbox?connected=1` or `#/w/inbox?error=…`. */
export interface ReturnFlags {
  connected: boolean;
  error: string | null;
}

export const NO_RETURN: ReturnFlags = { connected: false, error: null };

export function readReturn(hash: string): ReturnFlags {
  const q = hash.indexOf("?");
  if (q < 0) return NO_RETURN;
  const params = new URLSearchParams(hash.slice(q + 1));
  const error = params.get("error");
  return {
    connected: params.get("connected") === "1",
    error: error !== null && error.trim() ? error : null,
  };
}

/** The hash with its query taken off, so a reload or a bookmark does not
 *  replay the toast. */
export function stripReturn(hash: string): string {
  const q = hash.indexOf("?");
  return q < 0 ? hash : hash.slice(0, q);
}
