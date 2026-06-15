import React from 'react';
import { Avatar, AvatarGroup } from '../data-display/Avatar.jsx';
import { StatusDot } from '../feedback/StatusDot.jsx';
import { Button } from '../buttons/Button.jsx';

const CSS = `
.ens-teamcard{
  background:var(--surface-card); border:1px solid var(--border); border-radius:var(--radius-xl);
  box-shadow:var(--shadow-xs); overflow:hidden; display:flex; flex-direction:column;
  transition:border-color var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out);
}
.ens-teamcard--interactive{ cursor:pointer; }
.ens-teamcard--interactive:hover{ border-color:var(--border-strong); box-shadow:var(--shadow-md); transform:translateY(-2px); }
.ens-teamcard__bar{ height:4px; background:var(--grad-duo); }
.ens-teamcard__body{ padding:18px; display:flex; flex-direction:column; gap:13px; }
.ens-teamcard__head{ display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
.ens-teamcard__name{ font-family:var(--font-display); font-size:17px; font-weight:600; letter-spacing:-0.012em; color:var(--text-primary); }
.ens-teamcard__sub{ font-size:12.5px; color:var(--text-tertiary); margin-top:2px; }
.ens-teamcard__desc{ font-size:13.5px; line-height:1.5; color:var(--text-secondary); margin:0; }
.ens-teamcard__members{ display:flex; align-items:center; gap:10px; }
.ens-teamcard__count{ font-size:12.5px; color:var(--text-tertiary); }
.ens-teamcard__foot{ display:flex; align-items:center; justify-content:space-between; gap:10px; padding-top:4px; border-top:1px solid var(--border); margin-top:2px; padding-top:13px; }
`;
if (typeof document !== 'undefined' && !document.getElementById('ens-teamcard-css')) {
  const s = document.createElement('style'); s.id = 'ens-teamcard-css'; s.textContent = CSS; document.head.appendChild(s);
}

const MEMBER_COLORS = {
  design: 'var(--cat-design)', seo: 'var(--cat-seo)', copy: 'var(--cat-copy)',
  social: 'var(--cat-social)', ads: 'var(--cat-ads)', data: 'var(--cat-data)',
};

export function TeamCard({
  name, description, members = [], status = 'idle', lastRun,
  deployed = false, onDeploy, interactive = false, className = '', ...rest
}) {
  const shown = members.slice(0, 4);
  const extra = members.length - shown.length;
  return (
    <div className={['ens-teamcard', interactive ? 'ens-teamcard--interactive' : '', className].filter(Boolean).join(' ')} {...rest}>
      <div className="ens-teamcard__bar" />
      <div className="ens-teamcard__body">
        <div className="ens-teamcard__head">
          <div>
            <div className="ens-teamcard__name">{name}</div>
            <div className="ens-teamcard__sub">{members.length} agents{lastRun ? ` · last run ${lastRun}` : ''}</div>
          </div>
          <StatusDot status={status} />
        </div>
        {description ? <p className="ens-teamcard__desc">{description}</p> : null}
        <div className="ens-teamcard__members">
          <AvatarGroup>
            {shown.map((m, i) => (
              <Avatar key={i} name={m.name} size="sm" color={MEMBER_COLORS[m.category] || 'var(--gray-500)'} />
            ))}
            {extra > 0 ? <Avatar size="sm">+{extra}</Avatar> : null}
          </AvatarGroup>
          <span className="ens-teamcard__count">{shown.map((m) => m.name).join(' · ')}{extra > 0 ? ` +${extra}` : ''}</span>
        </div>
        <div className="ens-teamcard__foot">
          <span className="ens-teamcard__count" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
            {deployed ? 'Deployed' : 'Ready to deploy'}
          </span>
          {onDeploy ? (
            <Button size="sm" variant={deployed ? 'secondary' : 'brand'} onClick={onDeploy}>
              {deployed ? 'Open team' : 'Deploy team'}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
