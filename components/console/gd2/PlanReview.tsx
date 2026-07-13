"use client";

import { useState } from "react";
import type { GdPlan, GdVariant } from "@/lib/api";
import type { AutoAccept } from "./autoPilot";

/* Auto-mode plan review: the AI's four picks, each with a reason and an
   accept checkbox (text is editable inline). Unticked rows make Auto mode
   pause at that step so the user chooses manually. */
export function PlanReview({
  plan,
  stage1,
  stage2,
  busy,
  onRun,
  onSkip,
}: {
  plan: GdPlan;
  stage1: GdVariant[];
  stage2: GdVariant[];
  busy: boolean;
  onRun: (accept: AutoAccept, text: GdPlan["text"]) => void;
  onSkip: () => void;
}) {
  const [accept, setAccept] = useState<AutoAccept>({
    gradient: true, element: true, text: true, logo: true,
  });
  const [text, setText] = useState(plan.text);
  const v1 = stage1.find((v) => v.id === plan.gradient.cid);
  const v2 = stage2.find((v) => v.id === plan.element.cid);

  const row = (
    key: keyof AutoAccept,
    title: string,
    body: React.ReactNode,
    reason: string,
  ) => (
    <div className={`gd2-planrow ${accept[key] ? "" : "gd2-planrow--off"}`}>
      <label className="gd2-planrow-head">
        <input
          type="checkbox"
          checked={accept[key]}
          onChange={(e) => setAccept((a) => ({ ...a, [key]: e.target.checked }))}
        />
        <b>{title}</b>
      </label>
      <div className="gd2-planrow-body">{body}</div>
      {reason ? <p className="gd2-planrow-why">{reason}</p> : null}
    </div>
  );

  return (
    <>
      <span className="gd2-step-eyebrow">Auto mode · plan review</span>
      <h2 className="gd2-paneltitle">Here’s the plan</h2>
      <p className="gd2-help">
        {plan.concept} Untick anything you’d rather pick yourself — Auto mode pauses there for you.
      </p>
      {row("gradient", "1 · Background",
        <span className="gd2-planpick">
          {v1?.css_gradient ? <i className="gd2-planswatch" style={{ background: v1.css_gradient }} /> : null}
          {v1?.title ?? plan.gradient.cid}
        </span>,
        plan.gradient.reason)}
      {row("element", "2 · Main image", <span>{v2?.title ?? plan.element.cid}</span>, plan.element.reason)}
      {row("text", "3 · Your words",
        <span className="gd2-plantext">
          <input value={text.headline} placeholder="Headline"
                 onChange={(e) => setText((t) => ({ ...t, headline: e.target.value }))} />
          <input value={text.subline} placeholder="Supporting line"
                 onChange={(e) => setText((t) => ({ ...t, subline: e.target.value }))} />
          <input value={text.cta} placeholder="Button text"
                 onChange={(e) => setText((t) => ({ ...t, cta: e.target.value }))} />
        </span>,
        plan.text.reason)}
      {row("logo", "4 · Logo", <span>{plan.logo.logo_id ?? "Brand default"}</span>, plan.logo.reason)}
      <div className="gd2-actionrow">
        <button className="gd2-btn gd2-btn--soft" onClick={onSkip} disabled={busy}>
          Skip to manual
        </button>
        <button className="gd2-btn" onClick={() => onRun(accept, text)} disabled={busy}>
          Run plan ▶
        </button>
      </div>
    </>
  );
}
