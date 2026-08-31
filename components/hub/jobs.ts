/** The jobs each specialist offers on Home, so starting one needs no typing.
 *
 *  These are affordances, not data: four ways into a specialist, written in the
 *  words someone would use for them. Two specialists genuinely start from a
 *  sentence, so their jobs seed the brief field. The other three start from a
 *  choice — which property, which of ten reports, which questions — that a
 *  preset cannot make, so theirs open the workspace at the section where that
 *  choice lives rather than pretending a click filed a run.
 */

export interface Job {
  label: string;
  spec: string;
  /** For a1 and a9: the brief this job seeds. */
  brief?: string;
  /** For a2, a6 and a10: where in the workspace this job actually begins. */
  section?: string;
}

export const JOBS: Record<string, Job[]> = {
  a1: [
    { label: "Social creative", spec: "1:1 · PNG", brief: "A square social creative for the campaign running now." },
    { label: "Hero banner", spec: "3:2 · PNG", brief: "A hero banner for the top of the landing page." },
    { label: "Ad set", spec: "four sizes", brief: "The same creative built out to all four paid placements." },
    { label: "Brochure page", spec: "PDF", brief: "A single service-overview page from the current copy." },
  ],
  a2: [
    { label: "Crawl a site", spec: "full audit", section: "fixes" },
    { label: "Fix list", spec: "ranked", section: "fixes" },
    { label: "Keyword gaps", spec: "vs rivals", section: "keywords" },
    { label: "Blog plan", spec: "next quarter", section: "plan" },
  ],
  a6: [
    { label: "Weekly summary", spec: "all channels", section: "reports" },
    { label: "Competitor digest", spec: "this month", section: "reports" },
    { label: "Funnel report", spec: "lead to signed", section: "leads" },
    { label: "Vendor lines", spec: "spend and pace", section: "vendors" },
  ],
  a9: [
    { label: "Research post", spec: "cited draft", brief: "A deep-research post with its evidence ledger attached." },
    { label: "Quarterly update", spec: "refresh", brief: "Update an existing post against this quarter's changes." },
    { label: "Comparison piece", spec: "us vs them", brief: "An honest side-by-side against the named alternatives." },
    { label: "FAQ page", spec: "from questions", brief: "Answer the buyer questions engines are already being asked." },
  ],
  a10: [
    { label: "Question check", spec: "every engine", section: "questions" },
    { label: "Answer audit", spec: "one question", section: "answers" },
    { label: "Rival visibility", spec: "who gets named", section: "competitors" },
    { label: "Page check", spec: "one URL", section: "optimizer" },
  ],
};
