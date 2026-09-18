import { describe, expect, it } from "vitest";
import type { InboxStatus } from "@/lib/api";
import {
  disconnectNotice, facts, hasRead, headline, minutesToGo, readReturn, recheckHelps,
  sheetCheckSentence, sheetCheckShort, stateOf, stripReturn, trimStop,
} from "./inbox";

/* Every sentence on the workspace follows from the status payload, so these
 * pin the reading of it: which state a payload lands in, what the header and
 * the statement say there, and the small arithmetic and parsing around it.
 * `now` is explicit throughout so nothing depends on the machine's clock. */

const NOW = new Date("2026-09-18T10:00:00Z");
const before = (mins: number) => new Date(NOW.getTime() - mins * 60_000).toISOString();
const after = (mins: number) => new Date(NOW.getTime() + mins * 60_000).toISOString();

const SA = "inbox-triage@agentos.iam.gserviceaccount.com";
const EMAIL = "vishal@legalsoft.com";

/** The healthy payload; each test overrides one branch of it. */
const mk = (over: Partial<InboxStatus> = {}): InboxStatus => ({
  enabled: true,
  service_account_email: SA,
  gmail: { connected: true, address: "vishal@legalsoft.com", connected_at: before(600) },
  sheet: {
    id: "1AbC", url: "https://docs.google.com/spreadsheets/d/1AbC", title: "Inbox",
    check: "ok", checked_at: before(300),
  },
  backfill: { state: "done", done: 1240, total: 1240 },
  last_poll: { at: before(3), ok: true, messages_read: 12, error: null },
  next_poll_at: after(2),
  rows_24h: 57,
  needs_review: 3,
  generated_at: NOW.toISOString(),
  ...over,
});

const head = (s: InboxStatus, opts: { afterDisconnect?: boolean; googleRevoked?: boolean } = {}) =>
  headline(stateOf(s, opts), s, { email: EMAIL, now: NOW, googleRevoked: opts.googleRevoked });

const text = (s: InboxStatus, opts?: { afterDisconnect?: boolean }) => {
  const h = head(s, opts);
  return h.statement.pre + h.statement.strong + h.statement.post;
};

/* -------------------------------------------------------------- stateOf -- */

describe("stateOf", () => {
  it("is off before anything else, whatever else the payload says", () => {
    expect(stateOf(mk({ enabled: false }))).toBe("off");
    expect(stateOf(mk({ enabled: false, gmail: { connected: false, address: null, connected_at: null } }))).toBe("off");
  });

  it("is the first run while Gmail is not connected, sheet or no sheet", () => {
    const off = { connected: false, address: null, connected_at: null };
    expect(stateOf(mk({ gmail: off }))).toBe("first_run");
    expect(stateOf(mk({ gmail: off, sheet: { id: null, url: null, title: null, check: null, checked_at: null } }))).toBe("first_run");
  });

  it("is disconnected only when this session pressed the button", () => {
    const off = { connected: false, address: null, connected_at: null };
    expect(stateOf(mk({ gmail: off }), { afterDisconnect: true })).toBe("disconnected");
    // The flag means nothing once Gmail is connected again.
    expect(stateOf(mk(), { afterDisconnect: true })).toBe("healthy");
  });

  it("wants a sheet once Gmail is connected", () => {
    expect(stateOf(mk({ sheet: { id: null, url: null, title: null, check: null, checked_at: null } }))).toBe("no_sheet");
  });

  it("names a sheet that cannot be written to, including one not checked yet", () => {
    const sheet = mk().sheet;
    expect(stateOf(mk({ sheet: { ...sheet, check: "not_shared" } }))).toBe("sheet_bad");
    expect(stateOf(mk({ sheet: { ...sheet, check: "not_found" } }))).toBe("sheet_bad");
    expect(stateOf(mk({ sheet: { ...sheet, check: "not_editable" } }))).toBe("sheet_bad");
    expect(stateOf(mk({ sheet: { ...sheet, check: "not_yours" } }))).toBe("sheet_bad");
    expect(stateOf(mk({ sheet: { ...sheet, check: "mr_source" } }))).toBe("sheet_bad");
    expect(stateOf(mk({ sheet: { ...sheet, check: null } }))).toBe("sheet_bad");
  });

  it("puts a failed read ahead of a running backfill", () => {
    const s = mk({
      backfill: { state: "running", done: 400, total: 1240 },
      last_poll: { at: before(3), ok: false, messages_read: null, error: "Gmail answered 429." },
    });
    expect(stateOf(s)).toBe("read_failed");
  });

  it("is backfilling while the first pass is running", () => {
    expect(stateOf(mk({ backfill: { state: "running", done: 400, total: 1240 } }))).toBe("backfilling");
  });

  it("is waiting when set up but nothing has been read", () => {
    expect(stateOf(mk({
      backfill: { state: "not_started", done: 0, total: null },
      last_poll: { at: null, ok: null, messages_read: null, error: null },
    }))).toBe("waiting");
  });

  it("is healthy otherwise", () => {
    expect(stateOf(mk())).toBe("healthy");
  });
});

/* ------------------------------------------------------------- headline -- */

describe("headline", () => {
  it("off: says who switches it on, and names the reader's address", () => {
    const h = head(mk({ enabled: false }));
    expect(h.sub).toBe("not switched on for this account");
    expect(text(mk({ enabled: false }))).toBe("Inbox Triage is not switched on for this account.");
    expect(h.statement.strong).toBe("not switched on");
    expect(h.lede).toContain(`ask them to add ${EMAIL}`);
  });

  it("first run: two steps", () => {
    const s = mk({ gmail: { connected: false, address: null, connected_at: null } });
    expect(head(s).sub).toBe("not connected");
    expect(text(s)).toBe("Nothing is being read yet. Two steps to start: connect Gmail, then name the sheet.");
    expect(head(s).statement.strong).toBe("Two steps");
  });

  it("disconnected: nothing is being read, the sheet was not touched", () => {
    const s = mk({ gmail: { connected: false, address: null, connected_at: null } });
    const h = head(s, { afterDisconnect: true, googleRevoked: true });
    expect(h.sub).toBe("disconnected");
    expect(text(s, { afterDisconnect: true })).toBe("Disconnected. Nothing is being read. Your sheet was not touched.");
    expect(h.lede).toBe("Connect Gmail again to resume.");
  });

  it("disconnected without Google's confirmation says so, and where to remove it", () => {
    const s = mk({ gmail: { connected: false, address: null, connected_at: null } });
    for (const googleRevoked of [false, undefined]) {
      const lede = head(s, { afterDisconnect: true, googleRevoked }).lede;
      expect(lede).toBe(
        "This hub's copy of your Google permission was deleted, but Google did not confirm the permission itself was removed. To remove it yourself, open myaccount.google.com/permissions and remove access for this app. Connect Gmail again to resume.",
      );
    }
  });

  it("no sheet: names the connected address", () => {
    const s = mk({ sheet: { id: null, url: null, title: null, check: null, checked_at: null } });
    expect(head(s).sub).toBe("connected · no sheet yet");
    expect(head(s).statement.strong).toBe("vishal@legalsoft.com");
    expect(text(s)).toBe("Gmail is connected as vishal@legalsoft.com. Nothing is written until a sheet is named.");
  });

  it("sheet bad: the reason, then that reading pauses", () => {
    const s = mk({ sheet: { ...mk().sheet, check: "not_shared" } });
    const h = head(s);
    expect(h.sub).toBe("sheet not writable");
    expect(text(s)).toBe("The sheet can't be written to, so nothing new is landing.");
    expect(h.lede).toBe(
      `That sheet is not shared with ${SA}. Open it in Google Sheets, press Share, add that address as an Editor, then save again. Reading pauses until it is fixed.`,
    );
  });

  it("read failed: when, when it tries again, and the server's reason once", () => {
    const s = mk({ last_poll: { at: before(7), ok: false, messages_read: null, error: "Gmail answered 429." } });
    const h = head(s);
    expect(h.sub).toBe("last read failed 7 minutes ago");
    expect(text(s)).toBe("The last read failed 7 minutes ago. It tries again in 2 minutes.");
    expect(h.statement.strong).toBe("failed");
    expect(h.lede).toBe("Gmail answered 429. Nothing already in the sheet is affected.");
  });

  it("read failed with no reason recorded still says something true", () => {
    const s = mk({ last_poll: { at: before(7), ok: false, messages_read: null, error: null }, next_poll_at: null });
    const h = head(s);
    expect(text(s)).toBe("The last read failed 7 minutes ago. It tries again on the next read.");
    expect(h.lede).toBe("No reason was recorded for the failure. Nothing already in the sheet is affected.");
  });

  it("backfilling: done of total, and the minutes to go", () => {
    const s = mk({ backfill: { state: "running", done: 400, total: 1240 } });
    const h = head(s);
    expect(h.sub).toBe("reading the last 90 days · 400 of 1,240");
    expect(text(s)).toBe("Reading the last 90 days. 400 of 1,240 messages done.");
    expect(h.statement.strong).toBe("400 of 1,240 messages");
    // 840 left, five reads of 200, five minutes each.
    expect(h.lede).toContain("so roughly 25 minutes to go");
  });

  it("backfilling with no total counts what is done and promises no minutes", () => {
    const s = mk({ backfill: { state: "running", done: 400, total: null } });
    const h = head(s);
    expect(h.sub).toBe("reading the last 90 days · 400 so far");
    expect(text(s)).toBe("Reading the last 90 days. 400 messages so far.");
    expect(h.lede).not.toContain("minutes to go");
  });

  it("waiting: the first read is due", () => {
    const s = mk({
      backfill: { state: "not_started", done: 0, total: null },
      last_poll: { at: null, ok: null, messages_read: null, error: null },
    });
    expect(head(s).sub).toBe("waiting for the first read");
    expect(text(s)).toBe("Set up. The first read lands in 2 minutes.");
  });

  it("healthy: rows in the last day, and the needs-review count", () => {
    const h = head(mk());
    expect(h.sub).toBe("running · last read 3 minutes ago");
    expect(text(mk())).toBe("Running. 57 rows written in the last 24 hours, last read 3 minutes ago.");
    expect(h.statement.strong).toBe("57 rows");
    expect(h.lede).toContain("Three messages are marked needs review — the summary could not be read");
  });

  it("healthy with nothing new says the inbox is quiet", () => {
    const s = mk({ rows_24h: 0, needs_review: 1 });
    expect(text(s)).toBe("Running. Nothing new in the last 24 hours — last read 3 minutes ago, the inbox is quiet.");
    expect(head(s).statement.strong).toBe("Nothing new");
    expect(head(s).lede).toContain("One message is marked needs review");
  });

  it("healthy with one row does not say rows", () => {
    expect(head(mk({ rows_24h: 1 })).statement.strong).toBe("1 row");
  });
});

/* ---------------------------------------------------------- arithmetic -- */

describe("minutesToGo", () => {
  it("is reads of 200 at five minutes each, rounded up", () => {
    expect(minutesToGo(0, 1000)).toBe(25);
    expect(minutesToGo(0, 1001)).toBe(30);
    expect(minutesToGo(850, 1000)).toBe(5);
    expect(minutesToGo(999, 1000)).toBe(5);
  });

  it("never says zero for a backfill that is still running", () => {
    expect(minutesToGo(1000, 1000)).toBe(5);
    expect(minutesToGo(1200, 1000)).toBe(5);
  });
});

/* --------------------------------------------------------- sheet check -- */

describe("sheetCheckSentence", () => {
  it("says nothing when the sheet is fine", () => {
    expect(sheetCheckSentence("ok", SA)).toBeNull();
  });

  it("names the service account in the sharing sentences", () => {
    expect(sheetCheckSentence("not_shared", SA)).toBe(
      `That sheet is not shared with ${SA}. Open it in Google Sheets, press Share, add that address as an Editor, then save again.`,
    );
    expect(sheetCheckSentence("not_editable", SA)).toBe(
      `That sheet is shared with ${SA}, but only to view. Change its access to Editor, then save again.`,
    );
  });

  it("tells a wrong link from a wrong share", () => {
    expect(sheetCheckSentence("not_found", SA)).toBe(
      "No sheet was found at that link or ID. Check it is a Google Sheet, not a Doc or a folder, and that the ID was pasted whole.",
    );
  });

  it("tells a sheet that is not yours, and a Marketing Research sheet, to use one you own", () => {
    const notYours = sheetCheckSentence("not_yours", SA);
    const mr = sheetCheckSentence("mr_source", SA);
    expect(notYours).toBe(
      "That sheet is not one you own or can edit, so nothing was written to it. Use a sheet you own, then save again.",
    );
    expect(mr).toBe(
      "That sheet is one the Marketing Research agent reads, so nothing was written to it — inbox mail is kept out of team-wide sheets. Use a sheet you own, then save again.",
    );
    // Sharing with the agent is not the fix for either, so neither names it.
    expect(notYours).not.toContain(SA);
    expect(mr).not.toContain(SA);
  });

  it("puts the refusal reason in the sheet-bad lede", () => {
    const h = head(mk({ sheet: { ...mk().sheet, check: "mr_source" } }));
    expect(h.sub).toBe("sheet not writable");
    expect(h.lede).toBe(
      "That sheet is one the Marketing Research agent reads, so nothing was written to it — inbox mail is kept out of team-wide sheets. Use a sheet you own, then save again. Reading pauses until it is fixed.",
    );
    expect(head(mk({ sheet: { ...mk().sheet, check: "not_yours" } })).lede).toContain("Use a sheet you own");
  });

  it("offers Check again only where re-checking the same sheet can change the answer", () => {
    expect(recheckHelps("ok")).toBe(false);
    expect(recheckHelps("mr_source")).toBe(false);
    for (const c of ["not_shared", "not_found", "not_editable", "not_yours", null] as const) {
      expect(recheckHelps(c)).toBe(true);
    }
  });

  it("has a sentence for a sheet not checked yet", () => {
    expect(sheetCheckSentence(null, SA)).toContain("not been checked");
  });

  it("has a short form for each", () => {
    expect(sheetCheckShort("ok")).toBe("Writable");
    expect(sheetCheckShort("not_shared")).toBe("Not shared with the agent's address");
    expect(sheetCheckShort("not_found")).toBe("No sheet at that link or ID");
    expect(sheetCheckShort("not_editable")).toBe("Shared to view only");
    expect(sheetCheckShort("not_yours")).toBe("Not a sheet you own");
    expect(sheetCheckShort("mr_source")).toBe("A Marketing Research sheet");
    expect(sheetCheckShort(null)).toBe("Not checked yet");
  });
});

/* ---------------------------------------------------------------- facts -- */

describe("facts", () => {
  it("draws the last read with its outcome and its count", () => {
    const f = facts(mk(), NOW);
    expect(f.map((x) => x.label)).toEqual(["Last read", "Rows written, last 24 h", "Marked needs review", "Next read"]);
    expect(f[0]).toEqual({ label: "Last read", value: "3 minutes ago · 12 messages", tone: "done" });
    expect(f[1].value).toBe("57");
    expect(f[2].value).toBe("3");
    expect(f[3].value).toBe("in 2 minutes");
  });

  it("marks a failed read, and leaves the count off when none was recorded", () => {
    const f = facts(mk({ last_poll: { at: before(7), ok: false, messages_read: null, error: "x" } }), NOW);
    expect(f[0]).toEqual({ label: "Last read", value: "7 minutes ago", tone: "failed" });
  });

  it("is only worth drawing once something has been read", () => {
    expect(hasRead(mk())).toBe(true);
    expect(hasRead(mk({ last_poll: { at: null, ok: null, messages_read: null, error: null } }))).toBe(false);
    expect(hasRead(mk({ gmail: { connected: false, address: null, connected_at: null } }))).toBe(false);
  });

  it("is not drawn from a sheet that is gone or broken, even with a read on record", () => {
    // The figures would be a previous sheet's, read as this one's.
    expect(hasRead(mk({ sheet: { id: null, url: null, title: null, check: null, checked_at: null } }))).toBe(false);
    expect(hasRead(mk({ sheet: { ...mk().sheet, check: "not_shared" } }))).toBe(false);
    expect(hasRead(mk({ sheet: { ...mk().sheet, check: "not_yours" } }))).toBe(false);
    expect(hasRead(mk({ sheet: { ...mk().sheet, check: "mr_source" } }))).toBe(false);
    expect(hasRead(mk({ sheet: { ...mk().sheet, check: null } }))).toBe(false);
  });
});

/* -------------------------------------------------------- OAuth return -- */

describe("readReturn", () => {
  it("reads a successful return", () => {
    expect(readReturn("#/w/inbox?connected=1")).toEqual({ connected: true, error: null });
  });

  it("reads an error, decoded", () => {
    expect(readReturn("#/w/inbox?error=The%20state%20did%20not%20match.")).toEqual({
      connected: false, error: "The state did not match.",
    });
  });

  it("reads nothing from a plain workspace hash", () => {
    expect(readReturn("#/w/inbox")).toEqual({ connected: false, error: null });
    expect(readReturn("")).toEqual({ connected: false, error: null });
  });

  it("treats an empty error as no error", () => {
    expect(readReturn("#/w/inbox?error=")).toEqual({ connected: false, error: null });
  });
});

describe("stripReturn", () => {
  it("takes the query off and leaves the route", () => {
    expect(stripReturn("#/w/inbox?connected=1")).toBe("#/w/inbox");
    expect(stripReturn("#/w/inbox")).toBe("#/w/inbox");
  });
});

describe("trimStop", () => {
  it("drops one trailing full stop so a quoted sentence is not ended twice", () => {
    expect(trimStop("Gmail answered 429.")).toBe("Gmail answered 429");
    expect(trimStop("Gmail answered 429")).toBe("Gmail answered 429");
    expect(trimStop("  spaced. ")).toBe("spaced");
  });
});

/* ------------------------------------- pinned 2026-09-18 (tester pass) -- */

describe("stateOf precedence, as one table", () => {
  // Every problem at once, then take them away in rank order: each step must
  // surface the next one down, so no two states can ever swap places unseen.
  const offGmail = { connected: false, address: null, connected_at: null };
  const noSheet = { id: null, url: null, title: null, check: null, checked_at: null };
  const badSheet = { ...mk().sheet, check: "not_shared" as const };
  const notYours = { ...mk().sheet, check: "not_yours" as const };
  const mrSheet = { ...mk().sheet, check: "mr_source" as const };
  const failedRead = { at: before(3), ok: false, messages_read: null, error: "Gmail answered 429." };
  const noRead = { at: null, ok: null, messages_read: null, error: null };
  const running = { state: "running" as const, done: 10, total: 100 };

  const rows: Array<[string, Partial<InboxStatus>, { afterDisconnect?: boolean }, string]> = [
    ["everything wrong, not enabled", { enabled: false, gmail: offGmail, sheet: noSheet, last_poll: failedRead, backfill: running }, { afterDisconnect: true }, "off"],
    ["enabled, not connected, after a disconnect", { gmail: offGmail, sheet: badSheet, last_poll: failedRead, backfill: running }, { afterDisconnect: true }, "disconnected"],
    ["enabled, not connected", { gmail: offGmail, sheet: badSheet, last_poll: failedRead, backfill: running }, {}, "first_run"],
    ["connected, no sheet, a failed read on record", { sheet: noSheet, last_poll: failedRead, backfill: running }, {}, "no_sheet"],
    ["connected, bad sheet, a failed read on record", { sheet: badSheet, last_poll: failedRead, backfill: running }, {}, "sheet_bad"],
    ["connected, not-yours sheet, a failed read on record", { sheet: notYours, last_poll: failedRead, backfill: running }, {}, "sheet_bad"],
    ["connected, MR sheet, a failed read on record", { sheet: mrSheet, last_poll: failedRead, backfill: running }, {}, "sheet_bad"],
    ["not connected, MR sheet, after a disconnect", { gmail: offGmail, sheet: mrSheet }, { afterDisconnect: true }, "disconnected"],
    ["not enabled, not-yours sheet", { enabled: false, sheet: notYours }, {}, "off"],
    ["good sheet, failed read, backfill running", { last_poll: failedRead, backfill: running }, {}, "read_failed"],
    ["good sheet, backfill running, nothing read yet", { last_poll: noRead, backfill: running }, {}, "backfilling"],
    ["good sheet, not started, nothing read yet", { last_poll: noRead, backfill: { state: "not_started", done: 0, total: null } }, {}, "waiting"],
    ["good sheet, backfill done, a good read", {}, {}, "healthy"],
  ];

  it.each(rows)("%s → %s", (_label, over, opts, want) => {
    expect(stateOf(mk(over), opts)).toBe(want);
  });

  it("a failed read with no time on record is still a failed read", () => {
    expect(stateOf(mk({ last_poll: { at: null, ok: false, messages_read: null, error: "x" } }))).toBe("read_failed");
  });

  it("an unknown (null) read outcome is not a failure", () => {
    expect(stateOf(mk({ last_poll: { at: before(3), ok: null, messages_read: 0, error: null } }))).toBe("healthy");
  });
});

describe("readReturn edge cases", () => {
  it("reports both flags when Google's return carries both, so the error is never dropped", () => {
    expect(readReturn("#/w/inbox?connected=1&error=Access%20denied.")).toEqual({
      connected: true, error: "Access denied.",
    });
    expect(readReturn("#/w/inbox?error=Access%20denied.&connected=1")).toEqual({
      connected: true, error: "Access denied.",
    });
  });

  it("counts only connected=1 as a success", () => {
    expect(readReturn("#/w/inbox?connected=true").connected).toBe(false);
    expect(readReturn("#/w/inbox?connected=0").connected).toBe(false);
    expect(readReturn("#/w/inbox?connected=").connected).toBe(false);
  });

  it("treats a whitespace-only error as no error, and keeps a real one verbatim", () => {
    expect(readReturn("#/w/inbox?error=%20%20").error).toBeNull();
    expect(readReturn("#/w/inbox?error=a%26b%3Dc").error).toBe("a&b=c");
  });

  it("takes the first error when the query repeats it", () => {
    expect(readReturn("#/w/inbox?error=first&error=second").error).toBe("first");
  });
});

describe("minutesToGo at its boundaries", () => {
  it.each([
    [0, 0, 5],       // nothing known left, still running: one read
    [0, 1, 5],
    [0, 200, 5],     // exactly one read
    [0, 201, 10],    // one message over tips into a second read
    [0, 400, 10],
    [0, 401, 15],
    [199, 400, 10],  // 201 left
    [200, 400, 5],   // 200 left
  ])("done %i of %i -> %i minutes", (done, total, want) => {
    expect(minutesToGo(done, total)).toBe(want);
  });

  it("is a whole number of reads, never below one, and never grows as work is done", () => {
    for (let total = 0; total <= 1000; total += 37) {
      let previous = Infinity;
      for (let done = 0; done <= total + 50; done += 13) {
        const m = minutesToGo(done, total);
        expect(m % 5).toBe(0);
        expect(m).toBeGreaterThanOrEqual(5);
        expect(m).toBeLessThanOrEqual(previous);
        previous = m;
      }
    }
  });
});

describe("healthy headline with nothing to review", () => {
  it("does not explain an unreadable summary that did not happen", () => {
    // The commonest healthy payload: rows landing, nothing marked needs review.
    // The needs-review clause ("the summary could not be read, so the row
    // carries only the sender, subject and link") describes rows that exist
    // only when the count is above zero.
    const lede = head(mk({ needs_review: 0 })).lede;
    expect(lede).not.toContain("could not be read");
    expect(lede).not.toMatch(/\b(no|zero) messages are marked needs review\b/i);
  });
});

describe("healthy headline needs-review clause", () => {
  it("explains the unreadable summary only when the count is above zero", () => {
    expect(head(mk({ needs_review: 0 })).lede).toBe(
      "Your sheet is the dashboard: Status and Notes are yours to fill, and the Upcoming tab lists deadlines nearest first.",
    );
    expect(head(mk({ needs_review: 1 })).lede).toContain(
      "One message is marked needs review — the summary could not be read, so the row carries only the sender, subject and link.",
    );
  });
});

describe("disconnectNotice", () => {
  it("claims Google's permission is gone only when Google confirmed it", () => {
    expect(disconnectNotice({ google_revoked: true })).toEqual({
      text: "Disconnected. Your Google permission was removed, and your sheet was left as it is.",
      tone: "ok",
    });
  });

  it("says the hub's copy went but Google did not confirm, when false or missing", () => {
    const want = {
      text: "Disconnected, and your sheet was left as it is. This hub's copy of your Google permission was deleted, but Google did not confirm the permission itself was removed. To remove it yourself, open myaccount.google.com/permissions and remove access for this app.",
      tone: "warn",
    };
    expect(disconnectNotice({ google_revoked: false })).toEqual(want);
    // An older backend that does not send the field: never read as success.
    expect(disconnectNotice({})).toEqual(want);
  });
});

describe("OAuth error round trip", () => {
  it("a backend refusal sentence survives the page's encoding and the hash read intact", () => {
    // /oauth/google puts `e.message` (the backend's detail) through
    // encodeURIComponent; the workspace reads it back with readReturn and
    // quotes it in the toast.
    const detail =
      "You are signed in as vishal@legalsoft.com, but Google connected other+inbox@gmail.com — connect the Gmail account you signed in with. Nothing was stored.";
    const back = readReturn(`#/w/inbox?error=${encodeURIComponent(detail)}`);
    expect(back).toEqual({ connected: false, error: detail });
    expect(`Gmail was not connected — ${trimStop(back.error ?? "")}.`).toBe(`Gmail was not connected — ${detail}`);
  });
});
