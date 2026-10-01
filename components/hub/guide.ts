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
      "Press New work in the header and say what the creative is for, or pick a ready job like Social creative.",
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
      "Press New work with the topic, or pick a job — research post, comparison piece, FAQ page.",
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
    q: "If I close the tab while something is running, does the run die?",
    a: "No. Runs execute on the backend, not in your browser — close the tab, go to lunch, come back. The run will have carried on without you; Runs shows where it landed.",
  },
  {
    q: "The result is 90% right. Do I have to start over for the last 10%?",
    a: "Rarely. The Graphic Designer takes a retouch instruction on the finished creative, and any of its four stages can be regenerated alone. The Blog Writer updates an existing post rather than rewriting it. Starting over is for a different brief, not a different detail.",
  },
  {
    q: "A run failed. Did I lose the work?",
    a: "No. A failed run is kept on purpose — open it on Runs to see exactly where it stopped and why. Fix what it names (often an integration or a missing input) and run it again.",
  },
  {
    q: "How do I make sure everything comes out on-brand?",
    a: "Keep the brand's kit complete in the Library — colours, fonts, logos, and real reference creatives. The Graphic Designer pulls from the kit on every run, so the kit is where “on-brand” is defined. When output drifts, a thin kit is usually why.",
  },
  {
    q: "Will teammates and I step on each other's work?",
    a: "Runs are personal — the record you see is your own work, and nobody can touch it. Brands and kits are shared by the whole team, so editing a kit changes what everyone's next creative pulls. Run things freely; change kits deliberately.",
  },
  {
    q: "What is this costing us?",
    a: "The figures beside the page title are the account's live numbers — tokens used, credits left, and 30-day spend. A single run's cost is not recorded anywhere, so no per-run price is shown; the 30-day figure is the one to watch.",
  },
  {
    q: "Is Inbox Triage safe to point at a real mailbox?",
    a: "Yes — its access is read-only. It cannot send, label, delete or mark mail. The only thing it writes is rows in a Google Sheet you own: one per message, refreshed every five minutes, deadlines gathered on the Upcoming tab.",
  },
  {
    q: "Something looks broken. Where do I look first?",
    a: "Issues. Every problem the hub knows about is there in plain words, most severe first, each with a button to the place it gets fixed. If a connection is the culprit, its state also shows under Setup → Integrations.",
  },
  {
    q: "Why can't I see Models, Schedule or Admin?",
    a: "They are gated by role: Models and Schedule belong to the creator account, Admin to admins, and a GEO-only account sees just the GEO surface. Needing one of them is a request to the account owner, not a bug.",
  },
  {
    q: "What is the fastest way to get anywhere?",
    a: "Ctrl K, from any screen. Type the panel or specialist you want and press Enter — it beats any amount of clicking.",
  },
];
