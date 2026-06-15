/* @ds-bundle: {"format":3,"namespace":"EnsembleDesignSystem_c3f858","components":[{"name":"AgentCard","sourcePath":"components/agents/AgentCard.jsx"},{"name":"TeamCard","sourcePath":"components/agents/TeamCard.jsx"},{"name":"Button","sourcePath":"components/buttons/Button.jsx"},{"name":"IconButton","sourcePath":"components/buttons/IconButton.jsx"},{"name":"Avatar","sourcePath":"components/data-display/Avatar.jsx"},{"name":"AvatarGroup","sourcePath":"components/data-display/Avatar.jsx"},{"name":"Card","sourcePath":"components/data-display/Card.jsx"},{"name":"CardHeader","sourcePath":"components/data-display/Card.jsx"},{"name":"CardBody","sourcePath":"components/data-display/Card.jsx"},{"name":"CardFooter","sourcePath":"components/data-display/Card.jsx"},{"name":"Tabs","sourcePath":"components/data-display/Tabs.jsx"},{"name":"Badge","sourcePath":"components/feedback/Badge.jsx"},{"name":"StatusDot","sourcePath":"components/feedback/StatusDot.jsx"},{"name":"Tag","sourcePath":"components/feedback/Tag.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Checkbox.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"}],"sourceHashes":{"components/agents/AgentCard.jsx":"9b345f086695","components/agents/TeamCard.jsx":"d1b4306828bf","components/buttons/Button.jsx":"3ba9f9f41d26","components/buttons/IconButton.jsx":"3110b6a14038","components/data-display/Avatar.jsx":"45f9c9a4b528","components/data-display/Card.jsx":"fb53f4efed54","components/data-display/Tabs.jsx":"4c0b97200322","components/feedback/Badge.jsx":"296b6e8a6910","components/feedback/StatusDot.jsx":"ac1fcdfdddb1","components/feedback/Tag.jsx":"018c2df08d43","components/forms/Checkbox.jsx":"36aa36d5a977","components/forms/Input.jsx":"01fbbb3f768a","components/forms/Select.jsx":"102f5602ce2c","components/forms/Switch.jsx":"3291f626b239","ui_kits/_shared/kit-ui.jsx":"00401568426c","ui_kits/console/app.jsx":"ef10641ad2a9","ui_kits/console/chrome.jsx":"cc9970aa8741","ui_kits/console/data.jsx":"45f26912e3b5","ui_kits/console/teamspace.jsx":"5ac9a18effb1","ui_kits/console/views.jsx":"8f40320d50fa","ui_kits/marketing/sections.jsx":"2823d0e00f33"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.EnsembleDesignSystem_c3f858 = window.EnsembleDesignSystem_c3f858 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/buttons/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const CSS = `
.ens-btn{
  --_bg:var(--action); --_fg:var(--on-action); --_bd:transparent; --_bgh:var(--action-hover); --_bga:var(--action-active);
  display:inline-flex; align-items:center; justify-content:center; gap:8px;
  font-family:var(--font-sans); font-weight:var(--fw-semibold); letter-spacing:-0.005em;
  border:var(--border-w) solid var(--_bd); border-radius:var(--radius-md);
  background:var(--_bg); color:var(--_fg); cursor:pointer; white-space:nowrap;
  transition:background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out);
  user-select:none; text-decoration:none;
}
.ens-btn:hover{ background:var(--_bgh); }
.ens-btn:active{ background:var(--_bga); transform:translateY(0.5px); }
.ens-btn:focus-visible{ outline:none; box-shadow:var(--ring); }
.ens-btn[disabled],.ens-btn[aria-disabled="true"]{ opacity:.45; cursor:not-allowed; transform:none; }
.ens-btn--sm{ height:32px; padding:0 12px; font-size:13.5px; }
.ens-btn--md{ height:38px; padding:0 16px; font-size:14px; }
.ens-btn--lg{ height:46px; padding:0 22px; font-size:15.5px; border-radius:var(--radius-lg); }
.ens-btn--full{ width:100%; }
.ens-btn--brand{ --_bg:var(--brand); --_fg:var(--on-brand); --_bgh:var(--brand-hover); --_bga:var(--brand-active); }
.ens-btn--accent{ --_bg:var(--accent); --_fg:var(--on-accent); --_bgh:var(--accent-hover); --_bga:var(--accent-active); }
.ens-btn--gradient{ background:var(--grad-brand); color:#fff; border-color:transparent; background-size:140% 140%; background-position:0% 0%; transition:background-position var(--dur-base) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out); }
.ens-btn--gradient:hover{ background-position:100% 100%; box-shadow:0 6px 18px -6px color-mix(in srgb, var(--blue-700) 55%, transparent); }
.ens-btn--gradient:active{ transform:translateY(0.5px); }
.ens-btn--secondary{ --_bg:var(--surface); --_fg:var(--text-primary); --_bd:var(--border-strong); --_bgh:var(--surface-hover); --_bga:var(--surface-active); box-shadow:var(--shadow-xs); }
.ens-btn--ghost{ --_bg:transparent; --_fg:var(--text-primary); --_bgh:var(--surface-hover); --_bga:var(--surface-active); }
.ens-btn--danger{ --_bg:var(--danger); --_fg:#fff; --_bgh:var(--danger-hover); --_bga:var(--danger-hover); }
.ens-btn__icon{ display:inline-flex; width:1.05em; height:1.05em; }
.ens-btn__icon svg{ width:100%; height:100%; }
`;
if (typeof document !== 'undefined' && !document.getElementById('ens-button-css')) {
  const s = document.createElement('style');
  s.id = 'ens-button-css';
  s.textContent = CSS;
  document.head.appendChild(s);
}
function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  iconLeft,
  iconRight,
  as = 'button',
  className = '',
  children,
  ...rest
}) {
  const Tag = as;
  const cls = ['ens-btn', `ens-btn--${size}`, variant !== 'primary' ? `ens-btn--${variant}` : '', fullWidth ? 'ens-btn--full' : '', className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement(Tag, _extends({
    className: cls
  }, rest), iconLeft ? /*#__PURE__*/React.createElement("span", {
    className: "ens-btn__icon"
  }, iconLeft) : null, children, iconRight ? /*#__PURE__*/React.createElement("span", {
    className: "ens-btn__icon"
  }, iconRight) : null);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/buttons/Button.jsx", error: String((e && e.message) || e) }); }

// components/buttons/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const CSS = `
.ens-iconbtn{
  --_bg:transparent; --_fg:var(--text-secondary); --_bgh:var(--surface-hover); --_bga:var(--surface-active); --_bd:transparent;
  display:inline-flex; align-items:center; justify-content:center;
  border:var(--border-w) solid var(--_bd); background:var(--_bg); color:var(--_fg);
  border-radius:var(--radius-md); cursor:pointer;
  transition:background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out);
}
.ens-iconbtn:hover{ background:var(--_bgh); color:var(--text-primary); }
.ens-iconbtn:active{ background:var(--_bga); }
.ens-iconbtn:focus-visible{ outline:none; box-shadow:var(--ring); }
.ens-iconbtn[disabled]{ opacity:.4; cursor:not-allowed; }
.ens-iconbtn--sm{ width:30px; height:30px; }
.ens-iconbtn--md{ width:36px; height:36px; }
.ens-iconbtn--lg{ width:42px; height:42px; }
.ens-iconbtn--solid{ --_bg:var(--surface); --_bd:var(--border-strong); box-shadow:var(--shadow-xs); }
.ens-iconbtn--brand{ --_bg:var(--brand); --_fg:#fff; --_bgh:var(--brand-hover); --_bga:var(--brand-active); }
.ens-iconbtn--brand:hover{ color:#fff; }
.ens-iconbtn svg{ width:1.05em; height:1.05em; display:block; }
.ens-iconbtn--sm svg{ font-size:15px; } .ens-iconbtn--md svg{ font-size:17px; } .ens-iconbtn--lg svg{ font-size:19px; }
`;
if (typeof document !== 'undefined' && !document.getElementById('ens-iconbtn-css')) {
  const s = document.createElement('style');
  s.id = 'ens-iconbtn-css';
  s.textContent = CSS;
  document.head.appendChild(s);
}
function IconButton({
  variant = 'ghost',
  size = 'md',
  label,
  className = '',
  children,
  ...rest
}) {
  const cls = ['ens-iconbtn', `ens-iconbtn--${size}`, variant !== 'ghost' ? `ens-iconbtn--${variant}` : '', className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    className: cls,
    "aria-label": label,
    title: label
  }, rest), children);
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/buttons/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/data-display/Avatar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
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
  const s = document.createElement('style');
  s.id = 'ens-avatar-css';
  s.textContent = CSS;
  document.head.appendChild(s);
}
function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}
function Avatar({
  name,
  src,
  size = 'md',
  square = false,
  color,
  style,
  className = '',
  children,
  ...rest
}) {
  const bg = color ? {
    background: color,
    color: '#fff',
    borderColor: 'transparent'
  } : null;
  return /*#__PURE__*/React.createElement("span", _extends({
    className: ['ens-avatar', `ens-avatar--${size}`, square ? 'ens-avatar--square' : '', className].filter(Boolean).join(' '),
    style: {
      ...bg,
      ...style
    },
    title: name
  }, rest), src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: name || ''
  }) : children || initials(name));
}
function AvatarGroup({
  className = '',
  children,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    className: ['ens-avatar-group', className].filter(Boolean).join(' ')
  }, rest), children);
}
Object.assign(__ds_scope, { Avatar, AvatarGroup });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/data-display/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
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
  const s = document.createElement('style');
  s.id = 'ens-card-css';
  s.textContent = CSS;
  document.head.appendChild(s);
}
function Card({
  interactive = false,
  selected = false,
  flat = false,
  className = '',
  children,
  ...rest
}) {
  const cls = ['ens-card', interactive ? 'ens-card--interactive' : '', selected ? 'ens-card--selected' : '', flat ? 'ens-card--flat' : '', className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("div", _extends({
    className: cls
  }, rest), children);
}
function CardHeader({
  title,
  action,
  className = '',
  children,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ['ens-card__header', className].filter(Boolean).join(' ')
  }, rest), title ? /*#__PURE__*/React.createElement("span", {
    className: "ens-card__title"
  }, title) : children, action || null);
}
function CardBody({
  className = '',
  children,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ['ens-card__body', className].filter(Boolean).join(' ')
  }, rest), children);
}
function CardFooter({
  className = '',
  children,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ['ens-card__footer', className].filter(Boolean).join(' ')
  }, rest), children);
}
Object.assign(__ds_scope, { Card, CardHeader, CardBody, CardFooter });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/Card.jsx", error: String((e && e.message) || e) }); }

// components/data-display/Tabs.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
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
  const s = document.createElement('style');
  s.id = 'ens-tabs-css';
  s.textContent = CSS;
  document.head.appendChild(s);
}
function Tabs({
  items = [],
  value,
  onChange,
  variant = 'pill',
  className = '',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    role: "tablist",
    className: ['ens-tabs', `ens-tabs--${variant}`, className].filter(Boolean).join(' ')
  }, rest), items.map(it => {
    const item = typeof it === 'string' ? {
      value: it,
      label: it
    } : it;
    const selected = item.value === value;
    return /*#__PURE__*/React.createElement("button", {
      key: item.value,
      role: "tab",
      type: "button",
      "aria-selected": selected,
      className: "ens-tab",
      onClick: () => onChange && onChange(item.value)
    }, item.icon || null, item.label, item.count != null ? /*#__PURE__*/React.createElement("span", {
      className: "ens-tab__count"
    }, item.count) : null);
  }));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/Tabs.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const CSS = `
.ens-badge{
  display:inline-flex; align-items:center; gap:5px; font-family:var(--font-sans);
  font-size:11.5px; font-weight:600; line-height:1; letter-spacing:0.01em;
  padding:4px 8px; border-radius:var(--radius-sm); white-space:nowrap;
  border:1px solid transparent;
}
.ens-badge--neutral{ background:var(--gray-100); color:var(--gray-700); }
.ens-badge--brand{ background:var(--brand-subtle); color:var(--brand-hover); }
.ens-badge--success{ background:var(--success-bg); color:var(--green-600); }
.ens-badge--warning{ background:var(--warning-bg); color:var(--amber-600); }
.ens-badge--danger{ background:var(--danger-bg); color:var(--red-600); }
.ens-badge--outline{ background:transparent; border-color:var(--border-strong); color:var(--text-secondary); }
.ens-badge__dot{ width:6px; height:6px; border-radius:var(--radius-pill); background:currentColor; }
.ens-badge svg{ width:12px; height:12px; }
`;
if (typeof document !== 'undefined' && !document.getElementById('ens-badge-css')) {
  const s = document.createElement('style');
  s.id = 'ens-badge-css';
  s.textContent = CSS;
  document.head.appendChild(s);
}
function Badge({
  variant = 'neutral',
  dot = false,
  icon,
  className = '',
  children,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    className: ['ens-badge', `ens-badge--${variant}`, className].filter(Boolean).join(' ')
  }, rest), dot ? /*#__PURE__*/React.createElement("span", {
    className: "ens-badge__dot"
  }) : null, icon || null, children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Badge.jsx", error: String((e && e.message) || e) }); }

// components/feedback/StatusDot.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
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
  const s = document.createElement('style');
  s.id = 'ens-status-css';
  s.textContent = CSS;
  document.head.appendChild(s);
}
const LABELS = {
  idle: 'Idle',
  running: 'Running',
  success: 'Done',
  error: 'Failed',
  paused: 'Paused'
};
function StatusDot({
  status = 'idle',
  label,
  showLabel = true,
  className = '',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    className: ['ens-status', `ens-status--${status}`, className].filter(Boolean).join(' ')
  }, rest), /*#__PURE__*/React.createElement("span", {
    className: "ens-status__dot"
  }), showLabel ? /*#__PURE__*/React.createElement("span", null, label || LABELS[status]) : null);
}
Object.assign(__ds_scope, { StatusDot });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/StatusDot.jsx", error: String((e && e.message) || e) }); }

// components/agents/TeamCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
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
  const s = document.createElement('style');
  s.id = 'ens-teamcard-css';
  s.textContent = CSS;
  document.head.appendChild(s);
}
const MEMBER_COLORS = {
  design: 'var(--cat-design)',
  seo: 'var(--cat-seo)',
  copy: 'var(--cat-copy)',
  social: 'var(--cat-social)',
  ads: 'var(--cat-ads)',
  data: 'var(--cat-data)'
};
function TeamCard({
  name,
  description,
  members = [],
  status = 'idle',
  lastRun,
  deployed = false,
  onDeploy,
  interactive = false,
  className = '',
  ...rest
}) {
  const shown = members.slice(0, 4);
  const extra = members.length - shown.length;
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ['ens-teamcard', interactive ? 'ens-teamcard--interactive' : '', className].filter(Boolean).join(' ')
  }, rest), /*#__PURE__*/React.createElement("div", {
    className: "ens-teamcard__bar"
  }), /*#__PURE__*/React.createElement("div", {
    className: "ens-teamcard__body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ens-teamcard__head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "ens-teamcard__name"
  }, name), /*#__PURE__*/React.createElement("div", {
    className: "ens-teamcard__sub"
  }, members.length, " agents", lastRun ? ` · last run ${lastRun}` : '')), /*#__PURE__*/React.createElement(__ds_scope.StatusDot, {
    status: status
  })), description ? /*#__PURE__*/React.createElement("p", {
    className: "ens-teamcard__desc"
  }, description) : null, /*#__PURE__*/React.createElement("div", {
    className: "ens-teamcard__members"
  }, /*#__PURE__*/React.createElement(__ds_scope.AvatarGroup, null, shown.map((m, i) => /*#__PURE__*/React.createElement(__ds_scope.Avatar, {
    key: i,
    name: m.name,
    size: "sm",
    color: MEMBER_COLORS[m.category] || 'var(--gray-500)'
  })), extra > 0 ? /*#__PURE__*/React.createElement(__ds_scope.Avatar, {
    size: "sm"
  }, "+", extra) : null), /*#__PURE__*/React.createElement("span", {
    className: "ens-teamcard__count"
  }, shown.map(m => m.name).join(' · '), extra > 0 ? ` +${extra}` : '')), /*#__PURE__*/React.createElement("div", {
    className: "ens-teamcard__foot"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ens-teamcard__count",
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 11
    }
  }, deployed ? 'Deployed' : 'Ready to deploy'), onDeploy ? /*#__PURE__*/React.createElement(__ds_scope.Button, {
    size: "sm",
    variant: deployed ? 'secondary' : 'brand',
    onClick: onDeploy
  }, deployed ? 'Open team' : 'Deploy team') : null)));
}
Object.assign(__ds_scope, { TeamCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/agents/TeamCard.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Tag.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const CSS = `
.ens-tag{
  display:inline-flex; align-items:center; gap:6px; font-family:var(--font-sans);
  font-size:12px; font-weight:600; line-height:1; padding:5px 9px;
  border-radius:var(--radius-pill); white-space:nowrap;
  --_bg:var(--gray-100); --_fg:var(--gray-700);
  background:var(--_bg); color:var(--_fg);
}
.ens-tag__glyph{ display:inline-flex; }
.ens-tag__glyph svg{ width:13px; height:13px; }
.ens-tag__x{ display:inline-flex; cursor:pointer; opacity:.6; margin-right:-2px; }
.ens-tag__x:hover{ opacity:1; }
.ens-tag__x svg{ width:13px; height:13px; }
.ens-tag--design{ --_bg:var(--cat-design-bg); --_fg:var(--cat-design); }
.ens-tag--seo{ --_bg:var(--cat-seo-bg); --_fg:var(--cat-seo); }
.ens-tag--copy{ --_bg:var(--cat-copy-bg); --_fg:var(--cat-copy); }
.ens-tag--social{ --_bg:var(--cat-social-bg); --_fg:var(--cat-social); }
.ens-tag--ads{ --_bg:var(--cat-ads-bg); --_fg:var(--cat-ads); }
.ens-tag--data{ --_bg:var(--cat-data-bg); --_fg:var(--cat-data); }
`;
if (typeof document !== 'undefined' && !document.getElementById('ens-tag-css')) {
  const s = document.createElement('style');
  s.id = 'ens-tag-css';
  s.textContent = CSS;
  document.head.appendChild(s);
}
const X = () => /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2.5",
  strokeLinecap: "round"
}, /*#__PURE__*/React.createElement("line", {
  x1: "18",
  y1: "6",
  x2: "6",
  y2: "18"
}), /*#__PURE__*/React.createElement("line", {
  x1: "6",
  y1: "6",
  x2: "18",
  y2: "18"
}));
function Tag({
  category,
  glyph,
  onRemove,
  className = '',
  children,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    className: ['ens-tag', category ? `ens-tag--${category}` : '', className].filter(Boolean).join(' ')
  }, rest), glyph ? /*#__PURE__*/React.createElement("span", {
    className: "ens-tag__glyph"
  }, glyph) : null, children, onRemove ? /*#__PURE__*/React.createElement("span", {
    className: "ens-tag__x",
    role: "button",
    "aria-label": "Remove",
    onClick: onRemove
  }, /*#__PURE__*/React.createElement(X, null)) : null);
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Tag.jsx", error: String((e && e.message) || e) }); }

// components/agents/AgentCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
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
  const s = document.createElement('style');
  s.id = 'ens-agentcard-css';
  s.textContent = CSS;
  document.head.appendChild(s);
}
const CAT_LABEL = {
  design: 'Design',
  seo: 'SEO',
  copy: 'Copy',
  social: 'Social',
  ads: 'Ads',
  data: 'Data'
};
function AgentCard({
  name,
  role,
  description,
  category = 'design',
  glyph,
  status,
  added = false,
  onAdd,
  interactive = false,
  className = '',
  ...rest
}) {
  const bg = `var(--cat-${category}-bg)`;
  const fg = `var(--cat-${category})`;
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ['ens-agentcard', interactive ? 'ens-agentcard--interactive' : '', className].filter(Boolean).join(' ')
  }, rest), /*#__PURE__*/React.createElement("div", {
    className: "ens-agentcard__top"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ens-agentcard__glyph",
    style: {
      background: bg,
      color: fg
    }
  }, glyph), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "ens-agentcard__name"
  }, name), /*#__PURE__*/React.createElement("div", {
    className: "ens-agentcard__role"
  }, role)), /*#__PURE__*/React.createElement(__ds_scope.Tag, {
    category: category
  }, CAT_LABEL[category])), description ? /*#__PURE__*/React.createElement("p", {
    className: "ens-agentcard__desc"
  }, description) : null, /*#__PURE__*/React.createElement("div", {
    className: "ens-agentcard__foot"
  }, status ? /*#__PURE__*/React.createElement(__ds_scope.StatusDot, {
    status: status
  }) : /*#__PURE__*/React.createElement("span", {
    className: "ens-agentcard__meta"
  }, "Specialist agent"), onAdd ? /*#__PURE__*/React.createElement(__ds_scope.Button, {
    size: "sm",
    variant: added ? 'secondary' : 'primary',
    onClick: onAdd
  }, added ? 'Added' : 'Add to team') : null));
}
Object.assign(__ds_scope, { AgentCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/agents/AgentCard.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
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
  const s = document.createElement('style');
  s.id = 'ens-check-css';
  s.textContent = CSS;
  document.head.appendChild(s);
}
const Tick = () => /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "3.5",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, /*#__PURE__*/React.createElement("polyline", {
  points: "20 6 9 17 4 12"
}));
function Checkbox({
  label,
  radio = false,
  className = '',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("label", {
    className: ['ens-check', radio ? 'ens-check--radio' : '', className].filter(Boolean).join(' ')
  }, /*#__PURE__*/React.createElement("input", _extends({
    type: radio ? 'radio' : 'checkbox'
  }, rest)), /*#__PURE__*/React.createElement("span", {
    className: "ens-check__box"
  }, radio ? /*#__PURE__*/React.createElement("span", {
    className: "ens-check__dot"
  }) : /*#__PURE__*/React.createElement(Tick, null)), label ? /*#__PURE__*/React.createElement("span", {
    className: "ens-check__label"
  }, label) : null);
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
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
  const s = document.createElement('style');
  s.id = 'ens-input-css';
  s.textContent = CSS;
  document.head.appendChild(s);
}
function Input({
  label,
  hint,
  error,
  icon,
  id,
  className = '',
  ...rest
}) {
  const fid = id || (label ? 'in-' + label.replace(/\s+/g, '-').toLowerCase() : undefined);
  return /*#__PURE__*/React.createElement("div", {
    className: "ens-field"
  }, label ? /*#__PURE__*/React.createElement("label", {
    className: "ens-field__label",
    htmlFor: fid
  }, label) : null, /*#__PURE__*/React.createElement("div", {
    className: "ens-input-wrap"
  }, icon ? /*#__PURE__*/React.createElement("span", {
    className: "ens-input__icon"
  }, icon) : null, /*#__PURE__*/React.createElement("input", _extends({
    id: fid,
    className: ['ens-input', icon ? 'ens-input--has-icon' : '', error ? 'ens-input--err' : '', className].filter(Boolean).join(' '),
    "aria-invalid": error ? true : undefined
  }, rest))), error ? /*#__PURE__*/React.createElement("span", {
    className: "ens-field__err"
  }, error) : hint ? /*#__PURE__*/React.createElement("span", {
    className: "ens-field__hint"
  }, hint) : null);
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
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
  const s = document.createElement('style');
  s.id = 'ens-select-css';
  s.textContent = CSS;
  document.head.appendChild(s);
}
const Chevron = () => /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, /*#__PURE__*/React.createElement("polyline", {
  points: "6 9 12 15 18 9"
}));
function Select({
  label,
  options = [],
  id,
  className = '',
  children,
  ...rest
}) {
  const fid = id || (label ? 'sel-' + label.replace(/\s+/g, '-').toLowerCase() : undefined);
  return /*#__PURE__*/React.createElement("div", {
    className: "ens-select-wrap"
  }, label ? /*#__PURE__*/React.createElement("label", {
    className: "ens-select__label",
    htmlFor: fid
  }, label) : null, /*#__PURE__*/React.createElement("div", {
    className: "ens-select__box"
  }, /*#__PURE__*/React.createElement("select", _extends({
    id: fid,
    className: ['ens-select', className].filter(Boolean).join(' ')
  }, rest), children || options.map(o => {
    const opt = typeof o === 'string' ? {
      value: o,
      label: o
    } : o;
    return /*#__PURE__*/React.createElement("option", {
      key: opt.value,
      value: opt.value
    }, opt.label);
  })), /*#__PURE__*/React.createElement("span", {
    className: "ens-select__chev"
  }, /*#__PURE__*/React.createElement(Chevron, null))));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
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
  const s = document.createElement('style');
  s.id = 'ens-switch-css';
  s.textContent = CSS;
  document.head.appendChild(s);
}
function Switch({
  label,
  checked,
  defaultChecked,
  onChange,
  disabled,
  className = '',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("label", {
    className: ['ens-switch', className].filter(Boolean).join(' ')
  }, /*#__PURE__*/React.createElement("input", _extends({
    type: "checkbox",
    role: "switch",
    checked: checked,
    defaultChecked: defaultChecked,
    onChange: onChange,
    disabled: disabled
  }, rest)), /*#__PURE__*/React.createElement("span", {
    className: "ens-switch__track"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ens-switch__thumb"
  })), label ? /*#__PURE__*/React.createElement("span", {
    className: "ens-switch__label"
  }, label) : null);
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// ui_kits/_shared/kit-ui.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* kit-ui.jsx — verifiable mirror of the Ensemble component library.
   Loaded via Babel in UI-kit pages (lowercase filename → NOT compiled as a DS component).
   In PRODUCTION these map 1:1 to window.EnsembleDesignSystem_c3f858.* (the bundle).
   Styles are the same self-injected CSS used by the real components. */

const KIT_CSS = `
/* Button */
.ens-btn{ --_bg:var(--action); --_fg:var(--on-action); --_bd:transparent; --_bgh:var(--action-hover); --_bga:var(--action-active);
  display:inline-flex; align-items:center; justify-content:center; gap:8px; font-family:var(--font-sans); font-weight:var(--fw-semibold);
  letter-spacing:-0.005em; border:1px solid var(--_bd); border-radius:var(--radius-md); background:var(--_bg); color:var(--_fg);
  cursor:pointer; white-space:nowrap; text-decoration:none;
  transition:background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out); }
.ens-btn:hover{ background:var(--_bgh); } .ens-btn:active{ background:var(--_bga); transform:translateY(0.5px); }
.ens-btn:focus-visible{ outline:none; box-shadow:var(--ring); }
.ens-btn[disabled]{ opacity:.45; cursor:not-allowed; }
.ens-btn--sm{ height:32px; padding:0 12px; font-size:13.5px; } .ens-btn--md{ height:38px; padding:0 16px; font-size:14px; } .ens-btn--lg{ height:46px; padding:0 22px; font-size:15.5px; border-radius:var(--radius-lg); }
.ens-btn--full{ width:100%; }
.ens-btn--brand{ --_bg:var(--brand); --_fg:var(--on-brand); --_bgh:var(--brand-hover); --_bga:var(--brand-active); }
.ens-btn--accent{ --_bg:var(--accent); --_fg:var(--on-accent); --_bgh:var(--accent-hover); --_bga:var(--accent-active); }
.ens-btn--gradient{ background:var(--grad-brand); color:#fff; border-color:transparent; background-size:140% 140%; background-position:0% 0%;
  transition:background-position var(--dur-base) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out); }
.ens-btn--gradient:hover{ background-position:100% 100%; box-shadow:0 6px 18px -6px color-mix(in srgb, var(--blue-700) 55%, transparent); }
.ens-btn--gradient:active{ transform:translateY(0.5px); }
.ens-btn--secondary{ --_bg:var(--surface); --_fg:var(--text-primary); --_bd:var(--border-strong); --_bgh:var(--surface-hover); --_bga:var(--surface-active); box-shadow:var(--shadow-xs); }
.ens-btn--ghost{ --_bg:transparent; --_fg:var(--text-primary); --_bgh:var(--surface-hover); --_bga:var(--surface-active); }
.ens-btn--danger{ --_bg:var(--danger); --_fg:#fff; --_bgh:var(--danger-hover); --_bga:var(--danger-hover); }
.ens-btn__icon{ display:inline-flex; } .ens-btn__icon svg{ width:1.05em; height:1.05em; }
/* IconButton */
.ens-iconbtn{ --_bg:transparent; --_fg:var(--text-secondary); --_bgh:var(--surface-hover); --_bga:var(--surface-active); --_bd:transparent;
  display:inline-flex; align-items:center; justify-content:center; border:1px solid var(--_bd); background:var(--_bg); color:var(--_fg);
  border-radius:var(--radius-md); cursor:pointer; transition:background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out); }
.ens-iconbtn:hover{ background:var(--_bgh); color:var(--text-primary); } .ens-iconbtn:focus-visible{ outline:none; box-shadow:var(--ring); }
.ens-iconbtn--sm{ width:30px; height:30px; } .ens-iconbtn--md{ width:36px; height:36px; } .ens-iconbtn--lg{ width:42px; height:42px; }
.ens-iconbtn--solid{ --_bg:var(--surface); --_bd:var(--border-strong); box-shadow:var(--shadow-xs); }
.ens-iconbtn--brand{ --_bg:var(--brand); --_fg:#fff; --_bgh:var(--brand-hover); } .ens-iconbtn--brand:hover{ color:#fff; }
.ens-iconbtn svg{ width:17px; height:17px; display:block; }
/* Input */
.ens-input{ width:100%; box-sizing:border-box; font-family:var(--font-sans); font-size:14px; color:var(--text-primary); background:var(--surface);
  border:1px solid var(--border-strong); border-radius:var(--radius-md); height:38px; padding:0 12px; outline:none;
  transition:border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out); }
.ens-input::placeholder{ color:var(--text-disabled); } .ens-input:hover{ border-color:var(--gray-400); }
.ens-input:focus{ border-color:var(--brand); box-shadow:var(--ring); }
.ens-input-wrap{ position:relative; display:flex; align-items:center; }
.ens-input--has-icon{ padding-left:36px; } .ens-input__icon{ position:absolute; left:11px; display:inline-flex; color:var(--text-tertiary); pointer-events:none; }
.ens-input__icon svg{ width:16px; height:16px; }
/* Badge */
.ens-badge{ display:inline-flex; align-items:center; gap:5px; font-family:var(--font-sans); font-size:11.5px; font-weight:600; line-height:1;
  padding:4px 8px; border-radius:var(--radius-sm); white-space:nowrap; border:1px solid transparent; }
.ens-badge--neutral{ background:var(--gray-100); color:var(--gray-700); } .ens-badge--brand{ background:var(--brand-subtle); color:var(--brand-hover); }
.ens-badge--success{ background:var(--success-bg); color:var(--green-600); } .ens-badge--warning{ background:var(--warning-bg); color:var(--amber-600); }
.ens-badge--danger{ background:var(--danger-bg); color:var(--red-600); } .ens-badge--outline{ background:transparent; border-color:var(--border-strong); color:var(--text-secondary); }
.ens-badge__dot{ width:6px; height:6px; border-radius:var(--radius-pill); background:currentColor; } .ens-badge svg{ width:12px; height:12px; }
/* Tag */
.ens-tag{ display:inline-flex; align-items:center; gap:6px; font-family:var(--font-sans); font-size:12px; font-weight:600; line-height:1;
  padding:5px 9px; border-radius:var(--radius-pill); white-space:nowrap; --_bg:var(--gray-100); --_fg:var(--gray-700); background:var(--_bg); color:var(--_fg); }
.ens-tag__glyph{ display:inline-flex; } .ens-tag__glyph svg{ width:13px; height:13px; }
.ens-tag--design{ --_bg:var(--cat-design-bg); --_fg:var(--cat-design); } .ens-tag--seo{ --_bg:var(--cat-seo-bg); --_fg:var(--cat-seo); }
.ens-tag--copy{ --_bg:var(--cat-copy-bg); --_fg:var(--cat-copy); } .ens-tag--social{ --_bg:var(--cat-social-bg); --_fg:var(--cat-social); }
.ens-tag--ads{ --_bg:var(--cat-ads-bg); --_fg:var(--cat-ads); } .ens-tag--data{ --_bg:var(--cat-data-bg); --_fg:var(--cat-data); }
/* StatusDot */
.ens-status{ display:inline-flex; align-items:center; gap:7px; font-family:var(--font-sans); font-size:12.5px; font-weight:600; color:var(--text-secondary); }
.ens-status__dot{ position:relative; width:8px; height:8px; border-radius:var(--radius-pill); flex:none; }
.ens-status--idle .ens-status__dot{ background:var(--gray-400); } .ens-status--running .ens-status__dot{ background:var(--brand); }
.ens-status--success .ens-status__dot{ background:var(--success); } .ens-status--error .ens-status__dot{ background:var(--danger); } .ens-status--paused .ens-status__dot{ background:var(--warning); }
.ens-status--running .ens-status__dot::after{ content:""; position:absolute; inset:-4px; border-radius:var(--radius-pill); background:var(--brand); opacity:.35; animation:ens-ping 1.4s var(--ease-out) infinite; }
@keyframes ens-ping{ 0%{ transform:scale(.6); opacity:.5; } 80%,100%{ transform:scale(1.8); opacity:0; } }
@media (prefers-reduced-motion: reduce){ .ens-status--running .ens-status__dot::after{ animation:none; } }
/* Avatar */
.ens-avatar{ display:inline-flex; align-items:center; justify-content:center; flex:none; font-family:var(--font-display); font-weight:600;
  color:var(--text-primary); background:var(--gray-100); border-radius:var(--radius-pill); overflow:hidden; border:1px solid rgba(13,16,20,.06); user-select:none; }
.ens-avatar--square{ border-radius:var(--radius-md); } .ens-avatar img{ width:100%; height:100%; object-fit:cover; display:block; }
.ens-avatar--xs{ width:24px; height:24px; font-size:10px; } .ens-avatar--sm{ width:30px; height:30px; font-size:12px; } .ens-avatar--md{ width:38px; height:38px; font-size:14px; }
.ens-avatar--lg{ width:48px; height:48px; font-size:17px; } .ens-avatar--xl{ width:64px; height:64px; font-size:22px; }
.ens-avatar-group{ display:inline-flex; } .ens-avatar-group > *{ margin-left:-8px; box-shadow:0 0 0 2px var(--surface); border-radius:var(--radius-pill); } .ens-avatar-group > *:first-child{ margin-left:0; }
/* Card */
.ens-card{ background:var(--surface-card); border:1px solid var(--border); border-radius:var(--radius-xl); box-shadow:var(--shadow-xs); display:flex; flex-direction:column; overflow:hidden;
  transition:border-color var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out); }
.ens-card--interactive{ cursor:pointer; } .ens-card--interactive:hover{ border-color:var(--border-strong); box-shadow:var(--shadow-md); transform:translateY(-2px); }
.ens-card--selected{ border-color:var(--brand); box-shadow:0 0 0 1px var(--brand), var(--shadow-sm); }
.ens-card__body{ padding:var(--pad-card); display:flex; flex-direction:column; gap:10px; }
.ens-card__header{ padding:16px var(--pad-card); border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; gap:12px; }
.ens-card__title{ font-family:var(--font-display); font-size:16px; font-weight:600; letter-spacing:-0.01em; }
/* Tabs */
.ens-tabs{ display:inline-flex; align-items:center; gap:2px; font-family:var(--font-sans); }
.ens-tabs--line{ gap:22px; border-bottom:1px solid var(--border); display:flex; } .ens-tabs--pill{ background:var(--gray-100); padding:3px; border-radius:var(--radius-md); }
.ens-tab{ appearance:none; border:0; background:transparent; cursor:pointer; font-family:var(--font-sans); font-size:13.5px; font-weight:600; color:var(--text-secondary);
  display:inline-flex; align-items:center; gap:7px; white-space:nowrap; transition:color var(--dur-fast), background var(--dur-fast); }
.ens-tab svg{ width:15px; height:15px; }
.ens-tabs--pill .ens-tab{ padding:6px 14px; border-radius:var(--radius-sm); } .ens-tabs--pill .ens-tab[aria-selected="true"]{ background:var(--surface); color:var(--text-primary); box-shadow:var(--shadow-sm); }
.ens-tabs--line .ens-tab{ padding:11px 0; position:relative; } .ens-tabs--line .ens-tab[aria-selected="true"]{ color:var(--text-primary); }
.ens-tabs--line .ens-tab[aria-selected="true"]::after{ content:""; position:absolute; left:0; right:0; bottom:-1px; height:2px; background:var(--ink); border-radius:2px 2px 0 0; }
.ens-tab:hover{ color:var(--text-primary); } .ens-tab__count{ font-family:var(--font-mono); font-size:11px; color:var(--text-tertiary); }
/* AgentCard */
.ens-agentcard{ background:var(--surface-card); border:1px solid var(--border); border-radius:var(--radius-xl); box-shadow:var(--shadow-xs); padding:18px; display:flex; flex-direction:column; gap:14px;
  transition:border-color var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out); }
.ens-agentcard--interactive{ cursor:pointer; } .ens-agentcard--interactive:hover{ border-color:var(--border-strong); box-shadow:var(--shadow-md); transform:translateY(-2px); }
.ens-agentcard__top{ display:flex; align-items:flex-start; gap:13px; }
.ens-agentcard__glyph{ width:44px; height:44px; border-radius:var(--radius-lg); flex:none; display:flex; align-items:center; justify-content:center; } .ens-agentcard__glyph svg{ width:22px; height:22px; }
.ens-agentcard__name{ font-family:var(--font-display); font-size:16px; font-weight:600; letter-spacing:-0.01em; color:var(--text-primary); }
.ens-agentcard__role{ font-size:12.5px; color:var(--text-tertiary); margin-top:1px; }
.ens-agentcard__desc{ font-size:13.5px; line-height:1.5; color:var(--text-secondary); margin:0; }
.ens-agentcard__foot{ display:flex; align-items:center; justify-content:space-between; gap:10px; margin-top:2px; }
.ens-agentcard__meta{ display:flex; align-items:center; gap:6px; font-family:var(--font-mono); font-size:11px; color:var(--text-tertiary); }
/* TeamCard */
.ens-teamcard{ background:var(--surface-card); border:1px solid var(--border); border-radius:var(--radius-xl); box-shadow:var(--shadow-xs); overflow:hidden; display:flex; flex-direction:column;
  transition:border-color var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out); }
.ens-teamcard--interactive{ cursor:pointer; } .ens-teamcard--interactive:hover{ border-color:var(--border-strong); box-shadow:var(--shadow-md); transform:translateY(-2px); }
.ens-teamcard__bar{ height:4px; background:var(--grad-duo); }
.ens-teamcard__body{ padding:18px; display:flex; flex-direction:column; gap:13px; }
.ens-teamcard__head{ display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
.ens-teamcard__name{ font-family:var(--font-display); font-size:17px; font-weight:600; letter-spacing:-0.012em; color:var(--text-primary); }
.ens-teamcard__sub{ font-size:12.5px; color:var(--text-tertiary); margin-top:2px; }
.ens-teamcard__desc{ font-size:13.5px; line-height:1.5; color:var(--text-secondary); margin:0; }
.ens-teamcard__members{ display:flex; align-items:center; gap:10px; } .ens-teamcard__count{ font-size:12.5px; color:var(--text-tertiary); }
.ens-teamcard__foot{ display:flex; align-items:center; justify-content:space-between; gap:10px; border-top:1px solid var(--border); margin-top:2px; padding-top:13px; }
`;
(function () {
  if (typeof document !== 'undefined' && !document.getElementById('ens-kit-css')) {
    const s = document.createElement('style');
    s.id = 'ens-kit-css';
    s.textContent = KIT_CSS;
    document.head.appendChild(s);
  }
})();
const cx = (...a) => a.filter(Boolean).join(' ');

/* React-owned Lucide icon: renders into a leaf <span> via a ref so React never
   reconciles the swapped <i>→<svg> DOM (which otherwise corrupts sibling updates). */
function LucideIcon({
  name,
  size,
  className = '',
  style
}) {
  const ref = React.useRef(null);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !window.lucide) return;
    el.innerHTML = '';
    const i = document.createElement('i');
    i.setAttribute('data-lucide', name);
    const px = size || style && style.width;
    if (px) {
      i.setAttribute('width', String(px));
      i.setAttribute('height', String(px));
    }
    el.appendChild(i);
    try {
      window.lucide.createIcons();
    } catch (e) {}
  }, [name, size]);
  return /*#__PURE__*/React.createElement("span", {
    ref: ref,
    className: cx('luc', className),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      lineHeight: 0,
      ...style
    }
  });
}
const Icon = (name, opts = {}) => /*#__PURE__*/React.createElement(LucideIcon, {
  name: name,
  size: opts.size,
  className: opts.className,
  style: opts.style
});
function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  iconLeft,
  iconRight,
  as = 'button',
  className = '',
  children,
  ...rest
}) {
  const Tag = as;
  return /*#__PURE__*/React.createElement(Tag, _extends({
    className: cx('ens-btn', 'ens-btn--' + size, variant !== 'primary' && 'ens-btn--' + variant, fullWidth && 'ens-btn--full', className)
  }, rest), iconLeft && /*#__PURE__*/React.createElement("span", {
    className: "ens-btn__icon"
  }, iconLeft), children, iconRight && /*#__PURE__*/React.createElement("span", {
    className: "ens-btn__icon"
  }, iconRight));
}
function IconButton({
  variant = 'ghost',
  size = 'md',
  label,
  className = '',
  children,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    className: cx('ens-iconbtn', 'ens-iconbtn--' + size, variant !== 'ghost' && 'ens-iconbtn--' + variant, className),
    "aria-label": label,
    title: label
  }, rest), children);
}
function Input({
  icon,
  className = '',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "ens-input-wrap"
  }, icon && /*#__PURE__*/React.createElement("span", {
    className: "ens-input__icon"
  }, icon), /*#__PURE__*/React.createElement("input", _extends({
    className: cx('ens-input', icon && 'ens-input--has-icon', className)
  }, rest)));
}
function Badge({
  variant = 'neutral',
  dot,
  icon,
  className = '',
  children,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    className: cx('ens-badge', 'ens-badge--' + variant, className)
  }, rest), dot && /*#__PURE__*/React.createElement("span", {
    className: "ens-badge__dot"
  }), icon || null, children);
}
function Tag({
  category,
  glyph,
  className = '',
  children,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    className: cx('ens-tag', category && 'ens-tag--' + category, className)
  }, rest), glyph && /*#__PURE__*/React.createElement("span", {
    className: "ens-tag__glyph"
  }, glyph), children);
}
const SLABEL = {
  idle: 'Idle',
  running: 'Running',
  success: 'Done',
  error: 'Failed',
  paused: 'Paused'
};
function StatusDot({
  status = 'idle',
  label,
  showLabel = true,
  className = '',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    className: cx('ens-status', 'ens-status--' + status, className)
  }, rest), /*#__PURE__*/React.createElement("span", {
    className: "ens-status__dot"
  }), showLabel && /*#__PURE__*/React.createElement("span", null, label || SLABEL[status]));
}
function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}
function Avatar({
  name,
  src,
  size = 'md',
  square,
  color,
  style,
  className = '',
  children,
  ...rest
}) {
  const bg = color ? {
    background: color,
    color: '#fff',
    borderColor: 'transparent'
  } : null;
  return /*#__PURE__*/React.createElement("span", _extends({
    className: cx('ens-avatar', 'ens-avatar--' + size, square && 'ens-avatar--square', className),
    style: {
      ...bg,
      ...style
    },
    title: name
  }, rest), src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: name || ''
  }) : children || initials(name));
}
function AvatarGroup({
  className = '',
  children,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    className: cx('ens-avatar-group', className)
  }, rest), children);
}
function Card({
  interactive,
  selected,
  className = '',
  children,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: cx('ens-card', interactive && 'ens-card--interactive', selected && 'ens-card--selected', className)
  }, rest), children);
}
function CardHeader({
  title,
  action,
  className = '',
  children,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: cx('ens-card__header', className)
  }, rest), title ? /*#__PURE__*/React.createElement("span", {
    className: "ens-card__title"
  }, title) : children, action || null);
}
function CardBody({
  className = '',
  children,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: cx('ens-card__body', className)
  }, rest), children);
}
function Tabs({
  items = [],
  value,
  onChange,
  variant = 'pill',
  className = '',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    role: "tablist",
    className: cx('ens-tabs', 'ens-tabs--' + variant, className)
  }, rest), items.map(it => {
    const item = typeof it === 'string' ? {
      value: it,
      label: it
    } : it;
    const sel = item.value === value;
    return /*#__PURE__*/React.createElement("button", {
      key: item.value,
      role: "tab",
      type: "button",
      "aria-selected": sel,
      className: "ens-tab",
      onClick: () => onChange && onChange(item.value)
    }, item.icon || null, item.label, item.count != null && /*#__PURE__*/React.createElement("span", {
      className: "ens-tab__count"
    }, item.count));
  }));
}
const CATL = {
  design: 'Design',
  seo: 'SEO',
  copy: 'Copy',
  social: 'Social',
  ads: 'Ads',
  data: 'Data'
};
function AgentCard({
  name,
  role,
  description,
  category = 'design',
  glyph,
  status,
  added,
  onAdd,
  interactive,
  className = '',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: cx('ens-agentcard', interactive && 'ens-agentcard--interactive', className)
  }, rest), /*#__PURE__*/React.createElement("div", {
    className: "ens-agentcard__top"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ens-agentcard__glyph",
    style: {
      background: `var(--cat-${category}-bg)`,
      color: `var(--cat-${category})`
    }
  }, glyph), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "ens-agentcard__name"
  }, name), /*#__PURE__*/React.createElement("div", {
    className: "ens-agentcard__role"
  }, role)), /*#__PURE__*/React.createElement(Tag, {
    category: category
  }, CATL[category])), description && /*#__PURE__*/React.createElement("p", {
    className: "ens-agentcard__desc"
  }, description), /*#__PURE__*/React.createElement("div", {
    className: "ens-agentcard__foot"
  }, status ? /*#__PURE__*/React.createElement(StatusDot, {
    status: status
  }) : /*#__PURE__*/React.createElement("span", {
    className: "ens-agentcard__meta"
  }, "Specialist agent"), onAdd && /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: added ? 'secondary' : 'primary',
    onClick: onAdd
  }, added ? 'Added' : 'Add to team')));
}
const MCOL = {
  design: 'var(--cat-design)',
  seo: 'var(--cat-seo)',
  copy: 'var(--cat-copy)',
  social: 'var(--cat-social)',
  ads: 'var(--cat-ads)',
  data: 'var(--cat-data)'
};
function TeamCard({
  name,
  description,
  members = [],
  status = 'idle',
  lastRun,
  deployed,
  onDeploy,
  interactive,
  className = '',
  ...rest
}) {
  const shown = members.slice(0, 4);
  const extra = members.length - shown.length;
  return /*#__PURE__*/React.createElement("div", _extends({
    className: cx('ens-teamcard', interactive && 'ens-teamcard--interactive', className)
  }, rest), /*#__PURE__*/React.createElement("div", {
    className: "ens-teamcard__bar"
  }), /*#__PURE__*/React.createElement("div", {
    className: "ens-teamcard__body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ens-teamcard__head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "ens-teamcard__name"
  }, name), /*#__PURE__*/React.createElement("div", {
    className: "ens-teamcard__sub"
  }, members.length, " agents", lastRun ? ` · last run ${lastRun}` : '')), /*#__PURE__*/React.createElement(StatusDot, {
    status: status
  })), description && /*#__PURE__*/React.createElement("p", {
    className: "ens-teamcard__desc"
  }, description), /*#__PURE__*/React.createElement("div", {
    className: "ens-teamcard__members"
  }, /*#__PURE__*/React.createElement(AvatarGroup, null, shown.map((m, i) => /*#__PURE__*/React.createElement(Avatar, {
    key: i,
    name: m.name,
    size: "sm",
    color: MCOL[m.category] || 'var(--gray-500)'
  })), extra > 0 && /*#__PURE__*/React.createElement(Avatar, {
    size: "sm"
  }, "+", extra)), /*#__PURE__*/React.createElement("span", {
    className: "ens-teamcard__count"
  }, shown.map(m => m.name).join(' · '), extra > 0 ? ` +${extra}` : '')), /*#__PURE__*/React.createElement("div", {
    className: "ens-teamcard__foot"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ens-teamcard__count",
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 11
    }
  }, deployed ? 'Deployed' : 'Ready to deploy'), onDeploy && /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: deployed ? 'secondary' : 'brand',
    onClick: onDeploy
  }, deployed ? 'Open team' : 'Deploy team'))));
}
function useLucide() {/* icons self-render via LucideIcon; no-op kept for API compatibility */}
Object.assign(window, {
  EnsKit: {
    Button,
    IconButton,
    Input,
    Badge,
    Tag,
    StatusDot,
    Avatar,
    AvatarGroup,
    Card,
    CardHeader,
    CardBody,
    Tabs,
    AgentCard,
    TeamCard,
    Icon,
    useLucide
  }
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/_shared/kit-ui.jsx", error: String((e && e.message) || e) }); }

// ui_kits/console/app.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Console app orchestrator */
const {
  Sidebar,
  Topbar
} = window.ConsoleChrome;
const {
  HomeView,
  AgentsView,
  TeamsView,
  ActivityView,
  PlaceholderView
} = window.ConsoleViews;
const {
  TeamWorkspace
} = window.ConsoleTeamspace;
const {
  Icon,
  useLucide
} = window.EnsKit;
const TITLES = {
  home: {
    title: 'Home',
    subtitle: 'Your marketing workspace at a glance',
    newLabel: 'New agent'
  },
  agents: {
    title: 'Agents',
    subtitle: 'Specialist AI workers for single tasks',
    newLabel: 'New agent'
  },
  teams: {
    title: 'Teams',
    subtitle: 'Workflows assembled from agents',
    newLabel: 'Build team'
  },
  activity: {
    title: 'Activity',
    subtitle: 'Live and recent runs',
    newLabel: 'New run'
  }
};
function Toast({
  toast
}) {
  if (!toast) return null;
  return /*#__PURE__*/React.createElement("div", {
    className: "ctoast",
    key: toast.k
  }, /*#__PURE__*/React.createElement("span", {
    className: "ctoast__ic"
  }, Icon('check')), /*#__PURE__*/React.createElement("span", null, toast.msg));
}
function App() {
  useLucide();
  const [nav, setNav] = React.useState('home');
  const [mode, setMode] = React.useState('teams');
  const [openTeam, setOpenTeam] = React.useState('t1');
  const [added, setAdded] = React.useState({});
  const [toast, setToast] = React.useState(null);
  const fire = msg => {
    setToast({
      msg,
      k: Date.now()
    });
    setTimeout(() => setToast(null), 2600);
  };
  const onAdd = id => {
    setAdded(p => ({
      ...p,
      [id]: !p[id]
    }));
    fire(added[id] ? 'Removed from team' : 'Added to team');
  };
  const onDeploy = t => {
    setOpenTeam(t.id);
    setNav('teams');
    fire(t.deployed ? `Opened ${t.name}` : `${t.name} is live. Message the coordinator below.`);
  };
  const onNew = () => fire(nav === 'teams' ? 'Team builder opened' : 'New agent dialog opened');
  const meta = TITLES[nav] || {
    title: nav,
    subtitle: ''
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "capp"
  }, /*#__PURE__*/React.createElement(Sidebar, {
    key: nav,
    nav: nav,
    setNav: setNav
  }), /*#__PURE__*/React.createElement("div", {
    className: "cmain"
  }, /*#__PURE__*/React.createElement(Topbar, _extends({}, meta, {
    onNew: onNew
  })), /*#__PURE__*/React.createElement("div", {
    className: "cscroll"
  }, nav === 'home' && /*#__PURE__*/React.createElement(HomeView, {
    mode: mode,
    setMode: setMode,
    onOpenAgents: () => setNav('agents'),
    onDeploy: onDeploy,
    onAdd: onAdd,
    added: added
  }), nav === 'agents' && /*#__PURE__*/React.createElement(AgentsView, {
    added: added,
    onAdd: onAdd
  }), nav === 'teams' && /*#__PURE__*/React.createElement(TeamWorkspace, {
    openTeam: openTeam,
    setOpenTeam: setOpenTeam
  }), nav === 'activity' && /*#__PURE__*/React.createElement(ActivityView, null), ['library', 'integrations', 'settings'].includes(nav) && /*#__PURE__*/React.createElement(PlaceholderView, {
    title: meta.title
  }))), /*#__PURE__*/React.createElement(Toast, {
    toast: toast
  }));
}
window.ConsoleApp = App;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/console/app.jsx", error: String((e && e.message) || e) }); }

// ui_kits/console/chrome.jsx
try { (() => {
/* Console chrome: Sidebar + Topbar */
const {
  Icon,
  IconButton,
  Button,
  Avatar,
  Input,
  Badge
} = window.EnsKit;
const NAV = [{
  id: 'home',
  label: 'Home',
  icon: 'layout-dashboard'
}, {
  id: 'agents',
  label: 'Agents',
  icon: 'bot'
}, {
  id: 'teams',
  label: 'Teams',
  icon: 'users-round'
}, {
  id: 'activity',
  label: 'Activity',
  icon: 'activity'
}];
const NAV2 = [{
  id: 'library',
  label: 'Library',
  icon: 'shapes'
}, {
  id: 'integrations',
  label: 'Integrations',
  icon: 'plug'
}, {
  id: 'settings',
  label: 'Settings',
  icon: 'settings'
}];
function Logo() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "30",
    height: "30",
    viewBox: "0 0 40 40",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg"
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
    id: "lsnav",
    x1: "4",
    y1: "4",
    x2: "36",
    y2: "36",
    gradientUnits: "userSpaceOnUse"
  }, /*#__PURE__*/React.createElement("stop", {
    stopColor: "#5F9DF7"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "1",
    stopColor: "#1746A2"
  }))), /*#__PURE__*/React.createElement("rect", {
    x: "2",
    y: "2",
    width: "36",
    height: "36",
    rx: "9",
    fill: "url(#lsnav)"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "11",
    y: "22",
    width: "4.5",
    height: "7",
    rx: "1.2",
    fill: "#fff",
    opacity: "0.55"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "17.75",
    y: "18",
    width: "4.5",
    height: "11",
    rx: "1.2",
    fill: "#fff",
    opacity: "0.78"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "24.5",
    y: "14",
    width: "4.5",
    height: "15",
    rx: "1.2",
    fill: "#fff"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M11 19.5 L18 15 L23 17.5 L30.5 11",
    stroke: "#fff",
    strokeWidth: "2.4",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    fill: "none"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M27 10.4 L31 10 L30.6 14 Z",
    fill: "#fff"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 800,
      fontSize: 18,
      letterSpacing: '-0.01em',
      color: 'var(--blue-700)'
    }
  }, "Legal", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--accent)'
    }
  }, "Soft")));
}
function NavItem({
  item,
  active,
  onClick
}) {
  return /*#__PURE__*/React.createElement("button", {
    className: "cnav",
    onClick: onClick,
    style: active ? {
      background: 'var(--gray-100)',
      color: 'var(--text-primary)',
      fontWeight: 600
    } : undefined
  }, Icon(item.icon), /*#__PURE__*/React.createElement("span", null, item.label));
}
function Sidebar({
  nav,
  setNav
}) {
  return /*#__PURE__*/React.createElement("aside", {
    className: "csidebar"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '18px 16px 8px'
    }
  }, /*#__PURE__*/React.createElement(Logo, null)), /*#__PURE__*/React.createElement("div", {
    className: "cworkspace"
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: "Northwind Co",
    size: "sm",
    square: true,
    color: "var(--cat-ads)"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, "Northwind Co"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--text-tertiary)'
    }
  }, "Marketing workspace")), Icon('chevrons-up-down', {
    style: {
      width: 15,
      height: 15,
      color: 'var(--text-tertiary)'
    }
  })), /*#__PURE__*/React.createElement("nav", {
    className: "cnavlist"
  }, NAV.map(it => /*#__PURE__*/React.createElement(NavItem, {
    key: it.id,
    item: it,
    active: nav === it.id,
    onClick: () => setNav(it.id)
  })), /*#__PURE__*/React.createElement("div", {
    className: "cnavdiv"
  }), NAV2.map(it => /*#__PURE__*/React.createElement(NavItem, {
    key: it.id,
    item: it,
    active: nav === it.id,
    onClick: () => setNav(it.id)
  }))), /*#__PURE__*/React.createElement("div", {
    className: "cupgrade"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      fontWeight: 600,
      marginBottom: 2
    }
  }, "Pro trial \xB7 6 days left"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--text-tertiary)',
      marginBottom: 10,
      lineHeight: 1.4
    }
  }, "Unlimited agents and teams."), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "accent",
    fullWidth: true
  }, "Upgrade plan")), /*#__PURE__*/React.createElement("div", {
    className: "cuser"
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: "Mara Okafor",
    size: "sm",
    color: "var(--cat-social)"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600
    }
  }, "Mara Okafor"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--text-tertiary)'
    }
  }, "mara@northwind.co")), /*#__PURE__*/React.createElement(IconButton, {
    label: "Account",
    size: "sm"
  }, Icon('ellipsis'))));
}
function Topbar({
  title,
  subtitle,
  onNew,
  newLabel = 'New agent'
}) {
  return /*#__PURE__*/React.createElement("header", {
    className: "ctopbar"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 20,
      fontWeight: 600,
      letterSpacing: '-0.018em'
    }
  }, title), subtitle && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--text-tertiary)',
      marginTop: 1
    }
  }, subtitle)), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      maxWidth: 360,
      margin: '0 24px'
    }
  }, /*#__PURE__*/React.createElement(Input, {
    icon: Icon('search'),
    placeholder: "Search agents, teams, runs\u2026"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(IconButton, {
    label: "Help",
    variant: "ghost"
  }, Icon('life-buoy')), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement(IconButton, {
    label: "Notifications",
    variant: "ghost"
  }, Icon('bell')), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 6,
      right: 7,
      width: 7,
      height: 7,
      borderRadius: 99,
      background: 'var(--brand)',
      boxShadow: '0 0 0 2px var(--surface)'
    }
  })), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    iconLeft: Icon('plus'),
    onClick: onNew
  }, newLabel)));
}
window.ConsoleChrome = {
  Sidebar,
  Topbar,
  Logo
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/console/chrome.jsx", error: String((e && e.message) || e) }); }

// ui_kits/console/data.jsx
try { (() => {
/* Sample data for the Ensemble Console UI kit (fake). */
window.ConsoleData = {
  agents: [{
    id: 'a1',
    name: 'Graphic Designer',
    role: 'Brand & visual assets',
    category: 'design',
    glyph: 'palette',
    description: 'Produces on-brand graphics, social creatives, and ad variants from a brief.'
  }, {
    id: 'a2',
    name: 'SEO Analyst',
    role: 'Search & rankings',
    category: 'seo',
    glyph: 'search',
    description: 'Audits pages, finds keyword gaps, and writes optimization briefs.'
  }, {
    id: 'a3',
    name: 'Copywriter',
    role: 'Words that convert',
    category: 'copy',
    glyph: 'pen-line',
    description: 'Drafts landing copy, emails, and posts in your brand voice.'
  }, {
    id: 'a4',
    name: 'Social Scheduler',
    role: 'Posts & calendars',
    category: 'social',
    glyph: 'megaphone',
    description: 'Plans and queues content across channels at the best times.'
  }, {
    id: 'a5',
    name: 'Ads Optimizer',
    role: 'Paid performance',
    category: 'ads',
    glyph: 'target',
    description: 'Tunes budgets, bids, and creatives to hit your CPA target.'
  }, {
    id: 'a6',
    name: 'Market Researcher',
    role: 'Insights & trends',
    category: 'data',
    glyph: 'bar-chart-3',
    description: 'Summarizes competitors, audiences, and category trends.'
  }, {
    id: 'a7',
    name: 'Email Marketer',
    role: 'Lifecycle & nurture',
    category: 'copy',
    glyph: 'mail',
    description: 'Builds sequences and writes nurture flows that re-engage leads.'
  }, {
    id: 'a8',
    name: 'Brand Strategist',
    role: 'Positioning & messaging',
    category: 'design',
    glyph: 'compass',
    description: 'Shapes positioning, tone, and messaging pillars for campaigns.'
  }],
  teams: [{
    id: 't1',
    name: 'Campaign Manager',
    status: 'running',
    lastRun: 'just now',
    deployed: true,
    description: 'Plans, drafts, and schedules a full campaign across channels.',
    members: [{
      name: 'Brand Strategist',
      category: 'design'
    }, {
      name: 'Copywriter',
      category: 'copy'
    }, {
      name: 'Graphic Designer',
      category: 'design'
    }, {
      name: 'Social Scheduler',
      category: 'social'
    }, {
      name: 'Ads Optimizer',
      category: 'ads'
    }]
  }, {
    id: 't2',
    name: 'Outbound Reach',
    status: 'idle',
    lastRun: '1d ago',
    deployed: false,
    description: 'Researches prospects and runs personalized multi-touch outreach.',
    members: [{
      name: 'Market Researcher',
      category: 'data'
    }, {
      name: 'Copywriter',
      category: 'copy'
    }, {
      name: 'Email Marketer',
      category: 'copy'
    }]
  }, {
    id: 't3',
    name: 'Content Engine',
    status: 'success',
    lastRun: '3h ago',
    deployed: true,
    description: 'A steady stream of SEO-driven articles, edited and published.',
    members: [{
      name: 'SEO Analyst',
      category: 'seo'
    }, {
      name: 'Copywriter',
      category: 'copy'
    }, {
      name: 'Graphic Designer',
      category: 'design'
    }, {
      name: 'Social Scheduler',
      category: 'social'
    }]
  }, {
    id: 't4',
    name: 'Launch Squad',
    status: 'paused',
    lastRun: '2d ago',
    deployed: false,
    description: 'Coordinates a product launch from teaser to announcement.',
    members: [{
      name: 'Brand Strategist',
      category: 'design'
    }, {
      name: 'Graphic Designer',
      category: 'design'
    }, {
      name: 'Ads Optimizer',
      category: 'ads'
    }, {
      name: 'Email Marketer',
      category: 'copy'
    }]
  }],
  runSteps: [{
    t: '14:02:31',
    agent: 'Brand Strategist',
    cat: 'design',
    msg: 'Defined 3 messaging pillars',
    status: 'success'
  }, {
    t: '14:03:08',
    agent: 'Market Researcher',
    cat: 'data',
    msg: 'Summarized 12 competitor campaigns',
    status: 'success'
  }, {
    t: '14:05:44',
    agent: 'Copywriter',
    cat: 'copy',
    msg: 'Drafted 8 post variants + 2 emails',
    status: 'success'
  }, {
    t: '14:07:12',
    agent: 'Graphic Designer',
    cat: 'design',
    msg: 'Rendering 6 creatives…',
    status: 'running'
  }, {
    t: '—',
    agent: 'Social Scheduler',
    cat: 'social',
    msg: 'Queue posts to calendar',
    status: 'idle'
  }, {
    t: '—',
    agent: 'Ads Optimizer',
    cat: 'ads',
    msg: 'Set budgets & launch',
    status: 'idle'
  }]
};

/* Per-team coordinator chat: channel preview, history of past work, and a seed conversation. */
window.ConsoleData.teamChat = {
  t1: {
    coordinator: 'Cam',
    preview: 'Drafting the spring launch posts now…',
    time: 'now',
    unread: 2,
    history: [{
      name: 'Spring Sale — launch',
      when: '2d ago',
      status: 'success',
      stats: '12 posts · 6 creatives · 3 emails'
    }, {
      name: 'Webinar promo push',
      when: '1w ago',
      status: 'success',
      stats: '8 posts · 2 emails · 1 landing page'
    }, {
      name: 'Brand refresh teaser',
      when: '3w ago',
      status: 'success',
      stats: '5 posts · 4 creatives'
    }],
    seed: [{
      role: 'coordinator',
      text: "Hi Mara — I'm Cam, the Campaign Manager. Tell me the goal and I'll route the work to the team. What are we launching?"
    }, {
      role: 'user',
      text: 'Launch our spring sale — 20% off, runs Apr 1–14. Need posts, creatives and a launch email.'
    }, {
      role: 'coordinator',
      text: "On it. I'll brief the strategist first, then hand off to copy, design and ads. Here's the plan:"
    }, {
      role: 'step',
      agent: 'Brand Strategist',
      cat: 'design',
      msg: 'Defined 3 messaging pillars for the sale',
      status: 'success',
      t: '14:02'
    }, {
      role: 'step',
      agent: 'Copywriter',
      cat: 'copy',
      msg: 'Drafted 8 post variants + launch email',
      status: 'success',
      t: '14:05'
    }, {
      role: 'step',
      agent: 'Graphic Designer',
      cat: 'design',
      msg: 'Rendering 6 creatives…',
      status: 'running',
      t: '14:07'
    }, {
      role: 'coordinator',
      text: "Copy and pillars are ready for your review. Designer is finishing creatives — want me to queue everything to the calendar once they're done?"
    }]
  },
  t2: {
    coordinator: 'Theo',
    preview: '18 replies so far — 3 booked meetings.',
    time: '1d',
    unread: 0,
    history: [{
      name: 'Q2 enterprise outreach',
      when: '1d ago',
      status: 'success',
      stats: '240 prospects · 18 replies · 3 meetings'
    }, {
      name: 'Re-engage cold leads',
      when: '5d ago',
      status: 'success',
      stats: '90 prospects · 11 replies'
    }],
    seed: [{
      role: 'coordinator',
      text: "I'm Theo, your Outbound Reach coordinator. Give me an ICP and I'll research, write, and run the sequence."
    }, {
      role: 'user',
      text: 'Target Series-B marketing leaders in SaaS. 3-touch email sequence.'
    }, {
      role: 'step',
      agent: 'Market Researcher',
      cat: 'data',
      msg: 'Built a list of 240 matching prospects',
      status: 'success',
      t: '09:12'
    }, {
      role: 'step',
      agent: 'Copywriter',
      cat: 'copy',
      msg: 'Wrote a 3-touch personalized sequence',
      status: 'success',
      t: '09:20'
    }, {
      role: 'coordinator',
      text: 'Sequence is live. 18 replies and 3 meetings booked so far — full report in the History tab.'
    }]
  },
  t3: {
    coordinator: 'Remy',
    preview: 'Published “10 SEO myths”. Next up: 2 drafts.',
    time: '3h',
    unread: 1,
    history: [{
      name: 'October content sprint',
      when: '3h ago',
      status: 'success',
      stats: '6 articles · 6 hero images · published'
    }, {
      name: 'Pillar page refresh',
      when: '1w ago',
      status: 'success',
      stats: '3 articles · 18 internal links'
    }],
    seed: [{
      role: 'coordinator',
      text: "Remy here, running the Content Engine. Tell me a topic or let me pull from the SEO backlog."
    }, {
      role: 'user',
      text: 'Write and publish a post busting common SEO myths.'
    }, {
      role: 'step',
      agent: 'SEO Analyst',
      cat: 'seo',
      msg: 'Found a 2.4k-volume keyword gap',
      status: 'success',
      t: '11:01'
    }, {
      role: 'step',
      agent: 'Copywriter',
      cat: 'copy',
      msg: 'Drafted “10 SEO myths” (1,400 words)',
      status: 'success',
      t: '11:14'
    }, {
      role: 'coordinator',
      text: 'Published and shared to social. Two more drafts are queued — sound good?'
    }]
  },
  t4: {
    coordinator: 'Nia',
    preview: 'Paused — waiting on launch date.',
    time: '2d',
    unread: 0,
    history: [{
      name: 'v3 product launch',
      when: 'paused',
      status: 'paused',
      stats: 'teaser ready · announcement drafted'
    }],
    seed: [{
      role: 'coordinator',
      text: "I'm Nia, coordinating the Launch Squad. Share the launch date and I'll sequence teaser → announcement → follow-up."
    }, {
      role: 'user',
      text: 'Launch is May 6. Hold everything until I confirm.'
    }, {
      role: 'coordinator',
      text: "Got it — I've drafted the teaser and announcement and paused the squad until you give the go-ahead."
    }]
  }
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/console/data.jsx", error: String((e && e.message) || e) }); }

// ui_kits/console/teamspace.jsx
try { (() => {
/* Team workspace: channel list + coordinator chat (orchestrates member agents) + history */
const {
  Icon,
  Button,
  IconButton,
  Avatar,
  AvatarGroup,
  Badge,
  Tag,
  StatusDot
} = window.EnsKit;
const TD = window.ConsoleData;
const STEP_MSG = {
  design: 'Producing on-brand creatives',
  copy: 'Drafting copy variants',
  seo: 'Running a keyword + audit pass',
  social: 'Scheduling posts to the calendar',
  ads: 'Setting budgets and launching',
  data: 'Pulling research and insights'
};
const nowTime = () => new Date().toLocaleTimeString('en-GB', {
  hour: '2-digit',
  minute: '2-digit'
});
let _mid = 1;
const mid = () => 'm' + _mid++;
function ChannelItem({
  team,
  chat,
  active,
  onClick
}) {
  return /*#__PURE__*/React.createElement("button", {
    className: "twchan",
    "data-active": active ? '1' : '0',
    onClick: onClick,
    style: active ? {
      background: 'var(--gray-100)'
    } : undefined
  }, /*#__PURE__*/React.createElement("span", {
    className: "twchan__ic",
    style: {
      background: 'var(--ink)'
    }
  }, Icon('users-round', {
    size: 16
  })), /*#__PURE__*/React.createElement("div", {
    className: "twchan__body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "twchan__top"
  }, /*#__PURE__*/React.createElement("span", {
    className: "twchan__name"
  }, team.name), /*#__PURE__*/React.createElement("span", {
    className: "twchan__time"
  }, chat.time)), /*#__PURE__*/React.createElement("div", {
    className: "twchan__prev"
  }, chat.preview)), chat.unread > 0 ? /*#__PURE__*/React.createElement("span", {
    className: "twchan__unread"
  }, chat.unread) : /*#__PURE__*/React.createElement(StatusDot, {
    status: team.status,
    showLabel: false
  }));
}
function Msg({
  m
}) {
  if (m.role === 'user') {
    return /*#__PURE__*/React.createElement("div", {
      className: "twmsg twmsg--user"
    }, /*#__PURE__*/React.createElement("div", {
      className: "twbubble twbubble--user"
    }, m.text));
  }
  if (m.role === 'step') {
    return /*#__PURE__*/React.createElement("div", {
      className: "twstep"
    }, /*#__PURE__*/React.createElement(Avatar, {
      name: m.agent,
      size: "sm",
      color: `var(--cat-${m.cat})`
    }), /*#__PURE__*/React.createElement("div", {
      className: "twstep__body"
    }, /*#__PURE__*/React.createElement("div", {
      className: "twstep__name"
    }, m.agent), /*#__PURE__*/React.createElement("div", {
      className: "twstep__msg"
    }, m.msg)), m.status === 'running' ? /*#__PURE__*/React.createElement(StatusDot, {
      status: "running",
      showLabel: false
    }) : /*#__PURE__*/React.createElement(Badge, {
      variant: "success",
      dot: true
    }, "Done"));
  }
  // coordinator
  return /*#__PURE__*/React.createElement("div", {
    className: "twmsg"
  }, /*#__PURE__*/React.createElement(Avatar, {
    size: "sm",
    square: true,
    color: "var(--ink)"
  }, Icon('sparkles', {
    size: 14
  })), /*#__PURE__*/React.createElement("div", {
    className: "twbubble"
  }, m.text));
}
function Composer({
  coordinator,
  onSend
}) {
  const [draft, setDraft] = React.useState('');
  const submit = () => {
    const t = draft.trim();
    if (!t) return;
    setDraft('');
    onSend(t);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "twcomposer"
  }, /*#__PURE__*/React.createElement("div", {
    className: "twcomposer__box"
  }, /*#__PURE__*/React.createElement("input", {
    className: "twcomposer__input",
    placeholder: `Message ${coordinator}, the coordinator…`,
    value: draft,
    onChange: e => setDraft(e.target.value),
    onKeyDown: e => {
      if (e.key === 'Enter') submit();
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "twcomposer__actions"
  }, /*#__PURE__*/React.createElement(IconButton, {
    label: "Attach",
    variant: "ghost",
    size: "sm"
  }, Icon('paperclip', {
    size: 16
  })), /*#__PURE__*/React.createElement(Button, {
    variant: "brand",
    size: "sm",
    onClick: submit,
    iconRight: Icon('arrow-up', {
      size: 15
    })
  }, "Send"))), /*#__PURE__*/React.createElement("div", {
    className: "twcomposer__hint"
  }, Icon('sparkles', {
    size: 12
  }), " The coordinator routes your request to the team's agents."));
}
function History({
  chat
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "twhistory"
  }, chat.history.map((h, i) => /*#__PURE__*/React.createElement("div", {
    className: "twrun",
    key: i
  }, /*#__PURE__*/React.createElement("span", {
    className: "twrun__ic",
    "data-s": h.status
  }, Icon(h.status === 'paused' ? 'pause' : 'check', {
    size: 15
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "twrun__name"
  }, h.name), /*#__PURE__*/React.createElement("div", {
    className: "twrun__stats"
  }, h.stats)), /*#__PURE__*/React.createElement("span", {
    className: "twrun__when"
  }, h.when), /*#__PURE__*/React.createElement(IconButton, {
    label: "Open run",
    variant: "ghost",
    size: "sm"
  }, Icon('chevron-right', {
    size: 16
  })))));
}
function TeamWorkspace({
  openTeam,
  setOpenTeam
}) {
  const teams = TD.teams;
  const tid = openTeam && teams.find(t => t.id === openTeam) ? openTeam : teams[0].id;
  const team = teams.find(t => t.id === tid);
  const chat = TD.teamChat[tid];
  const [tab, setTab] = React.useState('chat');
  const [threads, setThreads] = React.useState(() => {
    const o = {};
    teams.forEach(t => {
      o[t.id] = (TD.teamChat[t.id].seed || []).map(s => ({
        id: mid(),
        ...s
      }));
    });
    return o;
  });
  const scroller = React.useRef(null);
  const messages = threads[tid];
  React.useEffect(() => {
    setTab('chat');
  }, [tid]);
  React.useEffect(() => {
    const el = scroller.current;
    if (el && tab === 'chat') el.scrollTop = el.scrollHeight;
  }, [messages, tab]);
  const append = (id, msg) => setThreads(p => ({
    ...p,
    [id]: [...p[id], {
      id: mid(),
      ...msg
    }]
  }));
  const patch = (id, msgId, changes) => setThreads(p => ({
    ...p,
    [id]: p[id].map(m => m.id === msgId ? {
      ...m,
      ...changes
    } : m)
  }));
  const send = text => {
    const id = tid;
    append(id, {
      role: 'user',
      text
    });
    setTimeout(() => append(id, {
      role: 'coordinator',
      text: "Got it — routing this to the team now."
    }), 500);
    const picks = team.members.slice(0, 3);
    let base = 1150;
    picks.forEach(m => {
      const stepId = mid();
      setTimeout(() => setThreads(p => ({
        ...p,
        [id]: [...p[id], {
          id: stepId,
          role: 'step',
          agent: m.name,
          cat: m.category,
          msg: STEP_MSG[m.category] || 'Working…',
          status: 'running',
          t: nowTime()
        }]
      })), base);
      setTimeout(() => patch(id, stepId, {
        status: 'success'
      }), base + 850);
      base += 1050;
    });
    setTimeout(() => append(id, {
      role: 'coordinator',
      text: `Done — ${picks.length} agents finished and I've logged this run in History.`
    }), base + 400);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "twspace"
  }, /*#__PURE__*/React.createElement("div", {
    className: "twchannels"
  }, /*#__PURE__*/React.createElement("div", {
    className: "twchannels__head"
  }, /*#__PURE__*/React.createElement("span", null, "Teams"), /*#__PURE__*/React.createElement(IconButton, {
    label: "New team",
    variant: "ghost",
    size: "sm"
  }, Icon('plus', {
    size: 16
  }))), /*#__PURE__*/React.createElement("div", {
    className: "twchannels__list"
  }, teams.map(t => /*#__PURE__*/React.createElement(ChannelItem, {
    key: t.id,
    team: t,
    chat: TD.teamChat[t.id],
    active: t.id === tid,
    onClick: () => setOpenTeam(t.id)
  })))), /*#__PURE__*/React.createElement("div", {
    className: "twconv"
  }, /*#__PURE__*/React.createElement("div", {
    className: "twconv__head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "twconv__mark"
  }, Icon('users-round', {
    size: 18
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "twconv__name"
  }, team.name), /*#__PURE__*/React.createElement("div", {
    className: "twconv__sub"
  }, "Coordinated by ", chat.coordinator, " \xB7 ", team.members.length, " agents")), /*#__PURE__*/React.createElement(AvatarGroup, null, team.members.slice(0, 4).map((m, i) => /*#__PURE__*/React.createElement(Avatar, {
    key: i,
    name: m.name,
    size: "sm",
    color: `var(--cat-${m.category})`
  }))), /*#__PURE__*/React.createElement(StatusDot, {
    status: team.status
  }), /*#__PURE__*/React.createElement(IconButton, {
    label: "Team settings",
    variant: "solid",
    size: "md"
  }, Icon('settings', {
    size: 17
  }))), /*#__PURE__*/React.createElement("div", {
    className: "twconv__tabs"
  }, /*#__PURE__*/React.createElement("button", {
    className: "twtab",
    "data-active": tab === 'chat',
    onClick: () => setTab('chat')
  }, Icon('messages-square', {
    size: 15
  }), " Conversation"), /*#__PURE__*/React.createElement("button", {
    className: "twtab",
    "data-active": tab === 'history',
    onClick: () => setTab('history')
  }, Icon('history', {
    size: 15
  }), " History ", /*#__PURE__*/React.createElement("span", {
    className: "twtab__c"
  }, chat.history.length))), tab === 'chat' ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "twthread",
    ref: scroller
  }, /*#__PURE__*/React.createElement("div", {
    className: "twthread__day"
  }, "Today"), messages.map(m => /*#__PURE__*/React.createElement(Msg, {
    key: m.id,
    m: m
  }))), /*#__PURE__*/React.createElement(Composer, {
    coordinator: chat.coordinator,
    onSend: send
  })) : /*#__PURE__*/React.createElement("div", {
    className: "twthread"
  }, /*#__PURE__*/React.createElement(History, {
    chat: chat
  }))));
}
window.ConsoleTeamspace = {
  TeamWorkspace
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/console/teamspace.jsx", error: String((e && e.message) || e) }); }

// ui_kits/console/views.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Console views: Home (agents/teams layouts), Agents, Teams, Activity */
const {
  Icon,
  Button,
  IconButton,
  Avatar,
  AvatarGroup,
  Badge,
  Tag,
  StatusDot,
  Tabs,
  AgentCard,
  TeamCard,
  Card,
  Input,
  useLucide
} = window.EnsKit;
const D = window.ConsoleData;
function Stat({
  icon,
  label,
  value,
  delta,
  tint
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "cstat"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cstat__ic",
    style: {
      background: tint + '-bg' ? `var(--cat-${tint}-bg)` : 'var(--gray-100)',
      color: `var(--cat-${tint})`
    }
  }, Icon(icon)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "cstat__val"
  }, value), /*#__PURE__*/React.createElement("div", {
    className: "cstat__lbl"
  }, label)), delta && /*#__PURE__*/React.createElement("span", {
    className: "cstat__delta"
  }, delta));
}
function StatRow() {
  return /*#__PURE__*/React.createElement("div", {
    className: "cstatrow"
  }, /*#__PURE__*/React.createElement(Stat, {
    icon: "bot",
    label: "Active agents",
    value: "8",
    tint: "ads",
    delta: "+2"
  }), /*#__PURE__*/React.createElement(Stat, {
    icon: "users-round",
    label: "Active teams",
    value: "4",
    tint: "social",
    delta: "+1"
  }), /*#__PURE__*/React.createElement(Stat, {
    icon: "zap",
    label: "Runs today",
    value: "37",
    tint: "seo"
  }), /*#__PURE__*/React.createElement(Stat, {
    icon: "clock",
    label: "Hours saved",
    value: "124",
    tint: "copy",
    delta: "this week"
  }));
}
function HomeView({
  mode,
  setMode,
  onOpenAgents,
  onDeploy,
  onAdd,
  added
}) {
  useLucide();
  return /*#__PURE__*/React.createElement("div", {
    className: "cview"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cgreet"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 26,
      fontWeight: 600,
      letterSpacing: '-0.02em'
    }
  }, "Good morning, Mara"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: 'var(--text-secondary)',
      marginTop: 3
    }
  }, "Your Campaign Manager is running. Two teams are ready to deploy.")), /*#__PURE__*/React.createElement(Tabs, {
    variant: "pill",
    value: mode,
    onChange: setMode,
    items: [{
      value: 'agents',
      label: 'Agents',
      icon: Icon('bot')
    }, {
      value: 'teams',
      label: 'Teams',
      icon: Icon('users-round')
    }]
  })), /*#__PURE__*/React.createElement(StatRow, null), mode === 'agents' ? /*#__PURE__*/React.createElement("section", null, /*#__PURE__*/React.createElement("div", {
    className: "csechead"
  }, /*#__PURE__*/React.createElement("h3", null, "Your specialists"), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    iconRight: Icon('arrow-right'),
    onClick: onOpenAgents
  }, "Browse all agents")), /*#__PURE__*/React.createElement("div", {
    className: "cgrid cgrid--3"
  }, D.agents.slice(0, 6).map(a => /*#__PURE__*/React.createElement(AgentCard, _extends({
    key: a.id
  }, a, {
    glyph: Icon(a.glyph),
    interactive: true,
    added: !!added[a.id],
    onAdd: () => onAdd(a.id)
  }))))) : /*#__PURE__*/React.createElement("div", {
    className: "chome-teams"
  }, /*#__PURE__*/React.createElement("section", null, /*#__PURE__*/React.createElement("div", {
    className: "csechead"
  }, /*#__PURE__*/React.createElement("h3", null, "Active teams"), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    iconRight: Icon('arrow-right')
  }, "Manage")), /*#__PURE__*/React.createElement("div", {
    className: "cgrid cgrid--2"
  }, D.teams.map(t => /*#__PURE__*/React.createElement(TeamCard, _extends({
    key: t.id
  }, t, {
    interactive: true,
    onDeploy: () => onDeploy(t)
  }))))), /*#__PURE__*/React.createElement("aside", {
    className: "cactivity-mini"
  }, /*#__PURE__*/React.createElement("div", {
    className: "csechead"
  }, /*#__PURE__*/React.createElement("h3", null, "Live now"), /*#__PURE__*/React.createElement(StatusDot, {
    status: "running"
  })), /*#__PURE__*/React.createElement(RunMini, null))));
}
function RunMini() {
  return /*#__PURE__*/React.createElement("div", {
    className: "crunmini"
  }, D.runSteps.slice(0, 4).map((s, i) => /*#__PURE__*/React.createElement("div", {
    className: "crunmini__row",
    key: i
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: s.agent,
    size: "xs",
    color: `var(--cat-${s.cat})`
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      fontWeight: 600,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, s.agent), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--text-tertiary)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, s.msg)), s.status === 'running' ? /*#__PURE__*/React.createElement(StatusDot, {
    status: "running",
    showLabel: false
  }) : s.status === 'success' ? Icon('check', {
    style: {
      width: 15,
      height: 15,
      color: 'var(--success)'
    }
  }) : Icon('circle-dashed', {
    style: {
      width: 15,
      height: 15,
      color: 'var(--gray-300)'
    }
  }))));
}
const CATS = [{
  value: 'all',
  label: 'All'
}, {
  value: 'design',
  label: 'Design'
}, {
  value: 'seo',
  label: 'SEO'
}, {
  value: 'copy',
  label: 'Copy'
}, {
  value: 'social',
  label: 'Social'
}, {
  value: 'ads',
  label: 'Ads'
}, {
  value: 'data',
  label: 'Data'
}];
function AgentsView({
  added,
  onAdd
}) {
  useLucide();
  const [cat, setCat] = React.useState('all');
  const list = cat === 'all' ? D.agents : D.agents.filter(a => a.category === cat);
  return /*#__PURE__*/React.createElement("div", {
    className: "cview"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cfilterbar"
  }, /*#__PURE__*/React.createElement(Tabs, {
    variant: "line",
    value: cat,
    onChange: setCat,
    items: CATS
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(IconButton, {
    label: "Grid view",
    variant: "solid"
  }, Icon('layout-grid')), /*#__PURE__*/React.createElement(IconButton, {
    label: "List view",
    variant: "ghost"
  }, Icon('list')))), /*#__PURE__*/React.createElement("div", {
    className: "cgrid cgrid--3"
  }, list.map(a => /*#__PURE__*/React.createElement(AgentCard, _extends({
    key: a.id
  }, a, {
    glyph: Icon(a.glyph),
    interactive: true,
    added: !!added[a.id],
    onAdd: () => onAdd(a.id)
  }))), /*#__PURE__*/React.createElement("div", {
    className: "caddcard"
  }, /*#__PURE__*/React.createElement("span", {
    className: "caddcard__ic"
  }, Icon('sparkles')), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      fontSize: 14
    }
  }, "Need something else?"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--text-tertiary)',
      textAlign: 'center',
      marginBottom: 10
    }
  }, "Describe a task and we'll spin up a custom agent."), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "sm",
    iconLeft: Icon('wand-sparkles')
  }, "Create custom agent"))));
}
function TeamsView({
  onDeploy
}) {
  useLucide();
  return /*#__PURE__*/React.createElement("div", {
    className: "cview"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cgrid cgrid--2"
  }, D.teams.map(t => /*#__PURE__*/React.createElement(TeamCard, _extends({
    key: t.id
  }, t, {
    interactive: true,
    onDeploy: () => onDeploy(t)
  }))), /*#__PURE__*/React.createElement("button", {
    className: "cbuildcard"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cbuildcard__ic"
  }, Icon('plus')), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
      fontSize: 16
    }
  }, "Build a team"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--text-tertiary)',
      textAlign: 'center',
      maxWidth: 230
    }
  }, "Combine specialist agents into a workflow that runs itself."))));
}
function ActivityView() {
  useLucide();
  const team = D.teams[0];
  return /*#__PURE__*/React.createElement("div", {
    className: "cview"
  }, /*#__PURE__*/React.createElement("div", {
    className: "crundetail"
  }, /*#__PURE__*/React.createElement("div", {
    className: "crun-main"
  }, /*#__PURE__*/React.createElement("div", {
    className: "crun-head"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "crun-mark"
  }, Icon('users-round')), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 18,
      fontWeight: 600
    }
  }, team.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--text-tertiary)',
      fontFamily: 'var(--font-mono)'
    }
  }, "run #4812 \xB7 started 14:02:31"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(StatusDot, {
    status: "running"
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "sm",
    iconLeft: Icon('pause')
  }, "Pause"), /*#__PURE__*/React.createElement(IconButton, {
    label: "More",
    variant: "solid"
  }, Icon('ellipsis')))), /*#__PURE__*/React.createElement("div", {
    className: "ctimeline"
  }, D.runSteps.map((s, i) => /*#__PURE__*/React.createElement("div", {
    className: "cstep",
    key: i,
    "data-status": s.status
  }, /*#__PURE__*/React.createElement("div", {
    className: "cstep__rail"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cstep__node"
  })), /*#__PURE__*/React.createElement("div", {
    className: "cstep__card"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: s.agent,
    size: "sm",
    color: `var(--cat-${s.cat})`
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      fontWeight: 600
    }
  }, s.agent), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--text-secondary)'
    }
  }, s.msg)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      color: 'var(--text-tertiary)'
    }
  }, s.t), s.status === 'success' && /*#__PURE__*/React.createElement(Badge, {
    variant: "success",
    dot: true
  }, "Done"), s.status === 'running' && /*#__PURE__*/React.createElement(Badge, {
    variant: "brand",
    dot: true
  }, "Running"), s.status === 'idle' && /*#__PURE__*/React.createElement(Badge, {
    variant: "outline"
  }, "Queued"))))))), /*#__PURE__*/React.createElement("aside", {
    className: "crun-side"
  }, /*#__PURE__*/React.createElement("div", {
    className: "csechead"
  }, /*#__PURE__*/React.createElement("h3", null, "Summary")), /*#__PURE__*/React.createElement("div", {
    className: "crun-stats"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "crun-stat__v"
  }, "12"), /*#__PURE__*/React.createElement("div", {
    className: "crun-stat__l"
  }, "posts drafted")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "crun-stat__v"
  }, "6"), /*#__PURE__*/React.createElement("div", {
    className: "crun-stat__l"
  }, "creatives")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "crun-stat__v"
  }, "4m 17s"), /*#__PURE__*/React.createElement("div", {
    className: "crun-stat__l"
  }, "elapsed")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "crun-stat__v"
  }, "$0.42"), /*#__PURE__*/React.createElement("div", {
    className: "crun-stat__l"
  }, "est. cost"))), /*#__PURE__*/React.createElement("div", {
    className: "csechead",
    style: {
      marginTop: 18
    }
  }, /*#__PURE__*/React.createElement("h3", null, "Members")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, team.members.map((m, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: m.name,
    size: "xs",
    color: `var(--cat-${m.category})`
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 500
    }
  }, m.name), /*#__PURE__*/React.createElement(Tag, {
    category: m.category,
    style: {
      marginLeft: 'auto'
    }
  }, m.category.toUpperCase())))))));
}
function PlaceholderView({
  title
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "cview"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cplaceholder"
  }, Icon('shapes', {
    style: {
      width: 30,
      height: 30,
      color: 'var(--gray-300)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      fontSize: 15,
      marginTop: 10
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--text-tertiary)'
    }
  }, "This area is part of the kit's navigation shell.")));
}
window.ConsoleViews = {
  HomeView,
  AgentsView,
  TeamsView,
  ActivityView,
  PlaceholderView
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/console/views.jsx", error: String((e && e.message) || e) }); }

// ui_kits/marketing/sections.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Marketing landing page sections */
const {
  Icon,
  Button,
  Badge,
  Tag,
  AgentCard,
  TeamCard,
  Avatar,
  AvatarGroup,
  StatusDot
} = window.EnsKit;
const D = window.ConsoleData;
function Nav() {
  return /*#__PURE__*/React.createElement("header", {
    className: "mnav"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mnav__in"
  }, /*#__PURE__*/React.createElement("a", {
    className: "mnav__logo",
    href: "#"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "30",
    height: "30",
    viewBox: "0 0 40 40",
    fill: "none"
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
    id: "mlnav",
    x1: "4",
    y1: "4",
    x2: "36",
    y2: "36",
    gradientUnits: "userSpaceOnUse"
  }, /*#__PURE__*/React.createElement("stop", {
    stopColor: "#5F9DF7"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "1",
    stopColor: "#1746A2"
  }))), /*#__PURE__*/React.createElement("rect", {
    x: "2",
    y: "2",
    width: "36",
    height: "36",
    rx: "9",
    fill: "url(#mlnav)"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "11",
    y: "22",
    width: "4.5",
    height: "7",
    rx: "1.2",
    fill: "#fff",
    opacity: "0.55"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "17.75",
    y: "18",
    width: "4.5",
    height: "11",
    rx: "1.2",
    fill: "#fff",
    opacity: "0.78"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "24.5",
    y: "14",
    width: "4.5",
    height: "15",
    rx: "1.2",
    fill: "#fff"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M11 19.5 L18 15 L23 17.5 L30.5 11",
    stroke: "#fff",
    strokeWidth: "2.4",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    fill: "none"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M27 10.4 L31 10 L30.6 14 Z",
    fill: "#fff"
  })), /*#__PURE__*/React.createElement("span", null, "Legal", /*#__PURE__*/React.createElement("em", {
    style: {
      fontStyle: 'normal',
      color: 'var(--accent)'
    }
  }, "Soft"))), /*#__PURE__*/React.createElement("nav", {
    className: "mnav__links"
  }, /*#__PURE__*/React.createElement("a", {
    href: "#agents"
  }, "Agents"), /*#__PURE__*/React.createElement("a", {
    href: "#teams"
  }, "Teams"), /*#__PURE__*/React.createElement("a", {
    href: "#how"
  }, "How it works"), /*#__PURE__*/React.createElement("a", {
    href: "#pricing"
  }, "Pricing")), /*#__PURE__*/React.createElement("div", {
    className: "mnav__cta"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    as: "a",
    href: "#"
  }, "Sign in"), /*#__PURE__*/React.createElement(Button, {
    variant: "gradient",
    size: "sm",
    as: "a",
    href: "#",
    iconRight: Icon('arrow-right', {
      size: 15
    })
  }, "Get started"))));
}
function Hero() {
  return /*#__PURE__*/React.createElement("section", {
    className: "mhero"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mhero__copy"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mbadge"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mbadge__dot"
  }), "New \xB7 Teams that run themselves"), /*#__PURE__*/React.createElement("h1", null, "Hire AI specialists.", /*#__PURE__*/React.createElement("br", null), "Or deploy a whole ", /*#__PURE__*/React.createElement("em", null, "team"), "."), /*#__PURE__*/React.createElement("p", null, "LegalSoft gives your marketing team specialist AI agents for single tasks \u2014 and lets you combine them into teams that plan, create, and ship campaigns end to end."), /*#__PURE__*/React.createElement("div", {
    className: "mhero__actions"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "gradient",
    size: "lg",
    as: "a",
    href: "#",
    iconRight: Icon('arrow-right', {
      size: 17
    })
  }, "Start free"), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "lg",
    as: "a",
    href: "#",
    iconLeft: Icon('play', {
      size: 16
    })
  }, "Watch demo")), /*#__PURE__*/React.createElement("div", {
    className: "mhero__trust"
  }, /*#__PURE__*/React.createElement(AvatarGroup, null, /*#__PURE__*/React.createElement(Avatar, {
    name: "A",
    size: "sm",
    color: "var(--cat-design)"
  }), /*#__PURE__*/React.createElement(Avatar, {
    name: "B",
    size: "sm",
    color: "var(--cat-copy)"
  }), /*#__PURE__*/React.createElement(Avatar, {
    name: "C",
    size: "sm",
    color: "var(--cat-social)"
  }), /*#__PURE__*/React.createElement(Avatar, {
    name: "D",
    size: "sm",
    color: "var(--cat-ads)"
  })), /*#__PURE__*/React.createElement("span", null, "Trusted by 4,000+ marketing teams"))), /*#__PURE__*/React.createElement("div", {
    className: "mhero__art"
  }, /*#__PURE__*/React.createElement(TeamCard, D.teams[0]), /*#__PURE__*/React.createElement("div", {
    className: "mhero__floats"
  }, /*#__PURE__*/React.createElement(AgentCard, {
    name: "Copywriter",
    role: "Words that convert",
    category: "copy",
    glyph: Icon('pen-line'),
    status: "success"
  }), /*#__PURE__*/React.createElement(AgentCard, {
    name: "Ads Optimizer",
    role: "Paid performance",
    category: "ads",
    glyph: Icon('target'),
    status: "running"
  }))));
}
function Logos() {
  const names = ['Northwind', 'Lumen', 'Forge', 'Acre', 'Vela', 'Cobalt'];
  return /*#__PURE__*/React.createElement("section", {
    className: "mlogos"
  }, /*#__PURE__*/React.createElement("span", null, "Powering campaigns at"), /*#__PURE__*/React.createElement("div", {
    className: "mlogos__row"
  }, names.map(n => /*#__PURE__*/React.createElement("span", {
    key: n,
    className: "mlogo"
  }, n))));
}
function Split() {
  return /*#__PURE__*/React.createElement("section", {
    className: "msplit",
    id: "agents"
  }, /*#__PURE__*/React.createElement("div", {
    className: "msplit__col"
  }, /*#__PURE__*/React.createElement("span", {
    className: "meyebrow",
    style: {
      color: 'var(--cat-ads)'
    }
  }, Icon('bot', {
    size: 15
  }), " AI Agents"), /*#__PURE__*/React.createElement("h2", null, "One specialist.", /*#__PURE__*/React.createElement("br", null), "One job. Done well."), /*#__PURE__*/React.createElement("p", null, "Each agent owns a niche \u2014 design, SEO, copy, social, paid, research. Brief it, and it delivers like a dedicated hire."), /*#__PURE__*/React.createElement("ul", {
    className: "mlist"
  }, /*#__PURE__*/React.createElement("li", null, Icon('check', {
    size: 16
  }), " Purpose-built for a single skill"), /*#__PURE__*/React.createElement("li", null, Icon('check', {
    size: 16
  }), " Works from a short brief"), /*#__PURE__*/React.createElement("li", null, Icon('check', {
    size: 16
  }), " Plug into any team"))), /*#__PURE__*/React.createElement("div", {
    className: "msplit__col",
    id: "teams"
  }, /*#__PURE__*/React.createElement("span", {
    className: "meyebrow",
    style: {
      color: 'var(--cat-social)'
    }
  }, Icon('users-round', {
    size: 15
  }), " AI Teams"), /*#__PURE__*/React.createElement("h2", null, "Many specialists.", /*#__PURE__*/React.createElement("br", null), "Coordinated. Automatic."), /*#__PURE__*/React.createElement("p", null, "Teams combine agents into a workflow \u2014 a Campaign Manager or Outbound Reach crew that routes work between members and reports back as one."), /*#__PURE__*/React.createElement("ul", {
    className: "mlist"
  }, /*#__PURE__*/React.createElement("li", null, Icon('check', {
    size: 16
  }), " Pre-built for common goals"), /*#__PURE__*/React.createElement("li", null, Icon('check', {
    size: 16
  }), " Agents hand off work to each other"), /*#__PURE__*/React.createElement("li", null, Icon('check', {
    size: 16
  }), " Deploy in one click"))));
}
function AgentGrid() {
  return /*#__PURE__*/React.createElement("section", {
    className: "msection",
    id: "how"
  }, /*#__PURE__*/React.createElement("div", {
    className: "msection__head"
  }, /*#__PURE__*/React.createElement("h2", null, "Meet the specialists"), /*#__PURE__*/React.createElement("p", null, "Start with one agent, or assemble a team. Add more as you grow.")), /*#__PURE__*/React.createElement("div", {
    className: "magrid"
  }, D.agents.slice(0, 6).map(a => /*#__PURE__*/React.createElement(AgentCard, _extends({
    key: a.id
  }, a, {
    glyph: Icon(a.glyph),
    interactive: true
  })))));
}
function HowItWorks() {
  const steps = [{
    ic: 'mouse-pointer-click',
    t: 'Pick agents or a team',
    d: 'Browse specialists or deploy a ready-made team.'
  }, {
    ic: 'pencil-ruler',
    t: 'Set the goal',
    d: 'Describe what you want. No prompts to engineer.'
  }, {
    ic: 'rocket',
    t: 'It runs itself',
    d: 'Work routes between agents and reports back to you.'
  }];
  return /*#__PURE__*/React.createElement("section", {
    className: "mhow"
  }, /*#__PURE__*/React.createElement("div", {
    className: "msection__head"
  }, /*#__PURE__*/React.createElement("h2", null, "Out of the box in minutes")), /*#__PURE__*/React.createElement("div", {
    className: "mhow__row"
  }, steps.map((s, i) => /*#__PURE__*/React.createElement("div", {
    className: "mstep",
    key: i
  }, /*#__PURE__*/React.createElement("span", {
    className: "mstep__n"
  }, i + 1), /*#__PURE__*/React.createElement("span", {
    className: "mstep__ic"
  }, Icon(s.ic, {
    size: 22
  })), /*#__PURE__*/React.createElement("h3", null, s.t), /*#__PURE__*/React.createElement("p", null, s.d)))));
}
function CTA() {
  return /*#__PURE__*/React.createElement("section", {
    className: "mcta",
    id: "pricing"
  }, /*#__PURE__*/React.createElement("h2", null, "Put your marketing on autopilot."), /*#__PURE__*/React.createElement("p", null, "Free to start. Deploy your first team today."), /*#__PURE__*/React.createElement("div", {
    className: "mcta__actions"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "gradient",
    size: "lg",
    as: "a",
    href: "#",
    iconRight: Icon('arrow-right', {
      size: 17
    })
  }, "Get started free"), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "lg",
    as: "a",
    href: "#"
  }, "Talk to sales")));
}
function Footer() {
  return /*#__PURE__*/React.createElement("footer", {
    className: "mfooter"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mfooter__in"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mfooter__brand"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "26",
    height: "26",
    viewBox: "0 0 40 40",
    fill: "none"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "2",
    y: "2",
    width: "36",
    height: "36",
    rx: "9",
    fill: "#1746A2"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "11",
    y: "22",
    width: "4.5",
    height: "7",
    rx: "1.2",
    fill: "#fff",
    opacity: "0.55"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "17.75",
    y: "18",
    width: "4.5",
    height: "11",
    rx: "1.2",
    fill: "#fff",
    opacity: "0.78"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "24.5",
    y: "14",
    width: "4.5",
    height: "15",
    rx: "1.2",
    fill: "#fff"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M11 19.5 L18 15 L23 17.5 L30.5 11",
    stroke: "#fff",
    strokeWidth: "2.4",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    fill: "none"
  })), /*#__PURE__*/React.createElement("span", null, "Legal", /*#__PURE__*/React.createElement("em", {
    style: {
      fontStyle: 'normal',
      color: 'var(--accent)'
    }
  }, "Soft"))), /*#__PURE__*/React.createElement("span", {
    className: "mfooter__copy"
  }, "\xA9 2026 LegalSoft. AI specialists and teams for your marketing.")));
}
function Landing() {
  return /*#__PURE__*/React.createElement("div", {
    className: "mpage"
  }, /*#__PURE__*/React.createElement(Nav, null), /*#__PURE__*/React.createElement(Hero, null), /*#__PURE__*/React.createElement(Logos, null), /*#__PURE__*/React.createElement(Split, null), /*#__PURE__*/React.createElement(AgentGrid, null), /*#__PURE__*/React.createElement(HowItWorks, null), /*#__PURE__*/React.createElement(CTA, null), /*#__PURE__*/React.createElement(Footer, null));
}
window.MarketingLanding = Landing;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/marketing/sections.jsx", error: String((e && e.message) || e) }); }

__ds_ns.AgentCard = __ds_scope.AgentCard;

__ds_ns.TeamCard = __ds_scope.TeamCard;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.AvatarGroup = __ds_scope.AvatarGroup;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.CardHeader = __ds_scope.CardHeader;

__ds_ns.CardBody = __ds_scope.CardBody;

__ds_ns.CardFooter = __ds_scope.CardFooter;

__ds_ns.Tabs = __ds_scope.Tabs;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.StatusDot = __ds_scope.StatusDot;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Switch = __ds_scope.Switch;

})();
