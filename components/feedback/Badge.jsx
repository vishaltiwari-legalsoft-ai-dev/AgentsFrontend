import React from 'react';

const CSS = `
.ens-badge{
  display:inline-flex; align-items:center; gap:5px; font-family:var(--font-sans);
  font-size:11.5px; font-weight:600; line-height:1; letter-spacing:0.01em;
  padding:4px 8px; border-radius:var(--radius-sm); white-space:nowrap;
  border:1px solid transparent;
}
.ens-badge--neutral{ background:var(--gray-100); color:var(--gray-700); }
.ens-badge--brand{ background:var(--brand-subtle); color:var(--brand-hover); }
.ens-badge--success{ background:var(--success-bg); color:var(--green-600); }
.ens-badge--warning{ background:var(--warning-bg); color:var(--amber-600); }
.ens-badge--danger{ background:var(--danger-bg); color:var(--red-600); }
.ens-badge--outline{ background:transparent; border-color:var(--border-strong); color:var(--text-secondary); }
.ens-badge__dot{ width:6px; height:6px; border-radius:var(--radius-pill); background:currentColor; }
.ens-badge svg{ width:12px; height:12px; }
`;
if (typeof document !== 'undefined' && !document.getElementById('ens-badge-css')) {
  const s = document.createElement('style'); s.id = 'ens-badge-css'; s.textContent = CSS; document.head.appendChild(s);
}

export function Badge({ variant = 'neutral', dot = false, icon, className = '', children, ...rest }) {
  return (
    <span className={['ens-badge', `ens-badge--${variant}`, className].filter(Boolean).join(' ')} {...rest}>
      {dot ? <span className="ens-badge__dot" /> : null}
      {icon || null}
      {children}
    </span>
  );
}
