import React from 'react';

const CSS = `
.ens-select-wrap{ position:relative; display:flex; flex-direction:column; gap:6px; font-family:var(--font-sans); }
.ens-select__label{ font-size:13px; font-weight:600; color:var(--text-primary); }
.ens-select__box{ position:relative; display:flex; align-items:center; }
.ens-select{
  appearance:none; -webkit-appearance:none; width:100%; box-sizing:border-box;
  font-family:var(--font-sans); font-size:14px; color:var(--text-primary);
  background:var(--surface); border:var(--border-w) solid var(--border-strong); border-radius:var(--radius-md);
  height:38px; padding:0 36px 0 12px; outline:none; cursor:pointer;
  transition:border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out);
}
.ens-select:hover{ border-color:var(--gray-400); }
.ens-select:focus{ border-color:var(--brand); box-shadow:var(--ring); }
.ens-select[disabled]{ background:var(--gray-50); color:var(--text-disabled); cursor:not-allowed; }
.ens-select__chev{ position:absolute; right:11px; pointer-events:none; color:var(--text-tertiary); display:inline-flex; }
.ens-select__chev svg{ width:16px; height:16px; }
`;
if (typeof document !== 'undefined' && !document.getElementById('ens-select-css')) {
  const s = document.createElement('style'); s.id = 'ens-select-css'; s.textContent = CSS; document.head.appendChild(s);
}

const Chevron = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
);

export function Select({ label, options = [], id, className = '', children, ...rest }) {
  const fid = id || (label ? 'sel-' + label.replace(/\s+/g, '-').toLowerCase() : undefined);
  return (
    <div className="ens-select-wrap">
      {label ? <label className="ens-select__label" htmlFor={fid}>{label}</label> : null}
      <div className="ens-select__box">
        <select id={fid} className={['ens-select', className].filter(Boolean).join(' ')} {...rest}>
          {children || options.map((o) => {
            const opt = typeof o === 'string' ? { value: o, label: o } : o;
            return <option key={opt.value} value={opt.value}>{opt.label}</option>;
          })}
        </select>
        <span className="ens-select__chev"><Chevron /></span>
      </div>
    </div>
  );
}
