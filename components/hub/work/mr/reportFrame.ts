/** The one way this console shows a report's HTML: inside a sandboxed iframe.
 *
 *  The login token lives in `localStorage` on the app's origin, and report HTML
 *  is not ours to trust — from Phase 2 any team member can upload a template.
 *  So report HTML never runs in this origin:
 *
 *  - **Inline**, it is the `srcdoc` of an `<iframe sandbox="">`. An empty
 *    sandbox grants nothing — no `allow-scripts`, no `allow-same-origin` — so
 *    the document gets an opaque origin, runs no script, submits no form, opens
 *    no popup and cannot navigate the page around it.
 *  - **In a new tab**, it is the same iframe, mounted in a blank tab this
 *    module builds with DOM calls. The tab is never pointed at a `blob:` or
 *    `data:` URL of the report: a `blob:` URL inherits this origin, so the
 *    report's own scripts would run next to the token.
 *
 *  Plain `.ts` with `createElement`, not `.tsx`, so `lineMap.test.ts` can import
 *  it and render the real element — the suite cannot import a `.tsx` module.
 */

import { createElement } from "react";

/** The sandbox every report frame carries. Empty on purpose: each token added
 *  here is a permission granted to HTML a team member uploaded. */
export const REPORT_SANDBOX = "";

/** The inline viewer. Full width, 80dvh, styled by `.rframe`. */
export function ReportFrame({ html, title }: { html: string; title: string }) {
  return createElement("iframe", {
    className: "rframe",
    title,
    srcDoc: html,
    sandbox: REPORT_SANDBOX,
    referrerPolicy: "no-referrer",
  });
}

/** A tab opened for one report, filled once its HTML is in hand. */
export interface ReportTab {
  show(html: string): void;
  close(): void;
}

/** The only parts of `window` this needs — so a test can hand in its own. */
export type TabOpener = Pick<Window, "open">;

/** What the blank tab shows before the report arrives. No colour values: the
 *  tab has none of the console's tokens, so it uses the browser's own. */
const SHELL_CSS =
  "html,body{margin:0;height:100%;overflow:hidden;background:Canvas;color:CanvasText}"
  + "iframe{display:block;width:100%;height:100vh;border:0}"
  + "p{margin:24px;font:14px/1.5 system-ui,sans-serif}";

/** Open a blank tab for a report, **synchronously** — call it straight from the
 *  click handler, before any `await`, or the browser treats it as a popup and
 *  blocks it. Returns null when the browser blocked it anyway.
 *
 *  The tab is `about:blank`, which shares this origin, so nothing in it may be
 *  the report's: the shell is built from DOM calls with no script and no HTML
 *  string, and the report goes in only as the `srcdoc` of a sandboxed iframe,
 *  with the sandbox set before the document is given to it. */
export function openReportTab(title: string, opener: TabOpener = window): ReportTab | null {
  const tab = opener.open("", "_blank");
  if (!tab) return null;
  // The tab is ours, not the report's, but nothing in it needs a way back.
  try { tab.opener = null; } catch { /* a browser that refuses is no worse off */ }

  const doc = tab.document;
  doc.title = title;
  const style = doc.createElement("style");
  style.textContent = SHELL_CSS;
  doc.head.appendChild(style);
  const status = doc.createElement("p");
  status.textContent = "Opening the report…";
  doc.body.appendChild(status);

  return {
    show(html: string) {
      const frame = doc.createElement("iframe");
      // Order matters: the sandbox is read when the frame first navigates, so it
      // is set before the document is handed over and before the frame is mounted.
      frame.setAttribute("sandbox", REPORT_SANDBOX);
      frame.setAttribute("referrerpolicy", "no-referrer");
      frame.setAttribute("title", title);
      frame.setAttribute("srcdoc", html);
      status.remove();
      doc.body.appendChild(frame);
    },
    close() {
      try { tab.close(); } catch { /* already gone */ }
    },
  };
}
