"use client";

/** What is actually behind every figure on the other six panels.
 *
 *  One workbook, read whole, plus whatever has been carried in by hand. This
 *  agent has **no advertising API and never had one** — so "source" here means a
 *  tab or a file somebody exported, and the panel says which rather than letting
 *  the word imply a live feed.
 *
 *  Two things are load-bearing:
 *
 *  - A sheet added here can be read for questions **without** being counted into
 *    the desk. `include_in_dashboard` is off by default for exactly that reason,
 *    and the row shows which side of the line each sheet is on.
 *  - A pull **replaces** what it read, it does not merge. The button says so
 *    before it is pressed.
 */

import { useCallback, useEffect, useState } from "react";
import {
  mrAddSource, mrDeleteSource, mrDatasets, mrIngestSheet, mrSources, mrWorkbook, mrWorkbookScan,
  type MrDataset, type MrSheetSources, type MrTabProfile,
} from "@/lib/api";
import { loadPending, useLoadSession, type Load } from "@/lib/load";
import { fmtTime, mayDisconnect, sourceLabel } from "@/components/console/mr/format";
import { Ic } from "../../Sprite";
import { PageHead, RuleHead, Blank, Oops, Wait } from "../../ui";
import { n, word } from "../../model";
import { useHub, type ToastFn } from "../../context";
import type { MrData_ } from "../MrWorkspace";
import { fmtNum } from "./parts";

export function MrData({ data, onToast }: { data: MrData_; onToast: ToastFn }) {
  const { user } = useHub();
  const session = useLoadSession();
  const [sources, setSources] = useState<Load<MrSheetSources>>(loadPending);
  const [tabs, setTabs] = useState<Load<MrTabProfile[]>>(loadPending);
  const [sets, setSets] = useState<Load<MrDataset[]>>(loadPending);
  const [url, setUrl] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [beat, setBeat] = useState(0);

  const mayEdit = user.is_admin === true || user.is_creator === true;

  useEffect(() => {
    void session.run("mr-sources", () => mrSources(), setSources,
      "The connected sheets could not be read.", { keepStale: true });
    void session.run("mr-tabs", () => mrWorkbook().then((r) => r.tabs), setTabs,
      "The workbook's tabs could not be read.", { keepStale: true });
    void session.run("mr-datasets", () => mrDatasets(), setSets,
      "The uploaded files could not be read.", { keepStale: true });
  }, [session, beat]);

  const pull = useCallback(async () => {
    setBusy("pull");
    onToast("Pulling the workbook. Every panel here reads what this replaces.", "ok");
    try {
      const r = await mrIngestSheet({});
      const rows = r.tabs.reduce((s2, t) => s2 + (t.metrics ?? 0), 0);
      const failed = r.tabs.filter((t) => t.error);
      // A pull that came back "partial" left some component on its PREVIOUS
      // data. Reporting that as success is how weeks-old figures stayed on
      // screen looking current.
      if (r.status === "partial" || failed.length || (r.degraded && r.degraded.length)) {
        onToast(
          `Pulled ${fmtNum(rows)} rows, but not everything: ${
            (r.degraded && r.degraded.length ? r.degraded : failed.map((t) => `${t.tab} — ${t.error}`)).join("; ")
          }. Whatever did not land is still showing its previous data.`,
          "warn",
        );
      } else {
        onToast(`Pulled ${fmtNum(rows)} rows across ${n(r.tabs.length)} tabs. Every panel now reads this pull.`, "ok");
      }
      data.reload();
      setBeat((b) => b + 1);
    } catch (e: unknown) {
      onToast(e instanceof Error ? e.message : "The pull failed. Nothing was replaced.", "error");
    } finally {
      setBusy(null);
    }
  }, [onToast, data]);

  const scan = useCallback(async () => {
    setBusy("scan");
    try {
      const r = await mrWorkbookScan();
      setTabs({ phase: "ready", data: r.tabs, error: null });
      onToast(`Read ${n(r.tabs.length)} tabs and worked out what each one holds.`, "ok");
    } catch (e: unknown) {
      onToast(e instanceof Error ? e.message : "The scan failed.", "error");
    } finally {
      setBusy(null);
    }
  }, [onToast]);

  const add = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const link = url.trim();
    if (!link.startsWith("http")) {
      setErr("Paste the full Google Sheets link.");
      return;
    }
    setErr(null);
    setBusy("add");
    try {
      const added = await mrAddSource(link);
      setSources((s) => (s.data
        ? { ...s, data: { ...s.data, sources: [...s.data.sources, added.source] } }
        : s));
      setUrl("");
      onToast(
        `Added — ${n(added.tab_count)} tab${added.tab_count === 1 ? "" : "s"} found. It is read for questions and is NOT counted into the desk until you say so.`,
        "ok",
      );
    } catch (e2: unknown) {
      setErr(e2 instanceof Error ? e2.message : "That sheet was not added.");
    } finally {
      setBusy(null);
    }
  }, [url, onToast]);

  const remove = useCallback(async (id: string, label: string) => {
    setBusy(id);
    try {
      await mrDeleteSource(id);
      setSources((s) => (s.data
        ? { ...s, data: { ...s.data, sources: s.data.sources.filter((x) => x.id !== id) } }
        : s));
      onToast(`${label} is disconnected. Nothing already pulled from it was deleted.`, "ok");
    } catch (e: unknown) {
      onToast(e instanceof Error ? e.message : "That sheet was not disconnected.", "error");
    } finally {
      setBusy(null);
    }
  }, [onToast]);

  const sheetList = sources.data?.sources || [];
  /** Secondary sheets this caller may not disconnect — somebody else connected
   *  them. Not the primary: that one is nobody's to disconnect and the row
   *  already says it is the tracker. */
  const notMine = sheetList.filter(
    (s) => !s.primary && !mayDisconnect(s, { whenUnknown: mayEdit }),
  ).length;
  const tabList = tabs.data || [];
  const useful = tabList.filter((t) => t.useful);
  const uploads = sets.data || [];

  return (
    <>
      <PageHead
        statement={
          <>
            One workbook, <b>{tabs.data ? `${n(tabList.length)} tabs` : "read whole"}</b>
            {uploads.length ? <>, and {word(uploads.length)} file{uploads.length === 1 ? "" : "s"} somebody carried in.</> : "."}
          </>
        }
        lede="There is no advertising API behind this agent and there never was one. Everything on every other panel comes from the sheets below and from files exported by hand, so nothing is newer than the last pull."
      />

      <section className="band">
        <RuleHead
          title="Connected sheets"
          note="The primary one feeds the desk. Anything else is read for questions and counted into the desk only if you say so."
          aside={
            mayEdit ? (
              <button type="button" className="btn btn--solid btn--sm" onClick={pull} disabled={busy !== null}>
                <Ic name="sweep" />
                {busy === "pull" ? "Pulling…" : "Pull the workbook now"}
              </button>
            ) : <span className="aside">{n(sheetList.length)} connected</span>
          }
        />

        {sources.phase === "loading" && !sources.data ? (
          <Wait what="Reading the connected sheets" rows={2} />
        ) : sources.phase === "failed" && !sources.data ? (
          <Oops what="The connected sheets could not be read." error={sources.error || ""} onRetry={() => setBeat((b) => b + 1)} />
        ) : !sources.data?.enabled ? (
          <Blank title="Sheet reading is switched off for this deployment">
            The workbook connector is disabled, so nothing can be pulled. That is a deployment
            setting, not something this panel can change.
          </Blank>
        ) : sheetList.length === 0 ? (
          <Blank title="No sheet is connected">
            Share the tracker with <b>{sources.data.service_account}</b> as a Viewer, then paste its
            link below.
          </Blank>
        ) : (
          <>
            <ul className="srcf">
              {sheetList.map((s) => (
                <li className="srcf__r" key={s.id}>
                  <span className="g">{s.primary ? "PR" : "EX"}</span>
                  <span className="srcf__n">
                    {s.label}
                    {s.primary && <span className="tag"> primary</span>}
                  </span>
                  <span className="srcf__m">
                    {s.include_in_dashboard
                      ? "Counted into the desk, the dossiers and the reports"
                      : "Read for questions only — never counted into the desk"}
                    {s.added_at ? ` · added ${new Date(s.added_at).toLocaleDateString()}` : ""}
                  </span>
                  <span className={s.include_in_dashboard ? "st done" : "st idle"}>
                    {s.include_in_dashboard ? "Counted" : "Questions only"}
                  </span>
                  {/* The server says per row who may disconnect it, and answers
                      403 to anyone else — so the button is offered on its answer
                      rather than on this panel's own idea of a role. */}
                  {mayDisconnect(s, { whenUnknown: mayEdit }) && (
                    <button
                      type="button"
                      className="btn btn--quiet btn--sm"
                      disabled={busy === s.id}
                      onClick={() => void remove(s.id, s.label)}
                    >
                      {busy === s.id ? "…" : "Disconnect"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {/* Said once, under the list, rather than as a sentence on every row
                about something the reader cannot do. */}
            {notMine > 0 && (
              <p className="help" style={{ marginTop: 10 }}>
                {notMine === 1 ? "One connected sheet is" : `${n(notMine)} connected sheets are`}
                {" not yours to disconnect — only whoever connected "}
                {notMine === 1 ? "it" : "them"}, or an admin, can. Everything here is still read
                for every question this agent answers.
              </p>
            )}
          </>
        )}

        {mayEdit && sources.data?.enabled && (
          <form className="inline" style={{ marginTop: "var(--s4)" }} onSubmit={add} noValidate>
            <label className="field">
              <span>Connect another sheet</span>
              <input
                className="inp"
                value={url}
                inputMode="url"
                placeholder="https://docs.google.com/spreadsheets/…"
                onChange={(e) => { setUrl(e.target.value); if (err) setErr(null); }}
              />
            </label>
            <button type="submit" className="btn btn--quiet" disabled={busy === "add"}>
              <Ic name="plus" />
              {busy === "add" ? "Adding…" : "Add"}
            </button>
          </form>
        )}
        {err && <p className="err" role="alert" style={{ marginTop: 10 }}>{err}</p>}
        {mayEdit && sources.data?.enabled && (
          <p className="help" style={{ marginTop: 10 }}>
            Share it with <b>{sources.data.service_account}</b> as a Viewer first. A new sheet is
            read for questions and is <b>not</b> counted into the desk — so adding one can never
            silently change a figure on another panel.
          </p>
        )}
      </section>

      <section className="band">
        <RuleHead
          title="What is in the workbook"
          note="Every tab, and what the agent worked out it holds. A tab marked not useful is one it read and decided carries nothing it can use."
          aside={
            mayEdit ? (
              <button type="button" className="btn btn--quiet btn--sm" onClick={scan} disabled={busy !== null}>
                {busy === "scan" ? "Reading…" : "Read the tabs again"}
              </button>
            ) : undefined
          }
        />
        {tabs.phase === "loading" && !tabs.data ? (
          <Wait what="Reading the tabs" rows={4} />
        ) : tabs.phase === "failed" && !tabs.data ? (
          <Oops what="The tabs could not be read." error={tabs.error || ""} onRetry={() => setBeat((b) => b + 1)} />
        ) : tabList.length === 0 ? (
          <p className="calm">The workbook has not been scanned yet.</p>
        ) : (
          <div className="tw">
            <table className="rt">
              <thead>
                <tr><th>Tab</th><th>What it holds</th><th>Period</th><th className="num">Metrics</th><th /></tr>
              </thead>
              <tbody>
                {tabList.map((t) => (
                  <tr key={t.gid}>
                    <td><b>{t.title}</b></td>
                    <td>{t.summary || t.kind}</td>
                    <td className="dim">{t.date_range || "—"}</td>
                    <td className="num">{fmtNum(t.metrics.length)}</td>
                    <td>
                      <span className={t.useful ? "st done" : "st idle"}>
                        {t.useful ? "Used" : "Not used"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tabList.length > 0 && (
          <p className="help" style={{ marginTop: 14 }}>
            {n(useful.length)} of {n(tabList.length)} tabs feed the desk. The rest are read when a
            question needs them and are never counted into a figure on another panel.
          </p>
        )}
      </section>

      <section className="band">
        <RuleHead
          title="Files carried in by hand"
          note="A platform export somebody uploaded. There is no API pulling these — each one is a moment in time."
          aside={<span className="aside">{n(uploads.length)}</span>}
        />
        {sets.phase === "loading" && !sets.data ? (
          <Wait what="Reading the uploads" rows={2} />
        ) : uploads.length === 0 ? (
          <p className="calm">Nothing has been uploaded. Every figure on the other panels is the workbook.</p>
        ) : (
          <ul className="srcf">
            {uploads.map((u) => {
              const { src, tab } = sourceLabel(u.platform);
              return (
                <li className="srcf__r" key={u.id}>
                  <span className="g">{(src || "?").slice(0, 2).toUpperCase()}</span>
                  <span className="srcf__n">{src}{tab ? ` · ${tab}` : ""} <span className="tag">upload</span></span>
                  <span className="srcf__m">
                    {fmtNum(u.metrics)} metric rows{u.leads ? `, ${fmtNum(u.leads)} leads` : ""} · {fmtTime(u.generated_at)}
                    {u.gaps.length > 0 && ` · ${u.gaps.length} gap${u.gaps.length === 1 ? "" : "s"}`}
                  </span>
                  <span className="st done">Uploaded</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
