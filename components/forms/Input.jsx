import React from 'react';

const CSS = `
.ens-field{ display:flex; flex-direction:column; gap:6px; font-family:var(--font-sans); }
.ens-field__label{ font-size:13px; font-weight:600; color:var(--text-primary); }
.ens-field__hint{ font-size:12px; color:var(--text-tertiary); }
.ens-field__err{ font-size:12px; color:var(--danger); }
.ens-input-wrap{ position:relative; display:flex; align-items:center; }
.ens-input{
  width:100%; box-sizing:border-box; font-family:var(--font-sans); font-size:14px; color:var(--text-primary);
  background:var(--surface); border:var(--border-w) solid var(--border-strong); border-radius:var(--radius-md);
  height:38px; padding:0 12px; outline:none;
  transition:border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out);
}
.ens-input::placeholder{ color:var(--text-disabled); }
.ens-input:hover{ border-color:var(--gray-400); }
.ens-input:focus{ border-color:var(--brand); box-shadow:var(--ring); }
.ens-input[disabled]{ background:var(--gray-50); color:var(--text-disabled); cursor:not-allowed; }
.ens-input--err{ border-color:var(--danger); }
.ens-input--err:focus{ box-shadow:0 0 0 3px color-mix(in srgb, var(--danger) 35%, transparent); }
.ens-input--has-icon{ padding-left:36px; }
.ens-input__icon{ position:absolute; left:11px; display:inline-flex; color:var(--text-tertiary); pointer-events:none; }
.ens-input__icon svg{ width:16px; height:16px; }
`;
if (typeof document !== 'undefined' && !document.getElementById('ens-input-css')) {
  const s = document.createElement('style'); s.id = 'ens-input-css'; s.textContent = CSS; document.head.appendChild(s);
}

export function Input({ label, hint, error, icon, id, className = '', ...rest }) {
  const fid = id || (label ? 'in-' + label.replace(/\s+/g, '-').toLowerCase() : undefined);
  return (
    <div className="ens-field">
      {label ? <label className="ens-field__label" htmlFor={fid}>{label}</label> : null}
      <div className="ens-input-wrap">
        {icon ? <span className="ens-input__icon">{icon}</span> : null}
        <input
          id={fid}
          className={['ens-input', icon ? 'ens-input--has-icon' : '', error ? 'ens-input--err' : '', className].filter(Boolean).join(' ')}
          aria-invalid={error ? true : undefined}
          {...rest}
        />
      </div>
      {error ? <span className="ens-field__err">{error}</span> : hint ? <span className="ens-field__hint">{hint}</span> : null}
    </div>
  );
}
