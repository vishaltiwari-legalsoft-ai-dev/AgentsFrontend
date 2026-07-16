import type { MrOverview, MrPortfolio } from "@/lib/api";
import { fmtMoney, fmtNum } from "./format";

export interface SummaryCell {
  label: string;
  value: string;
}

/** The eight metrics the desk agreed on (7/9 review), in two rows of four.
 *
 *  Preference order is the vendor snapshots (portfolio), which carry the real
 *  qualified-demo and services-sold figures. The pulled tracker is only a
 *  fallback: it has no qualified-demos-booked or services-sold concept at all,
 *  so those cells stay blank rather than borrowing the all-demos numbers —
 *  demos_booked under a "Qualified" label overstates the funnel, and
 *  cost_per_demo_booked understates the true cost per qualified demo.
 */
export function vendorSummaryRows(
  p: MrPortfolio | null,
  t: MrOverview["totals"],
): SummaryCell[][] {
  if (p) {
    return [
      [
        { label: "Spend", value: fmtMoney(p.total_spend) },
        { label: "Qualified Leads", value: fmtNum(p.qualified_leads) },
        { label: "Qualified Demos Booked", value: fmtNum(p.qual_demos_booked) },
        { label: "Demos Completed", value: fmtNum(p.demos_completed) },
      ],
      [
        { label: "Cost per Qualified Lead", value: fmtMoney(p.cost_per_qualified_lead) },
        { label: "Cost per Qualified Demo", value: fmtMoney(p.cost_per_qual_demo_booked) },
        { label: "Cost per Completed Demo", value: fmtMoney(p.cost_per_demo_completed) },
        { label: "Total Services Sold (Act.)", value: fmtNum(p.services_sold) },
      ],
    ];
  }
  if (t) {
    return [
      [
        { label: "Spend", value: fmtMoney(t.spend) },
        { label: "Qualified Leads", value: fmtNum(t.qualified_leads) },
        { label: "Qualified Demos Booked", value: "—" },
        { label: "Demos Completed", value: fmtNum(t.demos_completed) },
      ],
      [
        { label: "Cost per Qualified Lead", value: fmtMoney(t.cost_per_qualified_lead) },
        { label: "Cost per Qualified Demo", value: "—" },
        { label: "Cost per Completed Demo", value: fmtMoney(t.cost_per_demo_completed) },
        { label: "Total Services Sold (Act.)", value: "—" },
      ],
    ];
  }
  return [];
}
