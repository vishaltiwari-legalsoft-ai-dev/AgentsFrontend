import React from 'react';

const CSS = `
.ens-avatar{
  display:inline-flex; align-items:center; justify-content:center; flex:none;
  font-family:var(--font-display); font-weight:600; color:var(--text-primary);
  background:var(--gray-100); border-radius:var(--radius-pill); overflow:hidden;
  border:1px solid rgba(13,16,20,.06); user-select:none;
}
.ens-avatar--square{ border-radius:var(--radius-md); }
.ens-avatar img{ width:100%; height:100%; object-fit:cover; display:block; }
.ens-avatar--xs{ width:24px; height:24px; font-size:10px; }
.ens-avatar--sm{ width:30px; height:30px; font-size:12px; }
.ens-avatar--md{ width:38px; height:38px; font-size:14px; }
.ens-avatar--lg{ width:48px; height:48px; font-size:17px; }
.ens-avatar--xl{ width:64px; height:64px; font-size:22px; }
.ens-avatar-group{ display:inline-flex; }
.ens-avatar-group > *{ margin-left:-8px; box-shadow:0 0 0 2px var(--surface); border-radius:var(--radius-pill); }
.ens-avatar-group > *:first-child{ margin-left:0; }
`;
if (typeof document !== 'undefined' && !document.getElementById('ens-avatar-css')) {
  const s = document.createElement('style'); s.id = 'ens-avatar-css'; s.textContent = CSS; document.head.appendChild(s);
}

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export function Avatar({ name, src, size = 'md', square = false, color, style, className = '', children, ...rest }) {
  const bg = color ? { background: color, color: '#fff', borderColor: 'transparent' } : null;
  return (
    <span
      className={['ens-avatar', `ens-avatar--${size}`, square ? 'ens-avatar--square' : '', className].filter(Boolean).join(' ')}
      style={{ ...bg, ...style }}
      title={name}
      {...rest}
    >
      {src ? <img src={src} alt={name || ''} /> : children || initials(name)}
    </span>
  );
}

export function AvatarGroup({ className = '', children, ...rest }) {
  return <span className={['ens-avatar-group', className].filter(Boolean).join(' ')} {...rest}>{children}</span>;
}
