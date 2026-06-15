import React from 'react';

const CSS = `
.ens-check{ display:inline-flex; align-items:center; gap:10px; font-family:var(--font-sans); cursor:pointer; user-select:none; }
.ens-check input{ position:absolute; opacity:0; width:0; height:0; }
.ens-check__box{
  width:18px; height:18px; border-radius:var(--radius-xs); border:1.5px solid var(--border-strong);
  background:var(--surface); display:inline-flex; align-items:center; justify-content:center; flex:none;
  transition:background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out);
}
.ens-check__box svg{ width:13px; height:13px; color:#fff; opacity:0; transform:scale(.6); transition:opacity var(--dur-fast), transform var(--dur-fast) var(--ease-spring); }
.ens-check input:checked + .ens-check__box{ background:var(--brand); border-color:var(--brand); }
.ens-check input:checked + .ens-check__box svg{ opacity:1; transform:scale(1); }
.ens-check input:focus-visible + .ens-check__box{ box-shadow:var(--ring); }
.ens-check input:disabled + .ens-check__box{ opacity:.5; }
.ens-check--radio .ens-check__box{ border-radius:var(--radius-pill); }
.ens-check--radio .ens-check__dot{ width:8px; height:8px; border-radius:var(--radius-pill); background:#fff; opacity:0; transform:scale(.4); transition:opacity var(--dur-fast), transform var(--dur-fast) var(--ease-spring); }
.ens-check--radio input:checked + .ens-check__box .ens-check__dot{ opacity:1; transform:scale(1); }
.ens-check__label{ font-size:14px; color:var(--text-primary); }
`;
if (typeof document !== 'undefined' && !document.getElementById('ens-check-css')) {
  const s = document.createElement('style'); s.id = 'ens-check-css'; s.textContent = CSS; document.head.appendChild(s);
}

const Tick = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
);

export function Checkbox({ label, radio = false, className = '', ...rest }) {
  return (
    <label className={['ens-check', radio ? 'ens-check--radio' : '', className].filter(Boolean).join(' ')}>
      <input type={radio ? 'radio' : 'checkbox'} {...rest} />
      <span className="ens-check__box">{radio ? <span className="ens-check__dot" /> : <Tick />}</span>
      {label ? <span className="ens-check__label">{label}</span> : null}
    </label>
  );
}
