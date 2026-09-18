"use client";

/** Inbox Triage — the sixth workspace, and the first whose artifact is not on
 *  this screen at all.
 *
 *  The rows land in a sheet the reader owns, so there is nothing here to page
 *  through: the page is two setup rows, four facts and a foot, and the one
 *  question it answers is whether the pipe is running and, if not, which one
 *  thing to fix. There is no run button — the agent reads on its own clock —
 *  and no per-message list, because the sheet is where that work happens.
 *
 *  Every sentence follows from the status payload through `./inbox.ts`, where
 *  it is tested. This file only draws, and does the three things a payload
 *  cannot: send the browser to Google, remember that Disconnect was pressed,
 *  and read the flag `/oauth/google` left in the hash on the way back.
 */

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  inboxCheckSheet, inboxDisconnect, inboxOauthStart, inboxSetSheet, inboxStatus,
  type InboxStatus,
} from "@/lib/api";
import { loadPending, loadReady, useLoadSession, type Load } from "@/lib/load";
import { useHeadline, useHub, useWorkNav, type WorkSection } from "../context";
import { clock } from "../format";
import { Blank, Oops, PageHead, RuleHead, Wait } from "../ui";
import { workspaceBySlug } from "../workspaces";
import {
  GOOGLE_PERMISSIONS_URL, INBOX_POLL_MS, NO_RETURN, disconnectNotice, facts, hasRead, headline,
  isConnected, isSheetOk, readReturn, recheckHelps, sheetCheckSentence, sheetCheckShort, stateOf,
  stripReturn, trimStop,
  type ReturnFlags, type Statement,
} from "./inbox";

const TITLE = "Inbox Triage";

/** One section, no subjects. It goes in the rail all the same, because the
 *  rail's workspace group is also the way out and the chip that says where
 *  you are; the one section link simply has nowhere else to go. */
const SECTIONS: WorkSection[] = workspaceBySlug("inbox")!.sections.map((s) => ({ ...s, count: null }));

const said = (e: unknown, fallback: string): string =>
  e instanceof Error && e.message.trim() ? e.message : fallback;

export function InboxWorkspace() {
  const { user, toast, revision } = useHub();
  const session = useLoadSession();

  const [status, setStatus] = useState<Load<InboxStatus>>(loadPending);
  const [beat, setBeat] = useState(0);
  const [afterDisconnect, setAfterDisconnect] = useState(false);
  /** What the disconnect answered about Google's own grant. Read only while
   *  `afterDisconnect` holds; `false` until Google confirms otherwise. */
  const [googleRevoked, setGoogleRevoked] = useState(false);
  const [ret, setRet] = useState<ReturnFlags>(NO_RETURN);

  const [connecting, setConnecting] = useState(false);
  const [ref, setRef] = useState("");
  const [refErr, setRefErr] = useState<string | null>(null);
  const [sheetBusy, setSheetBusy] = useState<"save" | "check" | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const [dcOpen, setDcOpen] = useState(false);
  const [dcBusy, setDcBusy] = useState(false);
  const [dcErr, setDcErr] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const keep = useRef<HTMLButtonElement>(null);

  useWorkNav({
    agentId: "a12",
    subjects: [],
    subject: "",
    sections: SECTIONS,
    section: SECTIONS[0].id,
    onSubject: () => undefined,
    onSection: () => undefined,
  });

  // The OAuth return. `/oauth/google` finishes the exchange and lands here with
  // a flag in the hash query; read it once, then take it out of the address
  // bar so a reload or a bookmark does not replay the toast.
  useEffect(() => {
    const flags = readReturn(window.location.hash);
    if (!flags.connected && flags.error === null) return;
    setRet(flags);
    window.history.replaceState(null, "", stripReturn(window.location.hash));
  }, []);

  useEffect(() => {
    void session.run("inbox-status", (s) => inboxStatus({ signal: s }), setStatus,
      "Your inbox setup could not be read.", { keepStale: true });
  }, [session, revision, beat]);

  const reload = useCallback(() => setBeat((b) => b + 1), []);
  /** Every write answers with the same status object as the read. */
  const apply = useCallback((next: InboxStatus) => setStatus(loadReady(next)), []);

  const data = status.data;

  // The clock only runs while the account is switched on. An account that is
  // not has nothing on this page that can change, so it is read once and left
  // alone; a later read that says otherwise (refresh, or a revision bump)
  // starts the clock.
  const polling = data?.enabled === true;
  useEffect(() => {
    if (!polling) return;
    const t = setInterval(() => setBeat((b) => b + 1), INBOX_POLL_MS);
    return () => clearInterval(t);
  }, [polling]);
  const state = data ? stateOf(data, { afterDisconnect }) : null;

  // The success toast names the address, which only the status carries — so
  // it waits for the first read to land. The error needs nothing.
  useEffect(() => {
    if (ret.error !== null) {
      toast(`Gmail was not connected — ${trimStop(ret.error)}.`, "error");
      setRet(NO_RETURN);
      return;
    }
    if (ret.connected && data) {
      toast(`Gmail connected as ${data.gmail.address || "your account"}.`, "ok");
      setRet(NO_RETURN);
    }
  }, [ret, data, toast]);

  // "Disconnected" is this session's memory, not the payload's; it ends the
  // moment the status says Gmail is connected again.
  useEffect(() => {
    if (data?.gmail.connected) setAfterDisconnect(false);
  }, [data?.gmail.connected]);

  // The input carries the saved sheet, so "Save sheet" on a bad one is a
  // correction rather than a retype. Only ever fills an empty field.
  const savedRef = data?.sheet.url || data?.sheet.id || "";
  useEffect(() => {
    if (savedRef) setRef((prev) => (prev === "" ? savedRef : prev));
  }, [savedRef]);

  // On arrival with Gmail connected and no sheet, the one thing left to do is
  // the field, so it takes focus. Keyed on the state so a poll never steals it.
  useEffect(() => {
    if (state === "no_sheet") input.current?.focus();
  }, [state]);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (dcOpen && !el.open) {
      setDcErr(null);
      el.showModal();
      setTimeout(() => keep.current?.focus(), 40);
    } else if (!dcOpen && el.open) {
      el.close();
    }
  }, [dcOpen]);

  const head = data && state ? headline(state, data, { email: user.email, googleRevoked }) : null;
  useHeadline(head ? head.sub : "reading your inbox setup", TITLE);

  /* ------------------------------------------------------------ actions -- */

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const { url } = await inboxOauthStart();
      // The page leaves here; the button stays "Opening Google…" until it does.
      window.location.assign(url);
    } catch (e: unknown) {
      setConnecting(false);
      toast(said(e, "Google could not be opened."), "error");
    }
  }, [toast]);

  const saveSheet = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    const value = ref.trim();
    if (!value) {
      setRefErr("Paste the sheet's link or its ID first.");
      input.current?.focus();
      return;
    }
    setRefErr(null);
    setSheetBusy("save");
    try {
      const next = await inboxSetSheet(value);
      apply(next);
      if (next.sheet.check === "ok") {
        toast("Sheet saved. Two tabs and the columns are ready; the first rows land within five minutes.", "ok");
      }
      // Anything else is said by the row itself, from `sheet.check`.
    } catch (e2: unknown) {
      setRefErr(said(e2, "That sheet was not saved."));
    } finally {
      setSheetBusy(null);
    }
  }, [ref, apply, toast]);

  const checkSheet = useCallback(async () => {
    setRefErr(null);
    setSheetBusy("check");
    try {
      const next = await inboxCheckSheet();
      apply(next);
      if (next.sheet.check === "ok") toast("The sheet is writable. Reading resumes with the next read.", "ok");
    } catch (e: unknown) {
      setRefErr(said(e, "The sheet could not be checked."));
    } finally {
      setSheetBusy(null);
    }
  }, [apply, toast]);

  const copyAddress = useCallback(async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      toast("Copied. Share the sheet with it as an Editor.", "ok");
    } catch {
      toast("Could not copy — select the address and copy it yourself.", "warn");
    }
  }, [toast]);

  const disconnect = useCallback(async () => {
    setDcBusy(true);
    setDcErr(null);
    try {
      const next = await inboxDisconnect();
      apply(next);
      setGoogleRevoked(next.google_revoked === true);
      setAfterDisconnect(true);
      setDcOpen(false);
      const notice = disconnectNotice(next);
      toast(notice.text, notice.tone);
    } catch (e: unknown) {
      setDcErr(`Nothing was disconnected — ${trimStop(said(e, "the server refused"))}.`);
    } finally {
      setDcBusy(false);
    }
  }, [apply, toast]);

  /* ------------------------------------------------------------- render -- */

  if (status.phase === "loading" && !data) {
    return <div className="inbox"><Wait what="Reading your inbox setup" rows={3} /></div>;
  }
  if (status.phase === "failed" && !data) {
    return (
      <div className="inbox">
        <Oops what="Your inbox setup could not be read." error={status.error || ""} onRetry={reload} />
      </div>
    );
  }
  if (!data || !state || !head) return null;

  // The one lede with somewhere to go: Google's own permissions page, when the
  // disconnect could not confirm the grant was removed there.
  const lede = state === "disconnected" && !googleRevoked
    ? <>{head.lede} <a href={GOOGLE_PERMISSIONS_URL} target="_blank" rel="noreferrer">Open Google's permissions page</a></>
    : head.lede;

  if (state === "off") {
    return (
      <div className="inbox">
        <PageHead statement={<StatementText s={head.statement} />} lede={head.lede} />
        <Blank title="Nothing to set up yet">
          Once your account is on the list, this page shows three things: a Gmail connection, the
          sheet the rows go to, and what has been written.
        </Blank>
      </div>
    );
  }

  const connected = isConnected(data);
  const address = data.gmail.address || "your account";
  const sheetOk = isSheetOk(data);
  const sheetNamed = data.sheet.id !== null;
  const serviceAccount = data.service_account_email;
  // The sentence under the input: what the last save said (a 400, or an empty
  // field), else what the last check found. A check can come back without a
  // sheet id — "not found" names nothing — so it is read whenever it exists,
  // and a named sheet with no check yet still gets its sentence.
  const sheetSentence = refErr
    ?? (sheetNamed || data.sheet.check !== null ? sheetCheckSentence(data.sheet.check, serviceAccount) : null);

  const checking = status.phase === "loading";
  const at = clock(data.generated_at);

  return (
    <div className="inbox">
      <PageHead statement={<StatementText s={head.statement} />} lede={lede} />

      <section className="band">
        <RuleHead
          title="Setup"
          note={connected ? undefined : "In this order. Each step says what it needs."}
        />
        <div className="rows">
          <div className="srow">
            <div className="srow__t">
              <b>Gmail</b>
              <span>
                {connected
                  ? `${address} · read-only`
                  : "Read-only access to your inbox. Google will ask you to allow it, then bring you straight back here."}
              </span>
            </div>
            <div className="srow__c is-auto ctl">
              {connected ? (
                <span className="tag is-on">Connected</span>
              ) : (
                <>
                  <span className="tag">Not connected</span>
                  <button
                    type="button"
                    className="btn btn--solid btn--sm"
                    disabled={connecting}
                    onClick={() => void connect()}
                  >
                    {connecting ? "Opening Google…" : "Connect Gmail"}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="srow">
            <div className="srow__t">
              <b>Sheet</b>
              {sheetOk ? (
                <span>
                  {data.sheet.title || "Your sheet"}
                  {data.sheet.url && (
                    <> · <a href={data.sheet.url} target="_blank" rel="noreferrer">Open the sheet</a></>
                  )}
                </span>
              ) : (
                <span>
                  Where the rows go. Make a Google Sheet (empty is fine), share it with the address
                  below as an <b>Editor</b>, then paste its link or ID here. The two tabs and the
                  columns are set up for you.
                </span>
              )}
              {!sheetOk && (
                <div className="sa">
                  <code>{serviceAccount}</code>
                  <button
                    type="button"
                    className="btn btn--quiet btn--sm"
                    onClick={() => void copyAddress(serviceAccount)}
                  >
                    Copy address
                  </button>
                </div>
              )}
            </div>
            <div className="srow__c">
              {sheetNamed && (
                <div className="ctl">
                  <div>
                    <span className={`tag${sheetOk ? " is-on" : " is-bad"}`}>
                      {sheetOk ? "Writable" : "Not writable"}
                    </span>
                    {!sheetOk && <span className="hook__note">{sheetCheckShort(data.sheet.check)}</span>}
                  </div>
                </div>
              )}
              <form onSubmit={(e) => void saveSheet(e)} noValidate>
                <label className="sr" htmlFor="inbox-sheet-ref">The sheet's link or ID</label>
                <input
                  id="inbox-sheet-ref"
                  ref={input}
                  className="inp"
                  type="text"
                  inputMode="url"
                  value={ref}
                  placeholder="https://docs.google.com/spreadsheets/d/… or the sheet ID"
                  aria-invalid={sheetSentence ? true : undefined}
                  aria-describedby={sheetSentence ? "inbox-sheet-err" : undefined}
                  onChange={(e) => { setRef(e.target.value); if (refErr) setRefErr(null); }}
                />
                <div className="acts">
                  <button type="submit" className="btn btn--quiet btn--sm" disabled={sheetBusy !== null}>
                    {sheetBusy === "save" ? "Checking…" : "Save sheet"}
                  </button>
                  {sheetNamed && recheckHelps(data.sheet.check) && (
                    <button
                      type="button"
                      className="btn btn--quiet btn--sm"
                      disabled={sheetBusy !== null}
                      onClick={() => void checkSheet()}
                    >
                      {sheetBusy === "check" ? "Checking…" : "Check again"}
                    </button>
                  )}
                </div>
                {sheetSentence && <p className="err" id="inbox-sheet-err" role="alert">{sheetSentence}</p>}
              </form>
            </div>
          </div>
        </div>
      </section>

      <section className="band">
        <RuleHead title="What it has done" />
        {hasRead(data) ? (
          <>
            <dl className="facts">
              {facts(data).map((f) => (
                <div key={f.label}>
                  <dt>{f.label}</dt>
                  <dd>
                    {f.tone ? <span className={`st ${f.tone}`}><i />{f.value}</span> : f.value}
                  </dd>
                </div>
              ))}
            </dl>
            {data.sheet.url && (
              <a href={data.sheet.url} target="_blank" rel="noreferrer">Open the sheet</a>
            )}
          </>
        ) : (
          <Blank title="Nothing read yet">
            Once both steps are done it reads every five minutes on its own — there is no run
            button. The first pass covers the last 90 days, about 200 messages per read.
          </Blank>
        )}
      </section>

      {connected && (
        <div className="danger">
          <div>
            <b>Disconnect Gmail</b>
            <span>
              Stops reading {address}, deletes the stored rows and this workspace's copy of your
              Google permission, and asks Google to remove the permission too. Your sheet is not
              touched.
            </span>
          </div>
          <button type="button" className="btn btn--quiet btn--sm" onClick={() => setDcOpen(true)}>
            Disconnect…
          </button>
        </div>
      )}

      <p className="prio__from">
        Checked{at ? ` at ${at}` : ""} ·{" "}
        <button type="button" className="aside--go" disabled={checking} onClick={reload}>
          {checking ? "checking…" : "refresh"}
        </button>
      </p>

      <dialog
        className="dialog"
        ref={dialog}
        aria-labelledby="inbox-dc-title"
        onClose={() => setDcOpen(false)}
        onCancel={() => setDcOpen(false)}
      >
        {dcOpen && (
          <>
            <h2 id="inbox-dc-title">Disconnect Gmail?</h2>
            <p>
              The agent stops reading {address} and forgets what it read: the stored rows and this
              workspace's copy of your Google permission are deleted, and Google is asked to remove
              the permission. Your sheet is untouched — every row already written stays, and so do
              your Status and Notes.
            </p>
            {dcErr && <p className="err" role="alert">{dcErr}</p>}
            <div className="dialog__actions">
              <button ref={keep} type="button" className="btn btn--quiet" onClick={() => setDcOpen(false)}>
                Keep it connected
              </button>
              <button
                type="button"
                className="btn btn--solid"
                disabled={dcBusy}
                onClick={() => void disconnect()}
              >
                {dcBusy ? "Disconnecting…" : "Disconnect"}
              </button>
            </div>
          </>
        )}
      </dialog>
    </div>
  );
}

function StatementText({ s }: { s: Statement }) {
  return <>{s.pre}<b>{s.strong}</b>{s.post}</>;
}
