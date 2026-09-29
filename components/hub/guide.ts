/** The field guide Home is built from: one usage manual per live specialist,
 *  and the questions everyone asks in their first week.
 *
 *  This is authored content, not data — the manuals describe the real
 *  pipelines behind each workspace (the GD four-stage approval, the SEO
 *  ranked fix list, the MR report kinds, the GEO engine checks, the Inbox
 *  sheet), so a step here should only change when the workspace it describes
 *  does. Keyed by agent id from `model.ts`.
 */

export interface AgentGuide {
  /** When to reach for this one — a sentence, not a pitch. */
  when: string;
  /** The path through it, in the order a first run actually goes. */
  steps: string[];
  /** What lands at the end, and where it lives afterwards. */
  gets: string;
  /** The one thing people trip over, when there is one. */
  tip?: string;
}

export const GUIDES: Record<string, AgentGuide> = {
  a1: {
    when: "You need an on-brand visual — a social creative, a hero banner, an ad set, a brochure page — from a written brief.",
    steps: [
      "Press Give it work and say what the creative is for, or pick a ready job like Social creative.",
      "Pick the brand, so it pulls the right kit — colours, fonts, logo, references.",
      "Approve the four stages one at a time — background, element, text, logo — regenerating any attempt you don't like.",
      "Collect the finished PNG. If one detail is off, ask for a retouch instead of starting over.",
    ],
    gets: "A finished PNG per placement. Completed creatives are archived to the Library.",
    tip: "The more concrete the brief — audience, offer, occasion — the fewer regenerations you'll need.",
  },
  a2: {
    when: "You want to know what is holding a site back on search, and what to do about it in what order.",
    steps: [
      "Open the workspace and pick the site.",
      "Run a crawl — the full audit.",
      "Work the fix list: it is ranked by what each fix is worth, highest first.",
      "Check the keyword gaps against rivals, and take the blog plan for the quarter.",
    ],
    gets: "A ranked fix list and a quarterly blog plan, per brand.",
  },
  a6: {
    when: "You need the numbers story — campaign performance, competitors, the lead funnel, vendor spend — as a report you can hand over.",
    steps: [
      "Open the workspace at Reports and pick one of the ten report kinds — weekly summary, competitor digest, and so on.",
      "For the funnel, go straight to Leads; for spend and pace, Vendors.",
      "Read it in the workspace, or take the PDF.",
    ],
    gets: "A document and a PDF per report.",
  },
  a9: {
    when: "You want a blog post that survives scrutiny — researched in depth, with every claim carrying its citation.",
    steps: [
      "Press Give it work with the topic, or pick a job — research post, comparison piece, FAQ page.",
      "It researches first, then drafts: every claim in the draft is tied to a source.",
      "Review the draft beside its evidence ledger, then export Markdown or HTML.",
    ],
    gets: "A cited draft and its evidence ledger, per brand.",
  },
  a10: {
    when: "You want to know whether AI engines name and cite your brand when buyers ask them questions — and where you're invisible.",
    steps: [
      "Open the workspace at Questions — the buyer questions engines are being asked.",
      "Run a question check across every engine and read the scores.",
      "Open one answer to audit exactly who got named and cited, and check rival visibility.",
      "Take the page check and the action plan for the gaps worth fixing.",
    ],
    gets: "Five engines' answers to your buyer questions, scored — and the fixes.",
  },
  a12: {
    when: "Your inbox is the bottleneck: you want every message triaged into a sheet you own, without anything touching the mail itself.",
    steps: [
      "Open the workspace and connect Gmail with your Google sign-in.",
      "Point it at a Google Sheet you own.",
      "It writes one row per message every five minutes — sender, subject, category, summary, deadline, link — with deadlines collected on the Upcoming tab.",
    ],
    gets: "A triaged sheet that stays current on its own.",
    tip: "It only ever reads. It never sends, labels, deletes or marks mail.",
  },
};

/* --------------------------------------------------------------------- FAQ -- */

export interface Faq {
  q: string;
  a: string;
}

export const FAQS: Faq[] = [
  {
    q: "I pressed “Give it work”. What happens now?",
    a: "It files a run. You can watch it on Runs — queued, running, then done. When it finishes, the result is waiting in that specialist's workspace, and finished creatives are also archived to the Library.",
  },
  {
    q: "Where do finished things end up?",
    a: "Each workspace keeps its own record of what it made. Beyond that: creatives land in the Library as PNGs, research reports come with a PDF, and blog drafts export as Markdown or HTML.",
  },
  {
    q: "A run failed. Did I lose the work?",
    a: "No. A failed run is kept on purpose — open it on Runs to see exactly where it stopped and why. Fix what it names (often an integration or a missing input) and run it again.",
  },
  {
    q: "What are brands and kits?",
    a: "The brand registry is shared by the whole team. A kit is everything a brand owns — colours, fonts, logos, reference creatives — and the Graphic Designer pulls from it so nothing goes out off-brand. Kits are managed in the Library.",
  },
  {
    q: "Why can't I see Models, Schedule or Admin?",
    a: "They are gated by role. Models and Schedule belong to the creator account, Admin to admins. A GEO-only account sees just the GEO surface. If you need more, ask the account owner.",
  },
  {
    q: "How do integrations connect?",
    a: "Under Setup → Integrations. Each connection says what it is for — Gmail powers Inbox Triage, search data powers the SEO Analyst — and what state it is in. Anything broken there also shows up as an issue.",
  },
  {
    q: "What is the fastest way to move around?",
    a: "Ctrl K. It searches every panel and specialist from anywhere — type where you want to be and press Enter.",
  },
  {
    q: "What does the bell in the header mean?",
    a: "Announcements from the account owner. A dot on the bell means there is one you haven't seen; it opens in Settings.",
  },
];
