"use client";

/** Admin — who is in the workspace, how hard it is being used, and where things
 *  are stored.
 *
 *  Four reads, all of them already existing endpoints behind `require_admin`:
 *  the people, the month-by-month request volume, the collections and their
 *  sizes, and — for a creator only — which keys are set and where each one
 *  comes from.
 *
 *  Two shapes from the prototype are missing here on purpose. There is no
 *  spend-by-month column, because nothing joins a month of runs to a bill; and
 *  the keys are shown as **set or not set, and from where**, never as a masked
 *  value of plausible length. A password field holding sixteen dots that stand
 *  for nothing invites somebody to believe they have seen the key.
 */

import { useEffect, useState } from "react";
import {
  getAdminAnalytics, getAdminSettings, getAdminUsers, getDbCollections,
  type AdminSettings, type AdminUser, type Analytics, type DbCollectionsResponse,
} from "@/lib/api";
import { loadPending, useLoadSession, type Load } from "@/lib/load";
import { useHeadline, useHub } from "../context";
import { agentById, n } from "../model";
import { Mono, Oops, PageHead, RuleHead, Wait } from "../ui";
import { useRuns } from "../useRuns";
import { ago } from "../format";

export function AdminView() {
  const { user, revision } = useHub();
  const session = useLoadSession();
  const [users, setUsers] = useState<Load<{ users: AdminUser[]; total: number }>>(loadPending);
  const [stats, setStats] = useState<Load<Analytics>>(loadPending);
  const [db, setDb] = useState<Load<DbCollectionsResponse>>(loadPending);
  const [keys, setKeys] = useState<Load<AdminSettings>>(loadPending);
  const [beat, setBeat] = useState(0);

  const { state: feed } = useRuns({ limit: 1 }, revision, { live: false });
  const runs = feed.data;

  useEffect(() => {
    void session.run("admin-users", () => getAdminUsers(), setUsers,
      "The people could not be read.", { keepStale: true });
    void session.run("admin-stats", () => getAdminAnalytics(), setStats,
      "The usage figures could not be read.", { keepStale: true });
    void session.run("admin-db", (s) => getDbCollections({ signal: s }), setDb,
      "The collections could not be read.", { keepStale: true });
    if (user.is_creator) {
      void session.run("admin-keys", () => getAdminSettings(), setKeys,
        "The key settings could not be read.", { keepStale: true });
    }
  }, [session, beat, user.is_creator]);

  const people = users.data?.users || [];
  const months = stats.data?.monthly || [];
  const maxMonth = Math.max(1, ...months.map((m) => m.count));

  useHeadline(
    users.data
      ? `${n(users.data.total)} ${users.data.total === 1 ? "person" : "people"}${runs?.total != null ? ` · ${n(runs.total)} of your runs` : ""}`
      : "reading the workspace",
  );

  return (
    <>
      <PageHead
        statement={
          users.data
            ? <>{n(users.data.total)} {users.data.total === 1 ? "person" : "people"}, <b>{n(stats.data?.total_requests ?? 0)} recorded requests</b>.</>
            : <>Reading the workspace.</>
        }
        lede="Who can open this workspace, how hard it is being used, and where the data actually sits. Only an admin sees this page."
      />

      {/* ------------------------------------------------ usage by month --- */}
      <section className="band">
        <RuleHead
          title="Requests by month"
          note="Every creative request any specialist recorded, across every brand."
          aside={stats.data ? <span className="aside">{n(stats.data.total_requests)} all time</span> : undefined}
        />
        {stats.phase === "loading" && !stats.data ? (
          <Wait what="Reading the usage figures" rows={3} />
        ) : stats.phase === "failed" && !stats.data ? (
          <Oops what="The usage figures could not be read." error={stats.error || ""} onRetry={() => setBeat((b) => b + 1)} />
        ) : months.length === 0 ? (
          <p className="calm">Nothing has been recorded yet.</p>
        ) : (
          <div className="usage">
            {months.map((m, i) => (
              <div className="ubar" key={m.month}>
                <b>{m.month}</b>
                <i
                  style={{ transform: `scaleX(${(m.count / maxMonth).toFixed(3)})` }}
                  className={i === months.length - 1 ? "is-now" : ""}
                />
                <span>{n(m.count)}</span>
              </div>
            ))}
          </div>
        )}
        <p className="soon-note">
          There is no spend column beside these. Nothing joins a month of runs to a bill — OpenRouter
          bills the account, and the run record carries no cost — so the figure would have to be
          invented. The account&apos;s real 30-day spend is in the header of every page.
        </p>
      </section>

      {/* ------------------------------------------------ runs by agent ---- */}
      {runs && runs.facets.agents.length > 0 && (
        <section className="band">
          <RuleHead title="Your runs by specialist" note="Scoped to you — the record is per person." />
          <table className="tbl">
            <thead>
              <tr>
                <th>Specialist</th><th>Hands back</th>
                <th className="num">Runs</th><th className="num">Share</th><th className="num">This week</th>
              </tr>
            </thead>
            <tbody>
              {runs.facets.agents.map((a) => {
                const known = agentById(a.id);
                const total = runs.total ?? runs.scanned;
                const week = runs.week.by_agent.find((x) => x.id === a.id)?.count ?? 0;
                return (
                  <tr key={a.id}>
                    <td>
                      <span className="who">
                        <Mono agent={{ mono: known?.mono || a.name.slice(0, 2).toUpperCase() }} size="sm" />
                        <b>{a.name}</b>
                      </span>
                    </td>
                    <td>{known?.makes || "—"}</td>
                    <td className="num">{n(a.count)}</td>
                    <td className="num">{total ? `${Math.round((a.count / total) * 100)}%` : "—"}</td>
                    <td className="num">{n(week)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* ------------------------------------------------------- people ---- */}
      <section className="band">
        <RuleHead
          title="People"
          note="Everyone who can open this workspace."
          aside={users.data ? <span className="aside">{n(users.data.total)}</span> : undefined}
        />
        {users.phase === "loading" && !users.data ? (
          <Wait what="Reading the people" rows={4} />
        ) : users.phase === "failed" && !users.data ? (
          <Oops what="The people could not be read." error={users.error || ""} onRetry={() => setBeat((b) => b + 1)} />
        ) : (
          <table className="tbl">
            <thead>
              <tr><th>Name</th><th>Email</th><th>Signed in with</th><th>Joined</th><th>Last seen</th></tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id}>
                  <td><b>{p.name || "—"}</b></td>
                  <td>{p.email}</td>
                  <td>{p.provider || "—"}</td>
                  <td>{p.created_at ? ago(p.created_at) : "—"}</td>
                  <td>{p.last_login ? ago(p.last_login) : "never"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* --------------------------------------------------- where it is --- */}
      <section className="band">
        <RuleHead
          title="Where the data is"
          note="Every collection this console writes, and how many documents are in it."
          aside={db.data ? <span className="aside">{db.data.database}</span> : undefined}
        />
        {db.phase === "loading" && !db.data ? (
          <Wait what="Counting the collections" rows={4} />
        ) : db.phase === "failed" && !db.data ? (
          <Oops what="The collections could not be read." error={db.error || ""} onRetry={() => setBeat((b) => b + 1)} />
        ) : !db.data?.connected ? (
          <Oops
            what="The database is not reachable from here."
            error="Counts are unavailable. This is a connection problem, not an empty database."
            onRetry={() => setBeat((b) => b + 1)}
          />
        ) : (
          <table className="tbl">
            <thead><tr><th>Collection</th><th>What is in it</th><th className="num">Documents</th></tr></thead>
            <tbody>
              {db.data.collections.map((c) => (
                <tr key={c.name}>
                  <td><b>{c.label}</b></td>
                  <td>{c.description}</td>
                  {/* null is "could not be counted", which is not zero. */}
                  <td className="num">{c.count === null ? <span className="unknown" title="This one could not be counted">—</span> : n(c.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ---------------------------------------------------------- keys --- */}
      {user.is_creator && (
        <section className="band">
          <RuleHead title="Keys" note="Set once, used by every specialist. Shown as set or not set — never as a value." />
          {keys.phase === "loading" && !keys.data ? (
            <Wait what="Checking which keys are set" rows={3} />
          ) : keys.phase === "failed" && !keys.data ? (
            <Oops what="The key settings could not be read." error={keys.error || ""} onRetry={() => setBeat((b) => b + 1)} />
          ) : (
            <div className="rows">
              {Object.entries(keys.data?.keys || {}).map(([name, k]) => (
                <div className="srow" key={name}>
                  <div className="srow__t">
                    <b>{name}</b>
                    <span>
                      {k.set
                        ? `Set${k.hint ? ` — ends ${k.hint}` : ""}. Read from ${k.source === "override" ? "the admin panel" : "the deployment environment"}.`
                        : "Not set. Anything that needs it fails loudly rather than quietly falling back."}
                    </span>
                  </div>
                  <div className="srow__c is-auto">
                    <span className={`tag ${k.set ? "is-on" : ""}`}>{k.set ? "Set" : "Not set"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="soon-note">
            A key is never sent back to the browser after it is saved, and this page does not draw a
            masked value of plausible length in its place — sixteen dots standing for nothing invites
            somebody to believe they have seen it.
          </p>
        </section>
      )}
    </>
  );
}
