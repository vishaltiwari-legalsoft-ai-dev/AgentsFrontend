"use client";

/** The questions people ask about this workspace, answered on the page.
 *
 *  Every answer here was a message somebody sent the team. The three that
 *  produced the most were "why does ChatGPT have three times as many answers as
 *  Google", "why can't I run a check" and "why did the score drop" — none of
 *  them a fault, all of them expensive to answer one person at a time.
 *
 *  It is deliberately static prose, and it takes no report. A page whose whole
 *  job is to explain the system must not be the page that goes missing when the
 *  system does — so it renders ahead of the workspace's own loading and failure
 *  guards, and asks for nothing but the brand's name and the window every figure
 *  is read over. Those two are passed in rather than hardcoded, so the copy
 *  cannot drift away from the panels it explains.
 */

import type { ReactNode } from "react";
import { PageHead, RuleHead } from "../../ui";

/** One question and its answer. Two to four sentences, plain words: an answer
 *  long enough to need skimming is one nobody reads. */
function Qa({ q, children }: { q: string; children: ReactNode }) {
  return (
    <div style={{ padding: "12px 0", borderBottom: "1px solid var(--rule)" }}>
      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em" }}>{q}</h3>
      <p className="help" style={{ marginTop: 5, fontSize: 13, lineHeight: 1.55, maxWidth: "78ch" }}>
        {children}
      </p>
    </div>
  );
}

export function GeoFaq({ brandName, days }: { brandName: string; days: number }) {
  return (
    <>
      <PageHead
        statement={<>What this page does, in <b>plain words</b>.</>}
        lede={
          <>
            These are the questions the team gets asked most. Nothing here is specific to{" "}
            {brandName} — it is how the whole workspace works, so you can tell a real problem from
            something behaving exactly as it was built to.
          </>
        }
      />

      <section className="band">
        <RuleHead
          title="What we measure"
          note="The one thing this workspace does, and the words it does it in."
        />

        <Qa q="What does this actually measure?">
          We keep a list of the questions your buyers would type, and we ask those questions to AI
          answer engines — ChatGPT, Gemini, Perplexity and Google&apos;s AI answers. Every answer
          they write is stored word for word, and we count how often your brand is named in them.
          Everything on the other pages is counted from those stored answers, over the last{" "}
          {days} days.
        </Qa>

        <Qa q="What counts as a “mention”?">
          A mention is your brand&apos;s name appearing in the text of an answer. We match the name
          on the brand plus any other spellings set up for it, so a run-together spelling and a
          spaced one both count. Being linked to as a source is counted separately: an engine can
          name you without linking to you, and link to you without naming you.
        </Qa>

        <Qa q="Why do the engines show different numbers of answers?">
          Because they are asked different numbers of times, on purpose. The chat engines — ChatGPT,
          Gemini and Perplexity — are asked each question three times, because they word their
          answers differently every time and we want to see how much they move. Google&apos;s
          engines are asked once, and on fewer questions, because we pay for every one of those
          calls. So ChatGPT having several times more answers than Google is expected and correct,
          not a fault and not a sign that the Google numbers are broken.
        </Qa>

        <Qa q="Why is a question shown as “not asked” instead of zero?">
          Because they are different findings. Zero means the engines answered and never said your
          name; not asked means we have no answer from them at all — usually the question was added
          after the last check, or that engine was switched off when the check ran. Turning a blank
          into a zero would report a result nobody measured.
        </Qa>
      </section>

      <section className="band">
        <RuleHead
          title="Running a check"
          note="Check Now, the daily limit, and what happens when two people press it."
        />

        <Qa q="What does “Check Now” do?">
          It asks every switched-on engine every question in the brand&apos;s set and stores what
          comes back. It runs in the background, so you can leave the page — the numbers fill in as
          answers arrive. A normal set takes a few minutes; a long list of questions takes longer,
          and a check that runs out of time picks up where it stopped on the next run.
        </Qa>

        <Qa q="Why can Check Now only be used once a day for a brand?">
          Every question sent to an engine costs money, and Google&apos;s answers are billed for
          each call, so a brand gets one check a day and no more. The limit is per brand, so a busy
          day on one brand never eats another brand&apos;s budget. Nothing is lost by waiting:
          engines change how they answer over weeks, not within an afternoon.
        </Qa>

        <Qa q="Someone else is running a check — why can’t I start one?">
          Only one check can run on a brand at a time. If someone else already has one running you
          are told so and asked to wait, rather than a second check starting alongside theirs. That
          is deliberate: two checks at once would ask the engines the same questions twice, and we
          would pay for both.
        </Qa>
      </section>

      <section className="band">
        <RuleHead
          title="The check that runs on its own"
          note="What happens without anybody pressing anything — and what it skips."
        />

        <Qa q="How often does a check run automatically?">
          You do not have to press anything. The schedule wakes up every night, looks at the brands
          that are switched on, and runs a check on the ones that are due — each brand has its own
          rhythm, set on the brand itself. The line at the top of Overview always names the last
          check for the brand you are looking at and when the next one is due.
        </Qa>

        <Qa q="This brand was switched off — why does its history have gaps?">
          A brand that is switched off is skipped by the automatic check, so nothing is stored for
          the days it stayed off. Those days show as gaps rather than zeroes, because we did not
          measure them and a zero would claim the engines never named you. Switching it back on
          starts filling history again from that day; the days that were missed stay missing.
        </Qa>

        <Qa q="Who can see this brand’s data?">
          Everyone who can open this panel can see every brand in it, and everything on these
          pages — questions, answers, sources and scores. There is no per-brand privacy today: if
          someone has access to the console, they can read this brand. Treat anything you add here
          as visible to the whole team.
        </Qa>
      </section>

      <section className="band">
        <RuleHead
          title="Your questions"
          note="What to write, what the two kinds of question tell you, and what deleting one does."
        />

        <Qa q="What makes a good question to add?">
          Write it the way somebody shopping would type it — short, specific, and about the thing
          they are trying to sort out. A question written to flatter you, like “why is this company
          the best”, gets an answer that tells you nothing, because nobody types that. If you would
          not type it yourself, it does not belong in the set.
        </Qa>

        <Qa q="What is the difference between a question that names the brand and one that does not?">
          A question that names you tells you what the engines say about you to somebody who already
          knows your name. A question that does not name you — “who handles after-hours calls for
          small law firms?” — tells you whether you get found at all, which is the harder test and
          the one most of your list should be. Keep a few of the first kind and many of the second.
        </Qa>

        <Qa q="I deleted a question — why is it still in the reports?">
          Deleting a question stops it being asked from the next check onwards; it does not delete
          the answers it already collected. Those answers stay until they fall outside the last{" "}
          {days} days, so a deleted question keeps appearing in the per-question reports for a
          while and then disappears on its own. Nothing is broken and nothing needs re-deleting.
        </Qa>
      </section>

      <section className="band">
        <RuleHead
          title="Reading the numbers"
          note="What a move in the score does and does not mean."
        />

        <Qa q="The score dropped — is something wrong?">
          Not on its own, no. Engines reword their answers constantly, and a check that reached
          fewer questions, or ran while one engine was slow, moves the number without anything
          changing about you. Look at the trend over several weeks rather than one check, and open
          the answers behind a question before treating a drop as a problem.
        </Qa>

        <Qa q="Two engines disagree about us — which one is right?">
          Both. They are separate products with separate sources, and they genuinely answer the
          same question differently; that spread is a finding, not an error to average away. When
          one engine never names you and another always does, the useful move is to read what the
          one that ignores you cited instead.
        </Qa>
      </section>
    </>
  );
}
