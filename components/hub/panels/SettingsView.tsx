"use client";

/** Settings — what you can actually change.
 *
 *  The prototype's Settings page had eleven controls: a workspace name, a
 *  default brand, a time zone, four notification switches, a retention period,
 *  a storage figure and a delete-workspace button. Exactly one of them —
 *  appearance — has anything behind it in this backend.
 *
 *  Shipping the other ten as controls that save nothing is the same defect the
 *  old Integrations page had, where Connect flipped a `useState` and announced
 *  success. So this page carries what is real, and then says plainly what is
 *  not settable yet and where each of those decisions currently lives. A short
 *  honest page beats a long page of switches that do nothing.
 */

import { useEffect, useState } from "react";
import { useHeadline, useHub } from "../context";
import { Ic } from "../Sprite";
import { PageHead, RuleHead } from "../ui";
import { todayKey, useTasks } from "../useTasks";

const THEME_KEY = "app-theme";

export function SettingsView() {
  const { user, toast } = useHub();
  const tasks = useTasks();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [zone, setZone] = useState("");

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    try {
      setZone(Intl.DateTimeFormat().resolvedOptions().timeZone || "");
    } catch {
      setZone("");
    }
  }, []);

  const pick = (next: "light" | "dark") => {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* storage off — the choice still holds for this session */
    }
    setTheme(next);
  };

  const clearList = () => {
    if (tasks.tasks.length === 0) {
      toast("Your list is already empty.", "warn");
      return;
    }
    tasks.tasks.forEach((t) => tasks.drop(t.id));
    toast("Your list has been cleared on this browser.", "ok");
  };

  const tier = user.is_creator ? "creator" : user.is_admin ? "admin" : "member";
  useHeadline(`${user.email} · ${tier}`);

  return (
    <>
      <PageHead
        statement={<>You are signed in as <b>{user.name || user.email}</b>.</>}
        lede="What is on this page is what this console can actually change. Everything else is listed at the foot with where the decision really lives, rather than shown here as a switch that saves nothing."
      />

      <section className="band">
        <RuleHead title="You" note="Read from the account you signed in with. Changed in Google, not here." />
        <div className="rows">
          <Row title="Name" note="Shown in the rail and on anything you file.">
            <b style={{ fontSize: 13 }}>{user.name || "—"}</b>
          </Row>
          <Row title="Email" note="Your identity across the console. Runs you start are filed against it.">
            <b style={{ fontSize: 13 }}>{user.email}</b>
          </Row>
          <Row
            title="Access"
            note={
              tier === "creator"
                ? "A creator sees Models and the key settings on Admin, and can change what every specialist runs on."
                : tier === "admin"
                  ? "An admin sees the Admin page — the people, the usage and the collections."
                  : "A member can open every specialist and see their own record."
            }
          >
            <span className="tag is-on">{tier}</span>
          </Row>
          <Row title="Time zone" note="Read from this browser. Every time and day on the record is drawn in it.">
            <b style={{ fontSize: 13 }}>{zone || "unknown"}</b>
          </Row>
        </div>
      </section>

      <section className="band">
        <RuleHead title="Appearance" note="Follows your system setting until you choose here." />
        <div className="themes">
          <button
            type="button"
            className={`theme-pick${theme === "light" ? " is-on" : ""}`}
            onClick={() => pick("light")}
          >
            <i className="lt" />
            <span><b>Light</b><span>Ink rail on paper</span></span>
          </button>
          <button
            type="button"
            className={`theme-pick${theme === "dark" ? " is-on" : ""}`}
            onClick={() => pick("dark")}
          >
            <i className="dk" />
            <span><b>Dark</b><span>Ink rail on ink</span></span>
          </button>
        </div>
        <p className="soon-note">Motion already follows your system&apos;s reduce-motion setting.</p>
      </section>

      <section className="band">
        <RuleHead title="Your list" note="The one thing on Home you author. It is kept in this browser." />
        <div className="rows">
          <Row
            title="Where it lives"
            note="In this browser's storage, not in the workspace. It does not follow you to another machine, and nobody else can see it."
          >
            <b style={{ fontSize: 13 }}>
              {tasks.ready ? `${tasks.tasks.length} item${tasks.tasks.length === 1 ? "" : "s"}, ${tasks.open} open` : "…"}
            </b>
          </Row>
          <Row title="Clear it" note="Removes every task, finished and unfinished. There is no undo.">
            <button type="button" className="btn btn--quiet btn--sm" onClick={clearList}>
              <Ic name="x" />
              Clear my list
            </button>
          </Row>
        </div>
      </section>

      <section className="band">
        <RuleHead
          title="Not settable here yet"
          note="Listed so you know where each decision actually lives, rather than being offered a switch that saves nothing."
        />
        <div className="rows">
          <Row title="Which brands exist" note="Added inside the specialist that owns them — the SEO Analyst for search properties, the Graphic Designer for brand kits.">
            <span className="tag">In the workspace</span>
          </Row>
          <Row title="Which model each specialist uses" note="On the Models page, which a creator can open. A change there applies to the next run.">
            <span className="tag">Models</span>
          </Row>
          <Row title="When scheduled work runs" note="Cron on the deployment hits the backend directly. Changing a schedule is a deployment change, not a setting.">
            <span className="tag">Deployment</span>
          </Row>
          <Row title="How long artifacts are kept" note="Nothing expires them today. Snapshots, run rows and events grow continuously and have no lifecycle yet — that is a known gap, not a hidden setting.">
            <span className="tag">Not built</span>
          </Row>
          <Row title="Email when a run fails" note="No notification rail exists. A failed run is visible on Runs and on Home, and nowhere else.">
            <span className="tag">Not built</span>
          </Row>
        </div>
      </section>
    </>
  );
}

function Row({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <div className="srow">
      <div className="srow__t"><b>{title}</b><span>{note}</span></div>
      <div className="srow__c is-auto">{children}</div>
    </div>
  );
}

export { todayKey };
