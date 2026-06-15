import React from 'react';
import { Tag } from '../feedback/Tag.jsx';
import { StatusDot } from '../feedback/StatusDot.jsx';
import { Button } from '../buttons/Button.jsx';

const CSS = `
.ens-agentcard{
  background:var(--surface-card); border:1px solid var(--border); border-radius:var(--radius-xl);
  box-shadow:var(--shadow-xs); padding:18px; display:flex; flex-direction:column; gap:14px;
  transition:border-color var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out);
}
.ens-agentcard--interactive{ cursor:pointer; }
.ens-agentcard--interactive:hover{ border-color:var(--border-strong); box-shadow:var(--shadow-md); transform:translateY(-2px); }
.ens-agentcard__top{ display:flex; align-items:flex-start; gap:13px; }
.ens-agentcard__glyph{
  width:44px; height:44px; border-radius:var(--radius-lg); flex:none;
  display:flex; align-items:center; justify-content:center;
}
.ens-agentcard__glyph svg{ width:22px; height:22px; }
.ens-agentcard__name{ font-family:var(--font-display); font-size:16px; font-weight:600; letter-spacing:-0.01em; color:var(--text-primary); }
.ens-agentcard__role{ font-size:12.5px; color:var(--text-tertiary); margin-top:1px; }
.ens-agentcard__desc{ font-size:13.5px; line-height:1.5; color:var(--text-secondary); margin:0; }
.ens-agentcard__foot{ display:flex; align-items:center; justify-content:space-between; gap:10px; margin-top:2px; }
.ens-agentcard__meta{ display:flex; align-items:center; gap:6px; font-family:var(--font-mono); font-size:11px; color:var(--text-tertiary); }
`;
if (typeof document !== 'undefined' && !document.getElementById('ens-agentcard-css')) {
  const s = document.createElement('style'); s.id = 'ens-agentcard-css'; s.textContent = CSS; document.head.appendChild(s);
}

const CAT_LABEL = { design: 'Design', seo: 'SEO', copy: 'Copy', social: 'Social', ads: 'Ads', data: 'Data' };

export function AgentCard({
  name, role, description, category = 'design', glyph, status,
  added = false, onAdd, interactive = false, className = '', ...rest
}) {
  const bg = `var(--cat-${category}-bg)`;
  const fg = `var(--cat-${category})`;
  return (
    <div className={['ens-agentcard', interactive ? 'ens-agentcard--interactive' : '', className].filter(Boolean).join(' ')} {...rest}>
      <div className="ens-agentcard__top">
        <span className="ens-agentcard__glyph" style={{ background: bg, color: fg }}>{glyph}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ens-agentcard__name">{name}</div>
          <div className="ens-agentcard__role">{role}</div>
        </div>
        <Tag category={category}>{CAT_LABEL[category]}</Tag>
      </div>
      {description ? <p className="ens-agentcard__desc">{description}</p> : null}
      <div className="ens-agentcard__foot">
        {status ? <StatusDot status={status} /> : <span className="ens-agentcard__meta">Specialist agent</span>}
        {onAdd ? (
          <Button size="sm" variant={added ? 'secondary' : 'primary'} onClick={onAdd}>
            {added ? 'Added' : 'Add to team'}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
