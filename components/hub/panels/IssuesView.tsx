"use client";

/** Issues — the console's record of what is wrong, in plain words.
 *
 *  Every row here is a sentence a person can act on, never an exception repr —
 *  the backend humanizes the raw signals (`app/services/issues.py`) and this
 *  panel only groups and routes them. Severity decides the order and the
 *  grouping; the fix button carries the reader to the one place the problem is
 *  put right. The decisions — group order, the counts sentence, where a fix
 *  routes — live in `./issues.ts`, where `issues.test.ts` proves them.
 */

import { useEffect, useState } from "react";
import { getIssues, type Issue, type IssueFix, type IssuesPayload } from "@/lib/api";
import { loadPending, useLoadSession, type Load } from "@/lib/load";
import { useHeadline, useHub } from "../context";
import { clock } from "../format";
import { n } from "../model";
import { Blank, Oops, PageHead, RuleHead, Wait } from "../ui";
import { SEVERITY_META, canFollowFix, countsLine, groupBySeverity, routeForFix } from "./issues";

export function IssuesView() {
  const { user, revision, go, openWork } = useHub();
  const session = useLoadSession();
  const [issues, setIssues] = useState<Load<IssuesPayload>>(loadPending);
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    void session.run(
      "issues",
      (signal) => getIssues({ signal }),
      setIssues,
      "The issues could not be read.",
      { keepStale: true },
    );
  }, [session, revision, beat]);

  const data = issues.data;
  useHeadline(data
    ? `${n(data.counts.high)} high · ${n(data.counts.medium)} medium · ${n(data.counts.low)} low`
    : "reading the record");

  if (issues.phase === "loading" && !data) return <Wait what="Reading the issues" rows={5} />;
  if (issues.phase === "failed" && !data) {
    return (
      <Oops
        what="The issues could not be read."
        error={issues.error || ""}
        onRetry={() => setBeat((b) => b + 1)}
      />
    );
  }
  if (!data) return null;

  const openFix = (fix: IssueFix) => {
    const to = routeForFix(fix);
    if (to.kind === "panel") go(to.panel);
    else openWork(to.workspace, to.subject, to.section);
  };

  const groups = groupBySeverity(data.issues);
  const checking = issues.phase === "loading";
  const at = clock(data.generated_at);
  const canFix = (fix: IssueFix) => canFollowFix(fix, user);
  // Said once, at the foot, rather than beside every row it applies to.
  const someWithheld = data.issues.some((i) => i.fix && !canFix(i.fix));

  return (
    <>
      <PageHead
        statement={countsLine(data.counts)}
        lede={
          groups.length === 0
            ? "When something breaks — a key, a connection, a sweep — it is named here first."
            : "Each one says what is wrong and where to put it right. Most severe first."
        }
      />

      {groups.length === 0 ? (
        <Blank title="Nothing is known to be wrong">
          Every source read clean just now. When something breaks, this panel names it
          in plain words and says where to fix it.
        </Blank>
      ) : (
        groups.map((g) => {
          const meta = SEVERITY_META[g.severity];
          return (
            <section className="band" key={g.severity}>
              <RuleHead
                title={meta.head}
                note={meta.note}
                aside={<span className="aside">{n(g.issues.length)}</span>}
              />
              <ol className="prio" aria-label={`${meta.chip} severity issues`}>
                {g.issues.map((i) => (
                  <IssueRow key={i.id} issue={i} onFix={openFix} canFix={canFix} />
                ))}
              </ol>
            </section>
          );
        })
      )}

      {someWithheld && (
        <p className="soon-note">
          Some of these are put right in a specialist that is not open to your account, so they are
          listed without a fix button.
        </p>
      )}

      <p className="prio__from">
        Checked{at ? ` at ${at}` : ""} ·{" "}
        <button
          type="button"
          className="aside--go"
          disabled={checking}
          onClick={() => setBeat((b) => b + 1)}
        >
          {checking ? "checking…" : "refresh"}
        </button>
      </p>
    </>
  );
}

/** One issue on one line: chip, brand, what is wrong, what it means, and the
 *  one place to go. The chips sit nested one level down so `.prio__i div >
 *  span` cannot restyle them. A row with no fix is a fact, not a task — it
 *  simply has no button, and so does a row whose fix lives behind a wall this
 *  reader is on the other side of. */
function IssueRow({
  issue, onFix, canFix,
}: {
  issue: Issue;
  onFix: (fix: IssueFix) => void;
  canFix: (fix: IssueFix) => boolean;
}) {
  const fix = issue.fix && canFix(issue.fix) ? issue.fix : null;
  const high = issue.severity === "high";
  return (
    <li className={`prio__i${high ? " is-bad" : ""}`}>
      <span className="prio__n" aria-hidden="true">{high ? "!" : "·"}</span>
      <div>
        <span>
          <span className={`sev sev--${issue.severity}`}>{SEVERITY_META[issue.severity].chip}</span>{" "}
          <span className="tag">{issue.brand}</span>
        </span>{" "}
        <b>{issue.title}</b>{" "}
        <span>{issue.detail}</span>
      </div>
      {fix && (
        <button type="button" onClick={() => onFix(fix)}>{fix.label}</button>
      )}
    </li>
  );
}
