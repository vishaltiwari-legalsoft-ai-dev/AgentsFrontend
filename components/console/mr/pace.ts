/* Budget pace: the desk's standing question is not "what did we spend" but
   "are we ahead or behind for the day we're on". The portfolio endpoint already
   carries both halves of that answer — how much of the budget is burnt, and how
   far through the month we are — and the Overview never used either. */

export interface PaceRead {
  /** % of budget actually spent (uncapped — an overrun stays visible as a number). */
  spentPct: number;
  /** % of budget we'd expect to have spent by today. */
  expectedPct: number;
  /** spentPct clamped to the track, for drawing only. */
  barPct: number;
  day: number;
  daysInMonth: number;
  /** Absolute dollars between expected and actual burn. */
  deltaMoney: number;
  state: "under" | "on" | "over";
}

/** Inside this many points of expected, the month is on pace — a point either
 *  way is capture-time noise, not a decision. */
const ON_PACE_BAND = 3;

interface PaceInput {
  total_budget: number;
  total_spend: number;
  budget_utilized_pct: number | null;
  pacing: { day: number; days_in_month: number; expected_pct: number };
}

export function readPace(p: PaceInput | null): PaceRead | null {
  if (!p || !p.total_budget || p.budget_utilized_pct === null || !p.pacing) return null;

  const spentPct = p.budget_utilized_pct;
  const expectedPct = p.pacing.expected_pct;
  const diff = spentPct - expectedPct;
  const expectedMoney = (p.total_budget * expectedPct) / 100;

  return {
    spentPct,
    expectedPct,
    barPct: Math.max(0, Math.min(100, spentPct)),
    day: p.pacing.day,
    daysInMonth: p.pacing.days_in_month,
    deltaMoney: Math.round(Math.abs(expectedMoney - p.total_spend)),
    state: Math.abs(diff) <= ON_PACE_BAND ? "on" : diff > 0 ? "over" : "under",
  };
}
