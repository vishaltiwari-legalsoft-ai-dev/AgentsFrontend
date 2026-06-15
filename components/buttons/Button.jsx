import React from 'react';

const CSS = `
.ens-btn{
  --_bg:var(--action); --_fg:var(--on-action); --_bd:transparent; --_bgh:var(--action-hover); --_bga:var(--action-active);
  display:inline-flex; align-items:center; justify-content:center; gap:8px;
  font-family:var(--font-sans); font-weight:var(--fw-semibold); letter-spacing:-0.005em;
  border:var(--border-w) solid var(--_bd); border-radius:var(--radius-md);
  background:var(--_bg); color:var(--_fg); cursor:pointer; white-space:nowrap;
  transition:background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out);
  user-select:none; text-decoration:none;
}
.ens-btn:hover{ background:var(--_bgh); }
.ens-btn:active{ background:var(--_bga); transform:translateY(0.5px); }
.ens-btn:focus-visible{ outline:none; box-shadow:var(--ring); }
.ens-btn[disabled],.ens-btn[aria-disabled="true"]{ opacity:.45; cursor:not-allowed; transform:none; }
.ens-btn--sm{ height:32px; padding:0 12px; font-size:13.5px; }
.ens-btn--md{ height:38px; padding:0 16px; font-size:14px; }
.ens-btn--lg{ height:46px; padding:0 22px; font-size:15.5px; border-radius:var(--radius-lg); }
.ens-btn--full{ width:100%; }
.ens-btn--brand{ --_bg:var(--brand); --_fg:var(--on-brand); --_bgh:var(--brand-hover); --_bga:var(--brand-active); }
.ens-btn--accent{ --_bg:var(--accent); --_fg:var(--on-accent); --_bgh:var(--accent-hover); --_bga:var(--accent-active); }
.ens-btn--gradient{ background:var(--grad-brand); color:#fff; border-color:transparent; background-size:140% 140%; background-position:0% 0%; transition:background-position var(--dur-base) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out); }
.ens-btn--gradient:hover{ background-position:100% 100%; box-shadow:0 6px 18px -6px color-mix(in srgb, var(--blue-700) 55%, transparent); }
.ens-btn--gradient:active{ transform:translateY(0.5px); }
.ens-btn--secondary{ --_bg:var(--surface); --_fg:var(--text-primary); --_bd:var(--border-strong); --_bgh:var(--surface-hover); --_bga:var(--surface-active); box-shadow:var(--shadow-xs); }
.ens-btn--ghost{ --_bg:transparent; --_fg:var(--text-primary); --_bgh:var(--surface-hover); --_bga:var(--surface-active); }
.ens-btn--danger{ --_bg:var(--danger); --_fg:#fff; --_bgh:var(--danger-hover); --_bga:var(--danger-hover); }
.ens-btn__icon{ display:inline-flex; width:1.05em; height:1.05em; }
.ens-btn__icon svg{ width:100%; height:100%; }
`;
if (typeof document !== 'undefined' && !document.getElementById('ens-button-css')) {
  const s = document.createElement('style'); s.id = 'ens-button-css'; s.textContent = CSS; document.head.appendChild(s);
}

export function Button({
  variant = 'primary', size = 'md', fullWidth = false,
  iconLeft, iconRight, as = 'button', className = '', children, ...rest
}) {
  const Tag = as;
  const cls = [
    'ens-btn', `ens-btn--${size}`,
    variant !== 'primary' ? `ens-btn--${variant}` : '',
    fullWidth ? 'ens-btn--full' : '', className,
  ].filter(Boolean).join(' ');
  return (
    <Tag className={cls} {...rest}>
      {iconLeft ? <span className="ens-btn__icon">{iconLeft}</span> : null}
      {children}
      {iconRight ? <span className="ens-btn__icon">{iconRight}</span> : null}
    </Tag>
  );
}
