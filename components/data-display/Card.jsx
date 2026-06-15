import React from 'react';

const CSS = `
.ens-card{
  background:var(--surface-card); border:var(--border-w) solid var(--border);
  border-radius:var(--radius-xl); box-shadow:var(--shadow-xs);
  display:flex; flex-direction:column; overflow:hidden;
  transition:border-color var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out);
}
.ens-card--interactive{ cursor:pointer; }
.ens-card--interactive:hover{ border-color:var(--border-strong); box-shadow:var(--shadow-md); transform:translateY(-2px); }
.ens-card--interactive:active{ transform:translateY(0); box-shadow:var(--shadow-sm); }
.ens-card--selected{ border-color:var(--brand); box-shadow:0 0 0 1px var(--brand), var(--shadow-sm); }
.ens-card--flat{ box-shadow:none; }
.ens-card__body{ padding:var(--pad-card); display:flex; flex-direction:column; gap:10px; }
.ens-card__header{ padding:16px var(--pad-card); border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; gap:12px; }
.ens-card__footer{ padding:14px var(--pad-card); border-top:1px solid var(--border); background:var(--gray-25); }
.ens-card__title{ font-family:var(--font-display); font-size:16px; font-weight:600; letter-spacing:-0.01em; }
`;
if (typeof document !== 'undefined' && !document.getElementById('ens-card-css')) {
  const s = document.createElement('style'); s.id = 'ens-card-css'; s.textContent = CSS; document.head.appendChild(s);
}

export function Card({ interactive = false, selected = false, flat = false, className = '', children, ...rest }) {
  const cls = [
    'ens-card',
    interactive ? 'ens-card--interactive' : '',
    selected ? 'ens-card--selected' : '',
    flat ? 'ens-card--flat' : '', className,
  ].filter(Boolean).join(' ');
  return <div className={cls} {...rest}>{children}</div>;
}

export function CardHeader({ title, action, className = '', children, ...rest }) {
  return (
    <div className={['ens-card__header', className].filter(Boolean).join(' ')} {...rest}>
      {title ? <span className="ens-card__title">{title}</span> : children}
      {action || null}
    </div>
  );
}

export function CardBody({ className = '', children, ...rest }) {
  return <div className={['ens-card__body', className].filter(Boolean).join(' ')} {...rest}>{children}</div>;
}

export function CardFooter({ className = '', children, ...rest }) {
  return <div className={['ens-card__footer', className].filter(Boolean).join(' ')} {...rest}>{children}</div>;
}
