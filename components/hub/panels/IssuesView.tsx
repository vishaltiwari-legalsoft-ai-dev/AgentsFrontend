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
import { Ic } from "../Sprite";
import { Blank, Oops, PageHead, RuleHead, Wait } from "../ui";
import { SEVERITY_META, canFollowFix, countsLine, groupBySeverity, routeForFix, type Severity } from "./issues";

/** The signal each severity wears in the row's left margin. */
const SEV_ICON: Record<Severity, string> = { high: "issues", medium: "clock", low: "info" };

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
        <section className="band">
          <RuleHead
            title="Open issues"
            note="Most severe first. The button beside each one goes where it is put right."
            aside={<span className="aside">{n(data.issues.length)} open</span>}
          />
          <ol className="issl" aria-label="Open issues, most severe first">
            {groups.flatMap((g) => g.issues).map((i) => (
              <IssueRow key={i.id} issue={i} onFix={openFix} canFix={canFix} />
            ))}
          </ol>
        </section>
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

/** One issue, one clean row: the severity signal in the margin, the title with
 *  its priority pill right beside it, the plain-words detail underneath, and
 *  the one place to go on the right. A row with no fix is a fact, not a task —
 *  it simply has no button, and so does a row whose fix lives behind a wall
 *  this reader is on the other side of. */
function IssueRow({
  issue, onFix, canFix,
}: {
  issue: Issue;
  onFix: (fix: IssueFix) => void;
  canFix: (fix: IssueFix) => boolean;
}) {
  const fix = issue.fix && canFix(issue.fix) ? issue.fix : null;
  return (
    <li className={`iss is-${issue.severity}`}>
      <span className="iss__sig" aria-hidden="true"><Ic name={SEV_ICON[issue.severity]} /></span>
      <div className="iss__body">
        <span className="iss__head">
          <b>{issue.title}</b>
          <em className={`iss__pri is-${issue.severity}`}>{SEVERITY_META[issue.severity].chip}</em>
          {issue.brand && <span className="iss__brand">{issue.brand}</span>}
        </span>
        <p>{issue.detail}</p>
      </div>
      {fix && (
        <button type="button" className="iss__go" onClick={() => onFix(fix)}>
          {fix.label}
          <Ic name="chevron" />
        </button>
      )}
    </li>
  );
}
