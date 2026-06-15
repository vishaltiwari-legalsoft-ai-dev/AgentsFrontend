import React from 'react';

const CSS = `
.ens-tag{
  display:inline-flex; align-items:center; gap:6px; font-family:var(--font-sans);
  font-size:12px; font-weight:600; line-height:1; padding:5px 9px;
  border-radius:var(--radius-pill); white-space:nowrap;
  --_bg:var(--gray-100); --_fg:var(--gray-700);
  background:var(--_bg); color:var(--_fg);
}
.ens-tag__glyph{ display:inline-flex; }
.ens-tag__glyph svg{ width:13px; height:13px; }
.ens-tag__x{ display:inline-flex; cursor:pointer; opacity:.6; margin-right:-2px; }
.ens-tag__x:hover{ opacity:1; }
.ens-tag__x svg{ width:13px; height:13px; }
.ens-tag--design{ --_bg:var(--cat-design-bg); --_fg:var(--cat-design); }
.ens-tag--seo{ --_bg:var(--cat-seo-bg); --_fg:var(--cat-seo); }
.ens-tag--copy{ --_bg:var(--cat-copy-bg); --_fg:var(--cat-copy); }
.ens-tag--social{ --_bg:var(--cat-social-bg); --_fg:var(--cat-social); }
.ens-tag--ads{ --_bg:var(--cat-ads-bg); --_fg:var(--cat-ads); }
.ens-tag--data{ --_bg:var(--cat-data-bg); --_fg:var(--cat-data); }
`;
if (typeof document !== 'undefined' && !document.getElementById('ens-tag-css')) {
  const s = document.createElement('style'); s.id = 'ens-tag-css'; s.textContent = CSS; document.head.appendChild(s);
}

const X = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
);

export function Tag({ category, glyph, onRemove, className = '', children, ...rest }) {
  return (
    <span className={['ens-tag', category ? `ens-tag--${category}` : '', className].filter(Boolean).join(' ')} {...rest}>
      {glyph ? <span className="ens-tag__glyph">{glyph}</span> : null}
      {children}
      {onRemove ? <span className="ens-tag__x" role="button" aria-label="Remove" onClick={onRemove}><X /></span> : null}
    </span>
  );
}
