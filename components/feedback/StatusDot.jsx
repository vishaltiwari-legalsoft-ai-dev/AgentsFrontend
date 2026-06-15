import React from 'react';

const CSS = `
.ens-status{ display:inline-flex; align-items:center; gap:7px; font-family:var(--font-sans); font-size:12.5px; font-weight:600; color:var(--text-secondary); }
.ens-status__dot{ position:relative; width:8px; height:8px; border-radius:var(--radius-pill); flex:none; }
.ens-status--idle .ens-status__dot{ background:var(--gray-400); }
.ens-status--running .ens-status__dot{ background:var(--brand); }
.ens-status--success .ens-status__dot{ background:var(--success); }
.ens-status--error .ens-status__dot{ background:var(--danger); }
.ens-status--paused .ens-status__dot{ background:var(--warning); }
.ens-status--running .ens-status__dot::after{
  content:""; position:absolute; inset:-4px; border-radius:var(--radius-pill);
  background:var(--brand); opacity:.35; animation:ens-ping 1.4s var(--ease-out) infinite;
}
@keyframes ens-ping{ 0%{ transform:scale(.6); opacity:.5; } 80%,100%{ transform:scale(1.8); opacity:0; } }
@media (prefers-reduced-motion: reduce){ .ens-status--running .ens-status__dot::after{ animation:none; } }
`;
if (typeof document !== 'undefined' && !document.getElementById('ens-status-css')) {
  const s = document.createElement('style'); s.id = 'ens-status-css'; s.textContent = CSS; document.head.appendChild(s);
}

const LABELS = { idle: 'Idle', running: 'Running', success: 'Done', error: 'Failed', paused: 'Paused' };

export function StatusDot({ status = 'idle', label, showLabel = true, className = '', ...rest }) {
  return (
    <span className={['ens-status', `ens-status--${status}`, className].filter(Boolean).join(' ')} {...rest}>
      <span className="ens-status__dot" />
      {showLabel ? <span>{label || LABELS[status]}</span> : null}
    </span>
  );
}
