import type { MrReportKind } from "@/lib/api";

export interface ReportMeta { label: string; eyebrow: string; desc: string }

export const REPORT_META: Record<MrReportKind, ReportMeta> = {
  daily_summary: {
    label: "Daily Performance Summary", eyebrow: "Daily · Marketing",
    desc: "Yesterday's spend, leads and demos per channel, flagged against the 2026 goals.",
  },
  weekly_summary: {
    label: "Weekly Performance Summary", eyebrow: "Weekly · Marketing",
    desc: "The week's blended KPIs with week-over-week movement per channel.",
  },
  threshold_alert: {
    label: "Campaign Threshold Alert", eyebrow: "Triggered · Alert",
    desc: "Every campaign currently breaching a cost ceiling — CPL, CAC or spend-with-no-demo.",
  },
  competitor_digest: {
    label: "Competitor Change Digest", eyebrow: "Weekly · Competitive intel",
    desc: "What changed on tracked competitors' sites and positioning this week.",
  },
  opportunity_report: {
    label: "Media Opportunity Report", eyebrow: "Bi-weekly · Partnerships",
    desc: "Podcasts, newsletters and placements ranked by ICP fit and audience.",
  },
  utm_attribution: {
    label: "UTM Attribution Summary", eyebrow: "Weekly · Attribution",
    desc: "Which campaigns and practice areas actually produce qualified leads.",
  },
  icp_signal: {
    label: "ICP Audience Signal", eyebrow: "Monthly · Audience",
    desc: "Where ideal-customer-profile buyers are showing up, scored and ranked.",
  },
};
