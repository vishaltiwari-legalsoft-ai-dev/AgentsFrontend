import React from 'react';

const CSS = `
.ens-switch{ display:inline-flex; align-items:center; gap:10px; font-family:var(--font-sans); cursor:pointer; user-select:none; }
.ens-switch input{ position:absolute; opacity:0; width:0; height:0; }
.ens-switch__track{
  width:38px; height:22px; border-radius:var(--radius-pill); background:var(--gray-300);
  position:relative; transition:background var(--dur-base) var(--ease-out); flex:none;
}
.ens-switch__thumb{
  position:absolute; top:2px; left:2px; width:18px; height:18px; border-radius:var(--radius-pill);
  background:#fff; box-shadow:var(--shadow-sm); transition:transform var(--dur-base) var(--ease-spring);
}
.ens-switch input:checked + .ens-switch__track{ background:var(--brand); }
.ens-switch input:checked + .ens-switch__track .ens-switch__thumb{ transform:translateX(16px); }
.ens-switch input:focus-visible + .ens-switch__track{ box-shadow:var(--ring); }
.ens-switch input:disabled + .ens-switch__track{ opacity:.5; }
.ens-switch__label{ font-size:14px; color:var(--text-primary); }
`;
if (typeof document !== 'undefined' && !document.getElementById('ens-switch-css')) {
  const s = document.createElement('style'); s.id = 'ens-switch-css'; s.textContent = CSS; document.head.appendChild(s);
}

export function Switch({ label, checked, defaultChecked, onChange, disabled, className = '', ...rest }) {
  return (
    <label className={['ens-switch', className].filter(Boolean).join(' ')}>
      <input type="checkbox" role="switch" checked={checked} defaultChecked={defaultChecked} onChange={onChange} disabled={disabled} {...rest} />
      <span className="ens-switch__track"><span className="ens-switch__thumb" /></span>
      {label ? <span className="ens-switch__label">{label}</span> : null}
    </label>
  );
}
