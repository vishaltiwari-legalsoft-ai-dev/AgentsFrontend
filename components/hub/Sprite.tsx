"use client";

/* The icon sprite, carried over verbatim from the prototype's index.html so a
   symbol added there can be pasted here without translation. It is a static,
   author-written string — no user data reaches it — and keeping it as raw markup
   avoids hand-converting 40+ SVG attributes into their JSX spellings and getting
   one of them silently wrong. */

const SPRITE = String.raw`
<symbol id="i-home" viewBox="0 0 20 20"><rect x="3" y="2.5" width="14" height="15" rx="1.6"/><path d="M3 7h14" stroke-width="2.6"/><path d="M6 11h8M6 14h5"/></symbol>
    <symbol id="i-issues" viewBox="0 0 20 20"><path d="M10 3.2 2.6 16.2h14.8z"/><path d="M10 8.4v3.4"/><path d="M10 14.2v.1"/></symbol>
    <symbol id="i-agents" viewBox="0 0 20 20"><rect x="3" y="3" width="6" height="6" rx="1.4"/><rect x="11" y="3" width="6" height="6" rx="1.4"/><rect x="3" y="11" width="6" height="6" rx="1.4"/><rect x="11" y="11" width="6" height="6" rx="1.4"/></symbol>
    <symbol id="i-runs" viewBox="0 0 20 20"><path d="M2.5 5h15M2.5 10h15M2.5 15h15"/><path d="M6 3v4M12.5 8v4M8.5 13v4"/></symbol>
    <symbol id="i-library" viewBox="0 0 20 20"><rect x="2.5" y="2.5" width="15" height="15" rx="2"/><path d="M2.5 13l4-4 3.5 3.5L13 9.5l4.5 4.5"/><circle cx="7" cy="6.8" r="1.3"/></symbol>
    <symbol id="i-models" viewBox="0 0 20 20"><path d="M4 3v6M4 13v4M10 3v3M10 10v7M16 3v8M16 15v2"/><circle cx="4" cy="11" r="1.9"/><circle cx="10" cy="8" r="1.9"/><circle cx="16" cy="13" r="1.9"/></symbol>
    <symbol id="i-integrations" viewBox="0 0 20 20"><path d="M7 2.5v4M13 2.5v4"/><rect x="4" y="6.5" width="12" height="5" rx="1.6"/><path d="M10 11.5v3a3 3 0 0 0 3 3h1.5"/></symbol>
    <symbol id="i-settings" viewBox="0 0 20 20"><circle cx="10" cy="10" r="2.6"/><path d="M10 2.5v2.2M10 15.3v2.2M3.7 6.4l1.9 1.1M14.4 12.5l1.9 1.1M3.7 13.6l1.9-1.1M14.4 7.5l1.9-1.1"/></symbol>
    <symbol id="i-admin" viewBox="0 0 20 20"><path d="M10 2.5 3.5 5v5c0 4 2.8 6.6 6.5 7.5 3.7-.9 6.5-3.5 6.5-7.5V5z"/><path d="M7.6 9.9 9.4 11.7l3.2-3.4"/></symbol>
    <symbol id="i-search" viewBox="0 0 20 20"><circle cx="9" cy="9" r="5.5"/><path d="M13.2 13.2 17 17"/></symbol>
    <symbol id="i-chevron" viewBox="0 0 20 20"><path d="M7.5 4.5 13 10l-5.5 5.5"/></symbol>
    <symbol id="i-plus" viewBox="0 0 20 20"><path d="M10 4v12M4 10h12"/></symbol>
    <symbol id="i-check" viewBox="0 0 20 20"><path d="m4.5 10.5 3.6 3.6L15.5 6"/></symbol>
    <symbol id="i-x" viewBox="0 0 20 20"><path d="M5 5l10 10M15 5 5 15"/></symbol>
    <symbol id="i-up" viewBox="0 0 20 20"><path d="M10 15.5v-11"/><path d="M5.2 9.3 10 4.5l4.8 4.8"/></symbol>
    <symbol id="i-send" viewBox="0 0 20 20"><path d="M17 3 9 11"/><path d="M17 3l-5.2 14-2.8-6-6-2.8z"/></symbol>
    <symbol id="i-download" viewBox="0 0 20 20"><path d="M10 3v9"/><path d="M6.2 8.4 10 12.2l3.8-3.8"/><path d="M3.5 15.5h13"/></symbol>
    <symbol id="i-sun" viewBox="0 0 20 20"><circle cx="10" cy="10" r="3.6"/><path d="M10 1.6v2.2M10 16.2v2.2M3.1 3.1l1.6 1.6M15.3 15.3l1.6 1.6M1.6 10h2.2M16.2 10h2.2M3.1 16.9l1.6-1.6M15.3 4.7l1.6-1.6"/></symbol>
    <symbol id="i-moon" viewBox="0 0 20 20"><path d="M16.2 12.4A6.9 6.9 0 0 1 7.6 3.8a6.9 6.9 0 1 0 8.6 8.6z"/></symbol>
    <symbol id="i-globe" viewBox="0 0 20 20"><circle cx="10" cy="10" r="7.4"/><path d="M2.6 10h14.8"/><ellipse cx="10" cy="10" rx="3.3" ry="7.4"/></symbol>
    <symbol id="i-fix" viewBox="0 0 20 20"><path d="M8.5 5h9M8.5 10h9M8.5 15h6"/><path d="m2.6 4.7 1.5 1.5 2.3-2.6"/><path d="m2.6 9.7 1.5 1.5 2.3-2.6"/></symbol>
    <symbol id="i-plan" viewBox="0 0 20 20"><rect x="2.6" y="4" width="14.8" height="13.4" rx="1.6"/><path d="M2.6 8.2h14.8" stroke-width="2.2"/><path d="M6.6 2.4v3.2M13.4 2.4v3.2"/><path d="M6.4 11.6h2.4M11.2 11.6h2.4M6.4 14.5h2.4"/></symbol>
    <symbol id="i-desk" viewBox="0 0 20 20"><path d="M2.8 15.4h14.4"/><path d="M4.6 15.4V9.2M8.8 15.4V5.4M13 15.4v-4.6M17.2 15.4V7"/></symbol>
    <symbol id="i-reports" viewBox="0 0 20 20"><rect x="4" y="2.8" width="12" height="14.4"/><path d="M7 6.6h6M7 10h6M7 13.4h3.6"/></symbol>
    <symbol id="i-vendors" viewBox="0 0 20 20"><rect x="2.6" y="6.4" width="6" height="11"/><rect x="11.4" y="2.6" width="6" height="14.8"/><path d="M4.6 9.4h2M4.6 12.4h2M13.4 5.6h2M13.4 8.6h2M13.4 11.6h2"/></symbol>
    <symbol id="i-leads" viewBox="0 0 20 20"><path d="M2.8 3.6h14.4L11.8 10v5.8l-3.6 1.8V10z"/></symbol>
    <symbol id="i-ask" viewBox="0 0 20 20"><path d="M2.8 3.4h14.4v10.2H8.6L4.6 17v-3.4H2.8z"/><path d="M7.6 7.1a2.4 2.4 0 1 1 2.4 2.4v1.2"/></symbol>
    <symbol id="i-data" viewBox="0 0 20 20"><rect x="2.8" y="3.4" width="14.4" height="13.2"/><path d="M2.8 7.6h14.4M2.8 12h14.4M7.4 3.4v13.2"/></symbol>
    <symbol id="i-lines" viewBox="0 0 20 20"><path d="M2.8 6.2h14.4M2.8 13.8h14.4"/><circle cx="7.2" cy="6.2" r="2.1"/><circle cx="13.4" cy="13.8" r="2.1"/></symbol>
    <symbol id="i-layers" viewBox="0 0 20 20"><path d="m10 2.8 6.6 3.5-6.6 3.5-6.6-3.5z"/><path d="m3.4 10 6.6 3.5 6.6-3.5"/><path d="m3.4 13.7 6.6 3.5 6.6-3.5"/></symbol>
    <symbol id="i-tries" viewBox="0 0 20 20"><rect x="2.8" y="2.8" width="6" height="6"/><rect x="11.2" y="2.8" width="6" height="6"/><rect x="2.8" y="11.2" width="6" height="6"/><rect x="11.2" y="11.2" width="6" height="6"/></symbol>
    <symbol id="i-kit" viewBox="0 0 20 20"><path d="M6.8 16.4 3.2 4.2h3.2l3.6 12.2z"/><path d="M13.2 16.4 16.8 4.2h-3.2L10 16.4z"/><path d="M7.6 12h4.8"/></symbol>
    <symbol id="i-draft" viewBox="0 0 20 20"><path d="M4.6 2.8h7l4 4v10.4H4.6z"/><path d="M11.4 2.8v4.2h4.2"/><path d="M7.2 10.4h5.6M7.2 13.4h4"/></symbol>
    <symbol id="i-research" viewBox="0 0 20 20"><circle cx="8.8" cy="8.8" r="5.4"/><path d="m12.8 12.8 4 4"/><path d="M6.4 8.8h4.8"/></symbol>
    <symbol id="i-bell" viewBox="0 0 20 20"><path d="M10 2.6a5 5 0 0 0-5 5c0 4-1.5 5.4-1.5 5.4h13S15 11.6 15 7.6a5 5 0 0 0-5-5z"/><path d="M8.4 16a1.9 1.9 0 0 0 3.2 0"/></symbol>
    <symbol id="i-overview" viewBox="0 0 20 20"><rect x="2.5" y="2.5" width="15" height="15" rx="2"/><path d="M2.5 7.5h15M7.5 7.5v10"/></symbol>
    <symbol id="i-trend" viewBox="0 0 20 20"><path d="M2.5 3v13.5H18"/><path d="M5 13l3.5-3.5 2.5 2.5L17 6"/></symbol>
    <symbol id="i-sources" viewBox="0 0 20 20"><path d="M8.5 11.5a3.2 3.2 0 0 0 4.6 0l2.6-2.6a3.2 3.2 0 0 0-4.6-4.5l-1 1"/><path d="M11.5 8.5a3.2 3.2 0 0 0-4.6 0l-2.6 2.6a3.2 3.2 0 0 0 4.6 4.5l1-1"/></symbol>
    <symbol id="i-competitors" viewBox="0 0 20 20"><rect x="3" y="8" width="4.5" height="9.5" rx="1.2"/><rect x="12.5" y="3" width="4.5" height="14.5" rx="1.2"/></symbol>
    <symbol id="i-optimizer" viewBox="0 0 20 20"><path d="M3 6h9M15 6h2M3 14h2M8 14h9"/><circle cx="13.4" cy="6" r="1.9"/><circle cx="6.4" cy="14" r="1.9"/></symbol>
    <symbol id="i-pages" viewBox="0 0 20 20"><path d="M6.4 2.6h6l3.2 3.2v11.6H6.4z"/><path d="M12.4 2.6v3.4h3.2"/><path d="M4.4 5.2v12.2h9"/><path d="M8.8 9.4h4.4M8.8 12.4h3"/></symbol>
    <symbol id="i-keywords" viewBox="0 0 20 20"><path d="M2.8 9.2V3.4h5.8l8 8-5.8 5.8z"/><circle cx="6.2" cy="6.8" r="1.3"/></symbol>
    <symbol id="i-health" viewBox="0 0 20 20"><rect x="2.5" y="4" width="15" height="12" rx="1.8"/><path d="M5.2 10.4h2.6l1.5-3.2 2.2 6 1.4-2.8h2.5"/></symbol>
    <symbol id="i-sweep" viewBox="0 0 20 20"><path d="M16.5 8.2A6.8 6.8 0 1 0 16 13"/><path d="M16.8 3.6v4.6h-4.6"/></symbol>
    <!-- GEO's sparklines fill to marigold; the stops are tokens so both themes are covered. -->
    <linearGradient id="g-mark" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" class="g-top" />
      <stop offset="1" class="g-foot" />
    </linearGradient>
`;

export function Sprite() {
  return (
    <svg
      className="sprite"
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: SPRITE }}
    />
  );
}

/** One sprite symbol, by the id suffix used in the prototype (`chevron` -> `#i-chevron`). */
export function Ic({ name, className }: { name: string; className?: string }) {
  return (
    <svg aria-hidden="true" className={className}>
      <use href={`#i-${name}`} />
    </svg>
  );
}
