/** Which line each flag crossed.
 *
 *  The desk reports flags by *metric* (`cost_per_qualified_lead`) and stores
 *  thresholds by *key* (`cost_per_qualified_lead_red`). The two vocabularies are
 *  close enough to look joinable and are not: `cost_per_qualified_lead_target_low`
 *  and `_target_high` share the same prefix and are not the red line, and
 *  `channel_goal` fires from the per-channel goals rather than from any single
 *  threshold at all.
 *
 *  Joining them by prefix therefore produces either a silent miss or a wrong
 *  attribution. The first is what shipped: the Lines panel said "none of them
 *  catching anything right now" on an account with forty findings on the Desk
 *  two clicks away.
 *
 *  So the map is written out, and `lines.test.ts` holds it to the vocabularies
 *  the API actually uses — a new threshold or a new flag metric turns the suite
 *  red rather than quietly reading as zero.
 */

/** The flag metric a threshold decides, or `null` when it decides something the
 *  desk does not raise a flag for. `null` is a claim too, and it is checked. */
export interface LineMeta {
  label: string;
  what: string;
  metric: string | null;
}

export const LINE_META: Record<string, LineMeta> = {
  cost_per_qualified_lead_red: {
    label: "Cost per qualified lead — red",
    what: "A qualified lead costing more than this is called out on the Desk and in every vendor dossier.",
    metric: "cost_per_qualified_lead",
  },
  cost_per_qualified_lead_target_low: {
    label: "Cost per qualified lead — target, low",
    what: "The bottom of the band the desk aims for. Under it is good news, not a finding, so nothing fires from it.",
    metric: null,
  },
  cost_per_qualified_lead_target_high: {
    label: "Cost per qualified lead — target, high",
    what: "The top of the band the desk aims for. Between here and the red line is watchable, not called out.",
    metric: null,
  },
  cost_per_booking_flag: {
    label: "Cost per demo booked",
    what: "The ceiling for a qualified demo booked. Over it, the campaign is called out as a watch.",
    metric: "cost_per_booking",
  },
  cac_red: {
    label: "Cost to win a customer — red",
    what: "What winning one customer is allowed to cost, all in. Over it is a finding.",
    metric: "cac",
  },
  cac_target: {
    label: "Cost to win a customer — target",
    what: "What the desk aims for. Sitting above it is not yet a finding; the red line is.",
    metric: null,
  },
  no_show_rate_red: {
    label: "No-show rate",
    what: "Above this share of resolved demos, no-shows are a finding on the lead table. The fix is booking and confirmation, not spend.",
    metric: "no_show_rate",
  },
  canceled_rate_red: {
    label: "Cancellation rate",
    what: "Above this share, cancellations are a finding. The fix is usually offer-match.",
    metric: "canceled_rate",
  },
  bad_lead_rate_red: {
    label: "Bad-lead rate",
    what: "Above this share, bad leads are a finding. The fix is lead quality at the source.",
    metric: "bad_lead_rate",
  },
  zero_completed_min_demos: {
    label: "Demos before zero-completed counts",
    what: "How many demos have to resolve before completing none of them is called a finding rather than a small sample.",
    metric: "zero_completed",
  },
  booking_rate_broken: {
    label: "Booking rate — broken",
    what: "Below this share of qualified leads booking, the booking step itself is called broken.",
    metric: "booking_broken",
  },
  spend_no_demo_limit: {
    label: "Spend with no demo",
    what: "Spend on a campaign that has booked nothing at all. Above this, it is called out.",
    metric: "spend_no_demo",
  },
  ql_ratio_great: {
    label: "Qualified-lead ratio — great",
    what: "The share of leads qualifying that the desk calls excellent. It marks good news, so nothing fires from it.",
    metric: null,
  },
  conversion_drop_pct: {
    label: "Conversion drop",
    what: "How far a conversion rate has to fall month on month before the drop is called out.",
    metric: "conversion_drop",
  },
  mgmt_fee_limit: {
    label: "Management fee share",
    what: "The share of spend that may go to management fees before it is called out.",
    metric: "mgmt_fee",
  },
};

/** Flag metrics that no single threshold owns, and why. Without this the test
 *  below could only check one direction, and a metric with no line would look
 *  like a mapping bug rather than what it is. */
export const METRICS_WITHOUT_A_LINE: Record<string, string> = {
  channel_goal:
    "Fires from the per-channel cost-per-demo goals rather than from one number — see the goals table on this panel.",
};

export const lineLabel = (key: string): string =>
  LINE_META[key]?.label ?? key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

export const lineWhat = (key: string): string =>
  LINE_META[key]?.what ?? "Used by the desk when it decides what to call out.";

export interface FlagGroupLike {
  metric: string | null;
  count: number;
}

/** How many findings this line is currently responsible for. `null` — rather
 *  than `0` — when the line does not raise flags at all, so the panel can say
 *  "this one does not fire" instead of "this one is catching nothing", which
 *  are different statements about the same dash. */
export function caughtBy(key: string, groups: readonly FlagGroupLike[]): number | null {
  const metric = LINE_META[key]?.metric;
  if (metric === null) return null;
  if (metric === undefined) return null;
  return groups.filter((g) => g.metric === metric).reduce((s, g) => s + g.count, 0);
}

/** Flag metrics this map does not attribute to a line, so the panel can say so
 *  rather than losing them. */
export function unattributed(groups: readonly FlagGroupLike[]): FlagGroupLike[] {
  const owned = new Set(Object.values(LINE_META).map((m) => m.metric).filter(Boolean));
  return groups.filter((g) => g.metric && !owned.has(g.metric));
}
