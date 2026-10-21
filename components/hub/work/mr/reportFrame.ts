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
 *  The tab also carries a toolbar with "Download PDF". Its handler is a closure
 *  in **this** realm — the console's — so the PDF is fetched by the same API
 *  client, with the same token and the same error words, as the console's own
 *  button. No script is ever written into the tab: a self-sufficient tab would
 *  need its own copy of the token and the auth path, which is a second place
 *  for both to drift. The price is that the handler dies with the console tab,
 *  so the console's `pagehide` disables the button and says to reopen.
 *
 *  Plain `.ts` with `createElement`, not `.tsx`, so `lineMap.test.ts` can import
 *  it and render the real element — the suite cannot import a `.tsx` module.
 *  For the same reason nothing here imports from `@/`: the suite has no alias.
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

/** The PDF a report tab can download.
 *
 *  `fetchUrl` goes through the console's API client and answers an object URL
 *  of the bytes — the authenticated call the console's own PDF button makes.
 *  It rejects with an `Error` whose message is already for people: the tab has
 *  no toast, so the message *is* the status line. `unavailable` is the server's
 *  own reason when the renderer is not configured; the button is then disabled
 *  and the reason is shown verbatim, rather than offered and then failed. */
export interface ReportPdf {
  /** What the saved file is called, `.pdf` included. */
  fileName: string;
  fetchUrl: () => Promise<string>;
  unavailable: string | null;
}

/** The parts of `window` this needs — so a test can hand in its own. `open`
 *  makes the tab; `pagehide` on this window is when the download handler
 *  stops working, since it runs here. */
export type TabOpener = Pick<Window, "open" | "addEventListener" | "removeEventListener">;

/** What the toolbar says once the console tab that opened this one is gone:
 *  the handler ran there, and so did its login. */
export const REOPEN_LINE = "Reopen this report from the console to download its PDF.";

/** The toolbar's label while the bytes are on their way. */
export const PREPARING_LINE = "Preparing PDF…";

/** Under `@media print`, in place of the frame: a browser prints an iframe only
 *  as far as its visible box, so Ctrl+P here would hand over page one of a
 *  report and nothing else. Said instead of done silently. */
export const PRINT_NOTE = "This tab can't be printed in full — use Download PDF.";

/** The tab's own styling. No colour values: the tab has none of the console's
 *  tokens, so it uses the browser's system colours, which already follow the
 *  OS light and dark schemes. The iframe gives up the toolbar's height only
 *  when there is a toolbar (`.bar~iframe`). */
const SHELL_CSS =
  "html,body{margin:0;height:100%;overflow:hidden;background:Canvas;color:CanvasText;font:14px/1.5 system-ui,sans-serif}"
  + ".wait{margin:24px}"
  + ".bar{box-sizing:border-box;height:48px;display:flex;align-items:center;gap:12px;padding:0 16px;border-bottom:1px solid GrayText}"
  + ".bar button{font:inherit;padding:5px 12px;border:1px solid ButtonBorder;border-radius:6px;background:ButtonFace;color:ButtonText;cursor:pointer;white-space:nowrap}"
  + ".bar button:disabled{color:GrayText;cursor:default}"
  + ".bar button:focus-visible{outline:2px solid Highlight;outline-offset:2px}"
  + ".bar p{margin:0;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
  + ".print-note{display:none}"
  + "iframe{display:block;width:100%;height:100vh;border:0}"
  + ".bar~iframe{height:calc(100vh - 48px)}"
  + "@media print{.bar,.wait,iframe{display:none}.print-note{display:block;margin:24px}}";

/** Open a blank tab for a report, **synchronously** — call it straight from the
 *  click handler, before any `await`, or the browser treats it as a popup and
 *  blocks it. Returns null when the browser blocked it anyway.
 *
 *  The tab is `about:blank`, which shares this origin, so nothing in it may be
 *  the report's: the shell is built from DOM calls with no script and no HTML
 *  string, and the report goes in only as the `srcdoc` of a sandboxed iframe,
 *  with the sandbox set before the document is given to it. With a `pdf`, a
 *  toolbar goes in above the frame. */
export function openReportTab(
  title: string,
  pdf: ReportPdf | null = null,
  opener: TabOpener = window,
): ReportTab | null {
  const tab = opener.open("", "_blank");
  if (!tab) return null;
  // The tab is ours, not the report's, but nothing in it needs a way back.
  try { tab.opener = null; } catch { /* a browser that refuses is no worse off */ }

  const doc = tab.document;
  doc.title = title;
  const style = doc.createElement("style");
  style.textContent = SHELL_CSS;
  doc.head.appendChild(style);
  if (pdf) mountToolbar(tab, opener, pdf);
  const wait = doc.createElement("p");
  wait.setAttribute("class", "wait");
  wait.textContent = "Opening the report…";
  doc.body.appendChild(wait);

  return {
    show(html: string) {
      const frame = doc.createElement("iframe");
      // Order matters: the sandbox is read when the frame first navigates, so it
      // is set before the document is handed over and before the frame is mounted.
      frame.setAttribute("sandbox", REPORT_SANDBOX);
      frame.setAttribute("referrerpolicy", "no-referrer");
      frame.setAttribute("title", title);
      frame.setAttribute("srcdoc", html);
      wait.remove();
      doc.body.appendChild(frame);
    },
    close() {
      try { tab.close(); } catch { /* already gone */ }
    },
  };
}

/** The toolbar: one button, one status line, and the print-time note. Every
 *  word goes in through `textContent` — the status line carries server text,
 *  and an HTML sink would make that text markup. */
function mountToolbar(tab: Window, opener: TabOpener, pdf: ReportPdf): void {
  const doc = tab.document;
  const bar = doc.createElement("div");
  bar.setAttribute("class", "bar");
  bar.setAttribute("role", "toolbar");
  bar.setAttribute("aria-label", "Report");

  const button = doc.createElement("button");
  button.setAttribute("type", "button");
  button.setAttribute("aria-describedby", "pdf-status");
  button.textContent = "Download PDF";

  const status = doc.createElement("p");
  status.setAttribute("id", "pdf-status");
  status.setAttribute("role", "status");
  status.setAttribute("class", "status");

  const note = doc.createElement("p");
  note.setAttribute("class", "print-note");
  note.textContent = PRINT_NOTE;

  // Once the console tab is gone, so is this handler's realm and its login.
  let detached = false;
  const detach = () => {
    detached = true;
    button.disabled = true;
    status.textContent = REOPEN_LINE;
  };

  if (pdf.unavailable !== null) {
    button.disabled = true;
    status.textContent = pdf.unavailable;
  } else {
    let busy = false;
    button.addEventListener("click", () => {
      if (busy || detached) return;
      busy = true;
      button.disabled = true;
      status.textContent = PREPARING_LINE;
      void pdf.fetchUrl().then(
        (url) => {
          saveFrom(doc, url, pdf.fileName);
          status.textContent = `Handed ${pdf.fileName} to your browser to save.`;
        },
        (e: unknown) => {
          // Nothing saved: a failed fetch has no bytes, and no bytes is never a file.
          status.textContent = e instanceof Error && e.message.trim() ? e.message : "The PDF could not be prepared.";
        },
      ).finally(() => {
        busy = false;
        if (!detached) button.disabled = false;
      });
    });
    opener.addEventListener("pagehide", detach);
    // The tab closing first is the common case; it takes its listener with it.
    tab.addEventListener("pagehide", () => opener.removeEventListener("pagehide", detach));
  }

  bar.appendChild(button);
  bar.appendChild(status);
  doc.body.appendChild(bar);
  doc.body.appendChild(note);
}

/** Hand an object URL to the browser as a download — from the tab's own
 *  document, so the save belongs to the tab the person clicked in. Never
 *  navigated to: the `download` attribute saves it. Not revoked at once: some
 *  browsers still read the URL a moment after the click. Ten seconds is long
 *  past that and short of leaking it for the session. */
function saveFrom(doc: Document, url: string, fileName: string): void {
  const link = doc.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  doc.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
