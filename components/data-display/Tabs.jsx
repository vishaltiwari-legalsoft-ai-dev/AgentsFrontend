import React from 'react';

const CSS = `
.ens-tabs{ display:inline-flex; align-items:center; gap:2px; font-family:var(--font-sans); }
.ens-tabs--line{ gap:22px; border-bottom:1px solid var(--border); display:flex; }
.ens-tabs--pill{ background:var(--gray-100); padding:3px; border-radius:var(--radius-md); }
.ens-tab{
  appearance:none; border:0; background:transparent; cursor:pointer;
  font-family:var(--font-sans); font-size:13.5px; font-weight:600; color:var(--text-secondary);
  display:inline-flex; align-items:center; gap:7px; white-space:nowrap;
  transition:color var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out);
}
.ens-tab svg{ width:15px; height:15px; }
.ens-tabs--pill .ens-tab{ padding:6px 14px; border-radius:var(--radius-sm); }
.ens-tabs--pill .ens-tab[aria-selected="true"]{ background:var(--surface); color:var(--text-primary); box-shadow:var(--shadow-sm); }
.ens-tabs--line .ens-tab{ padding:11px 0; position:relative; }
.ens-tabs--line .ens-tab[aria-selected="true"]{ color:var(--text-primary); }
.ens-tabs--line .ens-tab[aria-selected="true"]::after{
  content:""; position:absolute; left:0; right:0; bottom:-1px; height:2px; background:var(--ink); border-radius:2px 2px 0 0;
}
.ens-tab:hover{ color:var(--text-primary); }
.ens-tab__count{ font-family:var(--font-mono); font-size:11px; color:var(--text-tertiary); }
`;
if (typeof document !== 'undefined' && !document.getElementById('ens-tabs-css')) {
  const s = document.createElement('style'); s.id = 'ens-tabs-css'; s.textContent = CSS; document.head.appendChild(s);
}

export function Tabs({ items = [], value, onChange, variant = 'pill', className = '', ...rest }) {
  return (
    <div role="tablist" className={['ens-tabs', `ens-tabs--${variant}`, className].filter(Boolean).join(' ')} {...rest}>
      {items.map((it) => {
        const item = typeof it === 'string' ? { value: it, label: it } : it;
        const selected = item.value === value;
        return (
          <button
            key={item.value} role="tab" type="button" aria-selected={selected}
            className="ens-tab" onClick={() => onChange && onChange(item.value)}
          >
            {item.icon || null}
            {item.label}
            {item.count != null ? <span className="ens-tab__count">{item.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
