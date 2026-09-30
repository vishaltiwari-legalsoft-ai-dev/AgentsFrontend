"use client";

/** The hero vignette: the product demonstrating itself, on a loop.
 *
 *  A brief is typed, a run files and fills, and the finished artifact
 *  materialises — three scenes, three kinds of work (a creative, a report, a
 *  cited draft), then round again. Drawn fresh for the revamp: nothing here
 *  is a component of the old console, and nothing is fetched — the artifacts
 *  are pictures of the idea, not real runs.
 *
 *  Decoration only: the whole stage is aria-hidden, and a reduced-motion
 *  request skips the theatre — the first scene rests in its finished state.
 */

import { useEffect, useRef, useState } from "react";

const SCENES = [
  {
    agent: "Graphic Designer",
    brief: "A hero banner for the festive sale — warm, premium, on-brand.",
    kind: "creative" as const,
    out: "hero-banner.png",
  },
  {
    agent: "Marketing Research",
    brief: "This week's performance across every channel, as one report.",
    kind: "report" as const,
    out: "weekly-summary.pdf",
  },
  {
    agent: "Blog Writer",
    brief: "A cited post: what AI triage saves a legal team every week.",
    kind: "draft" as const,
    out: "triage-post.md",
  },
];

type Phase = "typing" | "running" | "done";

export default function HeroDemo() {
  const [scene, setScene] = useState(0);
  const [phase, setPhase] = useState<Phase>("typing");
  const [typed, setTyped] = useState(0);
  const still = useRef(false);

  const s = SCENES[scene];

  // A reduced-motion request skips the theatre entirely.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      still.current = true;
      setTyped(SCENES[0].brief.length);
      setPhase("done");
    }
  }, []);

  // The brief types itself…
  useEffect(() => {
    if (still.current || phase !== "typing") return;
    if (typed >= s.brief.length) {
      const t = setTimeout(() => setPhase("running"), 420);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setTyped((n) => n + 1), 24 + Math.random() * 26);
    return () => clearTimeout(t);
  }, [phase, typed, s.brief.length]);

  // …the run fills…
  useEffect(() => {
    if (still.current || phase !== "running") return;
    const t = setTimeout(() => setPhase("done"), 1750);
    return () => clearTimeout(t);
  }, [phase]);

  // …the artifact holds, then the next scene begins.
  useEffect(() => {
    if (still.current || phase !== "done") return;
    const t = setTimeout(() => {
      setScene((c) => (c + 1) % SCENES.length);
      setTyped(0);
      setPhase("typing");
    }, 3800);
    return () => clearTimeout(t);
  }, [phase]);

  return (
    <div className={`demo demo--${phase}`} aria-hidden="true">
      <header className="demo__bar">
        <span className="demo__glyph" />
        <b>{s.agent}</b>
        <span className={`demo__state demo__state--${phase}`}>
          {phase === "typing" ? "Briefing" : phase === "running" ? "Running" : "Done"}
        </span>
      </header>

      <div className="demo__brief">
        <p>
          {s.brief.slice(0, typed)}
          <i className="demo__caret" />
        </p>
      </div>

      <div className="demo__run"><i /></div>

      <div className="demo__out">
        {phase === "done" && (
          <>
            {s.kind === "creative" && (
              <div className="art art--creative">
                <i /><i />
                <b />
              </div>
            )}
            {s.kind === "report" && (
              <div className="art art--report">
                <i className="art__title" />
                <i /><i />
                <span className="art__chart"><i /><i /><i /><i /><i /></span>
              </div>
            )}
            {s.kind === "draft" && (
              <div className="art art--draft">
                <i /><i /><i /><i />
                <span className="art__cites"><u>[1]</u><u>[2]</u><u>[3]</u></span>
              </div>
            )}
            <p className="demo__file">{s.out} · delivered to the workspace</p>
          </>
        )}
      </div>
    </div>
  );
}
