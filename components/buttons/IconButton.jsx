import React from 'react';

const CSS = `
.ens-iconbtn{
  --_bg:transparent; --_fg:var(--text-secondary); --_bgh:var(--surface-hover); --_bga:var(--surface-active); --_bd:transparent;
  display:inline-flex; align-items:center; justify-content:center;
  border:var(--border-w) solid var(--_bd); background:var(--_bg); color:var(--_fg);
  border-radius:var(--radius-md); cursor:pointer;
  transition:background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out);
}
.ens-iconbtn:hover{ background:var(--_bgh); color:var(--text-primary); }
.ens-iconbtn:active{ background:var(--_bga); }
.ens-iconbtn:focus-visible{ outline:none; box-shadow:var(--ring); }
.ens-iconbtn[disabled]{ opacity:.4; cursor:not-allowed; }
.ens-iconbtn--sm{ width:30px; height:30px; }
.ens-iconbtn--md{ width:36px; height:36px; }
.ens-iconbtn--lg{ width:42px; height:42px; }
.ens-iconbtn--solid{ --_bg:var(--surface); --_bd:var(--border-strong); box-shadow:var(--shadow-xs); }
.ens-iconbtn--brand{ --_bg:var(--brand); --_fg:#fff; --_bgh:var(--brand-hover); --_bga:var(--brand-active); }
.ens-iconbtn--brand:hover{ color:#fff; }
.ens-iconbtn svg{ width:1.05em; height:1.05em; display:block; }
.ens-iconbtn--sm svg{ font-size:15px; } .ens-iconbtn--md svg{ font-size:17px; } .ens-iconbtn--lg svg{ font-size:19px; }
`;
if (typeof document !== 'undefined' && !document.getElementById('ens-iconbtn-css')) {
  const s = document.createElement('style'); s.id = 'ens-iconbtn-css'; s.textContent = CSS; document.head.appendChild(s);
}

export function IconButton({ variant = 'ghost', size = 'md', label, className = '', children, ...rest }) {
  const cls = [
    'ens-iconbtn', `ens-iconbtn--${size}`,
    variant !== 'ghost' ? `ens-iconbtn--${variant}` : '', className,
  ].filter(Boolean).join(' ');
  return (
    <button type="button" className={cls} aria-label={label} title={label} {...rest}>
      {children}
    </button>
  );
}
