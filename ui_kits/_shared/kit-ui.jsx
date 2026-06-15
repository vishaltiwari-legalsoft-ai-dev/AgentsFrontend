/* kit-ui.jsx — Enhanced Ensemble component library with beautiful UX.
   Features: Poppins typography, smooth animations, unique cards, fixed scroll issues */

const KIT_CSS = `
/* ===== ANIMATION KEYFRAMES ===== */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes slideInRight {
  from { opacity: 0; transform: translateX(20px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(95, 157, 247, 0.4); }
  50% { box-shadow: 0 0 20px 4px rgba(95, 157, 247, 0.2); }
}
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

/* ===== BUTTONS - Beautiful & Animated ===== */
.ens-btn{
  --_bg:var(--action); --_fg:var(--on-action); --_bd:transparent; --_bgh:var(--action-hover); --_bga:var(--action-active);
  display:inline-flex; align-items:center; justify-content:center; gap:8px;
  font-family:var(--font-sans); font-weight:600; letter-spacing:0;
  border:1.5px solid var(--_bd); border-radius:var(--radius-lg);
  background:var(--_bg); color:var(--_fg); cursor:pointer; white-space:nowrap;
  text-decoration:none; position: relative; overflow: hidden;
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  user-select:none;
}
.ens-btn::before {
  content: ''; position: absolute; top: 0; left: -100%; width: 100%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
  transition: left 0.5s ease;
}
.ens-btn:hover::before { left: 100%; }
.ens-btn:hover{
  background:var(--_bgh);
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 8px 25px -8px color-mix(in srgb, var(--_bg) 50%, transparent);
}
.ens-btn:active{
  background:var(--_bga);
  transform:translateY(0) scale(0.98);
  box-shadow: 0 4px 12px -4px color-mix(in srgb, var(--_bg) 40%, transparent);
}
.ens-btn:focus-visible{ outline:none; box-shadow:var(--ring), 0 0 0 4px color-mix(in srgb, var(--brand) 15%, transparent); }
.ens-btn[disabled],.ens-btn[aria-disabled="true"]{ opacity:.5; cursor:not-allowed; transform:none; box-shadow:none; }
.ens-btn[disabled]::before, .ens-btn[aria-disabled="true"]::before { display: none; }

.ens-btn--sm{ height:34px; padding:0 14px; font-size:13px; border-radius:var(--radius-md); }
.ens-btn--md{ height:42px; padding:0 20px; font-size:14px; }
.ens-btn--lg{ height:50px; padding:0 28px; font-size:15.5px; border-radius:var(--radius-xl); font-weight:600; }
.ens-btn--full{ width:100%; }

.ens-btn--brand{
  --_bg:var(--brand); --_fg:var(--on-brand); --_bgh:var(--brand-hover); --_bga:var(--brand-active);
  box-shadow: 0 4px 14px -4px color-mix(in srgb, var(--brand) 45%, transparent);
}
.ens-btn--brand:hover { box-shadow: 0 8px 28px -8px color-mix(in srgb, var(--brand) 55%, transparent); }

.ens-btn--accent{
  --_bg:var(--accent); --_fg:var(--on-accent); --_bgh:var(--accent-hover); --_bga:var(--accent-active);
  box-shadow: 0 4px 14px -4px color-mix(in srgb, var(--accent) 45%, transparent);
}
.ens-btn--accent:hover { box-shadow: 0 8px 28px -8px color-mix(in srgb, var(--accent) 55%, transparent); }

.ens-btn--gradient{
  background:var(--grad-brand); color:#fff; border-color:transparent;
  background-size:200% 200%; background-position:0% 50%;
  box-shadow: 0 6px 20px -6px color-mix(in srgb, var(--blue-700) 50%, transparent);
}
.ens-btn--gradient:hover{
  background-position:100% 50%;
  box-shadow: 0 10px 32px -10px color-mix(in srgb, var(--blue-700) 60%, transparent);
  transform: translateY(-2px) scale(1.02);
}
.ens-btn--gradient::before { display: none; }

.ens-btn--secondary{
  --_bg:var(--surface); --_fg:var(--text-primary); --_bd:var(--border-strong); --_bgh:var(--surface-hover); --_bga:var(--surface-active);
  box-shadow:var(--shadow-sm), inset 0 1px 0 rgba(255,255,255,0.8);
  font-weight:500;
}
.ens-btn--secondary:hover { box-shadow:var(--shadow-md), inset 0 1px 0 rgba(255,255,255,0.9); background: linear-gradient(180deg, var(--surface) 0%, var(--gray-50) 100%); }

.ens-btn--ghost{
  --_bg:transparent; --_fg:var(--text-primary); --_bgh:var(--surface-hover); --_bga:var(--surface-active);
  border-color: transparent; font-weight:500;
}
.ens-btn--ghost:hover { background: color-mix(in srgb, var(--brand) 8%, transparent); color: var(--brand); }

.ens-btn--danger{
  --_bg:var(--danger); --_fg:#fff; --_bgh:var(--danger-hover); --_bga:var(--danger-hover);
  box-shadow: 0 4px 14px -4px color-mix(in srgb, var(--danger) 40%, transparent);
}

.ens-btn__icon{ display:inline-flex; } .ens-btn__icon svg{ width:1.05em; height:1.05em; }

/* ===== ICON BUTTONS ===== */
.ens-iconbtn{
  --_bg:transparent; --_fg:var(--text-secondary); --_bgh:var(--surface-hover); --_bga:var(--surface-active); --_bd:transparent;
  display:inline-flex; align-items:center; justify-content:center; border:1.5px solid var(--_bd); background:var(--_bg); color:var(--_fg);
  border-radius:var(--radius-md); cursor:pointer;
  transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.ens-iconbtn:hover{
  background:var(--_bgh); color:var(--text-primary);
  transform: scale(1.1) rotate(2deg);
  box-shadow: var(--shadow-sm);
}
.ens-iconbtn:active { transform: scale(0.95); }
.ens-iconbtn:focus-visible{ outline:none; box-shadow:var(--ring); }

.ens-iconbtn--sm{ width:34px; height:34px; border-radius:var(--radius-md); }
.ens-iconbtn--md{ width:40px; height:40px; border-radius:var(--radius-lg); }
.ens-iconbtn--lg{ width:48px; height:48px; border-radius:var(--radius-xl); }
.ens-iconbtn--solid{
  --_bg:var(--surface); --_bd:var(--border-strong);
  box-shadow: var(--shadow-xs), inset 0 1px 0 rgba(255,255,255,0.8);
}
.ens-iconbtn--solid:hover { box-shadow: var(--shadow-sm), inset 0 1px 0 rgba(255,255,255,0.9); transform: scale(1.08); }
.ens-iconbtn--brand{
  --_bg:var(--brand); --_fg:#fff; --_bgh:var(--brand-hover);
  box-shadow: 0 4px 12px -4px color-mix(in srgb, var(--brand) 45%, transparent);
}
.ens-iconbtn--brand:hover { box-shadow: 0 6px 18px -6px color-mix(in srgb, var(--brand) 55%, transparent); transform: scale(1.1); color:#fff; }

.ens-iconbtn svg{ width:18px; height:18px; display:block; }

/* ===== INPUT ===== */
.ens-input{
  width:100%; box-sizing:border-box; font-family:var(--font-sans); font-size:14px; font-weight:500;
  color:var(--text-primary); background:var(--surface);
  border:1.5px solid var(--border-strong); border-radius:var(--radius-lg); height:44px; padding:0 16px; outline:none;
  transition: all 0.2s var(--ease-out);
  box-shadow: inset 0 1px 2px rgba(13,16,20,0.03);
}
.ens-input::placeholder{ color:var(--text-disabled); font-weight:400; }
.ens-input:hover{ border-color:var(--gray-400); box-shadow: inset 0 1px 2px rgba(13,16,20,0.05), 0 2px 4px rgba(13,16,20,0.02); }
.ens-input:focus{
  border-color:var(--brand);
  box-shadow:var(--ring), 0 4px 12px -4px color-mix(in srgb, var(--brand) 20%, transparent);
  transform: translateY(-1px);
}
.ens-input-wrap{ position:relative; display:flex; align-items:center; }
.ens-input--has-icon{ padding-left:44px; }
.ens-input__icon{ position:absolute; left:14px; display:inline-flex; color:var(--text-tertiary); pointer-events:none; }
.ens-input__icon svg{ width:18px; height:18px; }

/* ===== BADGE ===== */
.ens-badge{
  display:inline-flex; align-items:center; gap:6px; font-family:var(--font-sans); font-size:11.5px; font-weight:600; line-height:1;
  padding:5px 10px; border-radius:var(--radius-pill); white-space:nowrap; border:1.5px solid transparent;
  transition: all 0.15s var(--ease-out);
}
.ens-badge--neutral{ background:var(--gray-100); color:var(--gray-700); }
.ens-badge--brand{ background:var(--brand-subtle); color:var(--brand-hover); border-color: var(--brand-border); }
.ens-badge--success{ background:var(--success-bg); color:var(--green-600); border-color: color-mix(in srgb, var(--green-500) 20%, transparent); }
.ens-badge--warning{ background:var(--warning-bg); color:var(--amber-600); }
.ens-badge--danger{ background:var(--danger-bg); color:var(--red-600); border-color: color-mix(in srgb, var(--red-500) 20%, transparent); }
.ens-badge--outline{ background:transparent; border-color:var(--border-strong); color:var(--text-secondary); }
.ens-badge:hover { transform: scale(1.05); }
.ens-badge__dot{ width:6px; height:6px; border-radius:var(--radius-pill); background:currentColor; }
.ens-badge__dot--pulse { animation: pulse-dot 2s ease-in-out infinite; }
@keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
.ens-badge svg{ width:12px; height:12px; }

/* ===== TAG ===== */
.ens-tag{
  display:inline-flex; align-items:center; gap:6px; font-family:var(--font-sans); font-size:11.5px; font-weight:600; line-height:1;
  padding:6px 12px; border-radius:var(--radius-pill); white-space:nowrap;
  --_bg:var(--gray-100); --_fg:var(--gray-700); background:var(--_bg); color:var(--_fg);
  border: 1.5px solid transparent;
  transition: all 0.2s var(--ease-out);
}
.ens-tag:hover { transform: translateY(-1px); box-shadow: var(--shadow-sm); }
.ens-tag__glyph{ display:inline-flex; } .ens-tag__glyph svg{ width:13px; height:13px; }
.ens-tag--design{ --_bg:var(--cat-design-bg); --_fg:var(--cat-design); border-color: color-mix(in srgb, var(--cat-design) 15%, transparent); }
.ens-tag--seo{ --_bg:var(--cat-seo-bg); --_fg:var(--cat-seo); border-color: color-mix(in srgb, var(--cat-seo) 15%, transparent); }
.ens-tag--copy{ --_bg:var(--cat-copy-bg); --_fg:var(--cat-copy); border-color: color-mix(in srgb, var(--cat-copy) 15%, transparent); }
.ens-tag--social{ --_bg:var(--cat-social-bg); --_fg:var(--cat-social); border-color: color-mix(in srgb, var(--cat-social) 15%, transparent); }
.ens-tag--ads{ --_bg:var(--cat-ads-bg); --_fg:var(--cat-ads); border-color: color-mix(in srgb, var(--cat-ads) 15%, transparent); }
.ens-tag--data{ --_bg:var(--cat-data-bg); --_fg:var(--cat-data); border-color: color-mix(in srgb, var(--cat-data) 15%, transparent); }

/* ===== STATUS DOT ===== */
.ens-status{ display:inline-flex; align-items:center; gap:8px; font-family:var(--font-sans); font-size:12.5px; font-weight:600; color:var(--text-secondary); }
.ens-status__dot{ position:relative; width:10px; height:10px; border-radius:var(--radius-pill); flex:none; }
.ens-status--idle .ens-status__dot{ background:var(--gray-400); }
.ens-status--running .ens-status__dot{ background:var(--brand); }
.ens-status--success .ens-status__dot{ background:var(--success); }
.ens-status--error .ens-status__dot{ background:var(--danger); }
.ens-status--paused .ens-status__dot{ background:var(--warning); }
.ens-status--running .ens-status__dot::after{
  content:""; position:absolute; inset:-5px; border-radius:var(--radius-pill); background:var(--brand); opacity:.35;
  animation:ens-ping 1.8s var(--ease-out) infinite;
}
@keyframes ens-ping{ 0%{ transform:scale(.4); opacity:.6; } 80%,100%{ transform:scale(2.2); opacity:0; } }
@media (prefers-reduced-motion: reduce){ .ens-status--running .ens-status__dot::after{ animation:none; } }

/* ===== AVATAR ===== */
.ens-avatar{
  display:inline-flex; align-items:center; justify-content:center; flex:none; font-family:var(--font-display); font-weight:600;
  color:var(--text-primary); background:var(--gray-100); border-radius:var(--radius-pill); overflow:hidden;
  border:2px solid var(--surface); box-shadow: var(--shadow-xs);
  user-select:none; transition: all 0.2s var(--ease-out);
}
.ens-avatar:hover { transform: scale(1.08); box-shadow: var(--shadow-md); z-index: 10; }
.ens-avatar--square{ border-radius:var(--radius-lg); }
.ens-avatar img{ width:100%; height:100%; object-fit:cover; display:block; }
.ens-avatar--xs{ width:26px; height:26px; font-size:10px; border-width:1.5px; }
.ens-avatar--sm{ width:34px; height:34px; font-size:12px; }
.ens-avatar--md{ width:42px; height:42px; font-size:14px; font-weight:600; }
.ens-avatar--lg{ width:54px; height:54px; font-size:18px; font-weight:600; }
.ens-avatar--xl{ width:72px; height:72px; font-size:24px; font-weight:600; }

.ens-avatar-group{ display:inline-flex; }
.ens-avatar-group > *{ margin-left:-10px; box-shadow:0 0 0 2px var(--surface), var(--shadow-xs); border-radius:var(--radius-pill); transition: all 0.2s var(--ease-out); }
.ens-avatar-group > *:first-child{ margin-left:0; }
.ens-avatar-group:hover > * { margin-left: 2px; }
.ens-avatar-group > *:hover { margin-left: 2px; transform: scale(1.1); z-index: 20; }

/* ===== CARD ===== */
.ens-card{
  background:var(--surface-card); border:1.5px solid var(--border); border-radius:var(--radius-xl);
  box-shadow:var(--shadow-xs); display:flex; flex-direction:column; overflow:hidden;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.ens-card:hover { box-shadow: var(--shadow-md); }
.ens-card--interactive{ cursor:pointer; }
.ens-card--interactive:hover{
  border-color:var(--border-strong);
  box-shadow:var(--shadow-lg), 0 20px 40px -20px rgba(13,16,20,0.15);
  transform:translateY(-4px) scale(1.01);
}
.ens-card--interactive:active { transform:translateY(-2px) scale(0.995); }
.ens-card--selected{ border-color:var(--brand); box-shadow:0 0 0 2px color-mix(in srgb, var(--brand) 25%, transparent), var(--shadow-md); }
.ens-card__body{ padding:var(--pad-card); display:flex; flex-direction:column; gap:12px; }
.ens-card__header{ padding:18px var(--pad-card); border-bottom:1.5px solid var(--border); display:flex; align-items:center; justify-content:space-between; gap:12px; }
.ens-card__title{ font-family:var(--font-display); font-size:17px; font-weight:600; letter-spacing:-0.01em; color: var(--text-primary); }

/* ===== TABS ===== */
.ens-tabs{ display:inline-flex; align-items:center; gap:3px; font-family:var(--font-sans); }
.ens-tabs--line{ gap:28px; border-bottom:2px solid var(--border); display:flex; }
.ens-tabs--pill{ background:var(--gray-100); padding:4px; border-radius:var(--radius-lg); }

.ens-tab{
  appearance:none; border:0; background:transparent; cursor:pointer; font-family:var(--font-sans);
  font-size:14px; font-weight:500; color:var(--text-secondary);
  display:inline-flex; align-items:center; gap:8px; white-space:nowrap;
  transition: all 0.2s var(--ease-out); position: relative;
}
.ens-tab svg{ width:16px; height:16px; }
.ens-tabs--pill .ens-tab{ padding:8px 18px; border-radius:var(--radius-md); }
.ens-tabs--pill .ens-tab:hover { color: var(--text-primary); background: rgba(255,255,255,0.5); }
.ens-tabs--pill .ens-tab[aria-selected="true"]{
  background:var(--surface); color:var(--text-primary);
  box-shadow: var(--shadow-sm), 0 1px 2px rgba(13,16,20,0.06);
  font-weight:600;
}
.ens-tabs--pill .ens-tab[aria-selected="true"]:hover { box-shadow: var(--shadow-md); }

.ens-tabs--line .ens-tab{ padding:12px 0; position:relative; font-weight:500; }
.ens-tabs--line .ens-tab::after {
  content: ''; position: absolute; left: 0; right: 0; bottom: -2px; height: 2px;
  background: var(--ink); border-radius: 2px 2px 0 0;
  transform: scaleX(0); transition: transform 0.25s var(--ease-out);
}
.ens-tabs--line .ens-tab[aria-selected="true"]{ color:var(--text-primary); font-weight:600; }
.ens-tabs--line .ens-tab[aria-selected="true"]::after { transform: scaleX(1); }
.ens-tabs--line .ens-tab:hover{ color:var(--text-primary); }

.ens-tab__count{ font-family:var(--font-mono); font-size:11px; color:var(--text-tertiary); font-weight:500; }
.ens-tab[aria-selected="true"] .ens-tab__count { color: var(--brand); font-weight:600; }

/* ===== AGENT CARD - Unique & Beautiful ===== */
.ens-agentcard{
  background: linear-gradient(145deg, var(--surface-card) 0%, var(--gray-25) 100%);
  border:1.5px solid var(--border); border-radius:var(--radius-xl);
  box-shadow: var(--shadow-xs), inset 0 1px 0 rgba(255,255,255,0.8);
  padding:20px; display:flex; flex-direction:column; gap:16px;
  position: relative; overflow: hidden;
  transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.ens-agentcard::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
  background: var(--grad-brand); opacity: 0; transition: opacity 0.3s ease;
}
.ens-agentcard:hover::before { opacity: 1; }
.ens-agentcard--interactive{ cursor:pointer; }
.ens-agentcard--interactive:hover{
  border-color:var(--brand-border);
  box-shadow: var(--shadow-lg), 0 24px 48px -24px color-mix(in srgb, var(--brand) 25%, transparent), inset 0 1px 0 rgba(255,255,255,0.9);
  transform:translateY(-6px) scale(1.02);
}
.ens-agentcard--interactive:hover::before { opacity: 1; }
.ens-agentcard--interactive:active { transform:translateY(-3px) scale(0.995); }
.ens-agentcard__top{ display:flex; align-items:flex-start; gap:14px; }
.ens-agentcard__glyph{
  width:52px; height:52px; border-radius:var(--radius-xl); flex:none;
  display:flex; align-items:center; justify-content:center;
  background: linear-gradient(135deg, var(--cat-design-bg) 0%, #fff 100%);
  box-shadow: var(--shadow-sm), inset 0 1px 0 rgba(255,255,255,0.9);
  transition: all 0.3s var(--ease-out);
}
.ens-agentcard:hover .ens-agentcard__glyph {
  transform: scale(1.1) rotate(5deg);
  box-shadow: var(--shadow-md), 0 8px 24px -8px color-mix(in srgb, var(--brand) 30%, transparent);
}
.ens-agentcard__glyph svg{ width:24px; height:24px; transition: transform 0.3s ease; }
.ens-agentcard:hover .ens-agentcard__glyph svg { transform: scale(1.1); }
.ens-agentcard__name{
  font-family:var(--font-display); font-size:17px; font-weight:600;
  letter-spacing:-0.01em; color:var(--text-primary);
  transition: color 0.2s ease;
}
.ens-agentcard:hover .ens-agentcard__name { color: var(--brand); }
.ens-agentcard__role{
  font-size:13px; font-weight:500; color:var(--text-tertiary); margin-top:2px;
}
.ens-agentcard__desc{
  font-size:14px; line-height:1.6; color:var(--text-secondary); margin:0;
  font-weight: 400;
}
.ens-agentcard__foot{ display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:4px; }
.ens-agentcard__meta{
  display:flex; align-items:center; gap:6px; font-family:var(--font-mono);
  font-size:11px; color:var(--text-tertiary); font-weight:500;
}

/* Category-specific card styles */
.ens-agentcard[data-category="design"] .ens-agentcard__glyph { background: linear-gradient(135deg, var(--cat-design-bg) 0%, #fff 100%); }
.ens-agentcard[data-category="design"]:hover { border-color: color-mix(in srgb, var(--cat-design) 30%, transparent); }
.ens-agentcard[data-category="design"]:hover .ens-agentcard__name { color: var(--cat-design); }

.ens-agentcard[data-category="seo"] .ens-agentcard__glyph { background: linear-gradient(135deg, var(--cat-seo-bg) 0%, #fff 100%); }
.ens-agentcard[data-category="seo"]:hover { border-color: color-mix(in srgb, var(--cat-seo) 30%, transparent); }
.ens-agentcard[data-category="seo"]:hover .ens-agentcard__name { color: var(--cat-seo); }

.ens-agentcard[data-category="copy"] .ens-agentcard__glyph { background: linear-gradient(135deg, var(--cat-copy-bg) 0%, #fff 100%); }
.ens-agentcard[data-category="copy"]:hover { border-color: color-mix(in srgb, var(--cat-copy) 30%, transparent); }
.ens-agentcard[data-category="copy"]:hover .ens-agentcard__name { color: var(--cat-copy); }

.ens-agentcard[data-category="social"] .ens-agentcard__glyph { background: linear-gradient(135deg, var(--cat-social-bg) 0%, #fff 100%); }
.ens-agentcard[data-category="social"]:hover { border-color: color-mix(in srgb, var(--cat-social) 30%, transparent); }
.ens-agentcard[data-category="social"]:hover .ens-agentcard__name { color: var(--cat-social); }

.ens-agentcard[data-category="ads"] .ens-agentcard__glyph { background: linear-gradient(135deg, var(--cat-ads-bg) 0%, #fff 100%); }
.ens-agentcard[data-category="ads"]:hover { border-color: color-mix(in srgb, var(--cat-ads) 30%, transparent); }
.ens-agentcard[data-category="ads"]:hover .ens-agentcard__name { color: var(--cat-ads); }

.ens-agentcard[data-category="data"] .ens-agentcard__glyph { background: linear-gradient(135deg, var(--cat-data-bg) 0%, #fff 100%); }
.ens-agentcard[data-category="data"]:hover { border-color: color-mix(in srgb, var(--cat-data) 30%, transparent); }
.ens-agentcard[data-category="data"]:hover .ens-agentcard__name { color: var(--cat-data); }

/* ===== TEAM CARD - Unique & Beautiful ===== */
.ens-teamcard{
  background: linear-gradient(145deg, var(--surface-card) 0%, var(--gray-25) 100%);
  border:1.5px solid var(--border); border-radius:var(--radius-xl);
  box-shadow: var(--shadow-xs), inset 0 1px 0 rgba(255,255,255,0.8);
  overflow:hidden; display:flex; flex-direction:column;
  position: relative;
  transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.ens-teamcard--interactive{ cursor:pointer; }
.ens-teamcard--interactive:hover{
  border-color:var(--border-strong);
  box-shadow: var(--shadow-lg), 0 24px 48px -24px color-mix(in srgb, var(--accent) 25%, transparent), inset 0 1px 0 rgba(255,255,255,0.9);
  transform:translateY(-6px) scale(1.01);
}
.ens-teamcard--interactive:active { transform:translateY(-3px) scale(0.995); }
.ens-teamcard__bar{
  height:4px; background:var(--grad-duo);
  position: relative; overflow: hidden;
}
.ens-teamcard__bar::after {
  content: ''; position: absolute; top: 0; left: -100%; width: 50%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
  animation: shimmer 3s infinite;
}
.ens-teamcard__body{ padding:20px; display:flex; flex-direction:column; gap:14px; }
.ens-teamcard__head{ display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
.ens-teamcard__name{
  font-family:var(--font-display); font-size:18px; font-weight:600;
  letter-spacing:-0.012em; color:var(--text-primary);
}
.ens-teamcard__sub{
  font-size:13px; font-weight:500; color:var(--text-tertiary); margin-top:2px;
}
.ens-teamcard__desc{
  font-size:14px; line-height:1.6; color:var(--text-secondary); margin:0;
}
.ens-teamcard__members{ display:flex; align-items:center; gap:12px; }
.ens-teamcard__count{ font-size:13px; font-weight:500; color:var(--text-tertiary); }
.ens-teamcard__foot{
  display:flex; align-items:center; justify-content:space-between; gap:12px;
  border-top:1.5px solid var(--border); margin-top:4px; padding-top:16px;
}

/* ===== UTILITY ANIMATIONS ===== */
.animate-fade-in { animation: fadeIn 0.4s var(--ease-out) forwards; }
.animate-fade-in-up { animation: fadeInUp 0.4s var(--ease-out) forwards; }
.animate-scale-in { animation: scaleIn 0.3s var(--ease-out) forwards; }
.animate-slide-in-right { animation: slideInRight 0.4s var(--ease-out) forwards; }

/* Stagger animations for lists */
.stagger-1 { animation-delay: 0.05s; }
.stagger-2 { animation-delay: 0.1s; }
.stagger-3 { animation-delay: 0.15s; }
.stagger-4 { animation-delay: 0.2s; }
.stagger-5 { animation-delay: 0.25s; }
.stagger-6 { animation-delay: 0.3s; }

/* ===== SCROLLBAR STYLING (Fixed) ===== */
/* Hide default scrollbar but keep functionality */
.hide-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.hide-scrollbar::-webkit-scrollbar {
  display: none;
}

/* Custom styled scrollbar for chat areas */
.custom-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: var(--gray-300) transparent;
}
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
  margin: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--gray-300);
  border-radius: 99px;
  border: 2px solid transparent;
  background-clip: padding-box;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--gray-400);
}

/* ===== PAGE SCROLL FIX ===== */
html, body {
  overflow: hidden;
  height: 100%;
}
#root {
  height: 100vh;
  overflow: hidden;
}

/* Main content area that can scroll */
.main-scroll-area {
  overflow-y: auto;
  overflow-x: hidden;
  height: 100%;
  scrollbar-width: thin;
  scrollbar-color: var(--gray-300) transparent;
}
.main-scroll-area::-webkit-scrollbar {
  width: 8px;
}
.main-scroll-area::-webkit-scrollbar-track {
  background: transparent;
}
.main-scroll-area::-webkit-scrollbar-thumb {
  background: var(--gray-300);
  border-radius: 99px;
}
.main-scroll-area::-webkit-scrollbar-thumb:hover {
  background: var(--gray-400);
}

/* Chat thread scroll area - single scrollbar only */
.chat-scroll-area {
  overflow-y: auto;
  overflow-x: hidden;
  flex: 1;
  min-height: 0;
  scrollbar-width: thin;
  scrollbar-color: var(--gray-300) transparent;
}
.chat-scroll-area::-webkit-scrollbar {
  width: 6px;
}
.chat-scroll-area::-webkit-scrollbar-track {
  background: transparent;
  margin: 4px 0;
}
.chat-scroll-area::-webkit-scrollbar-thumb {
  background: var(--gray-300);
  border-radius: 99px;
}
.chat-scroll-area::-webkit-scrollbar-thumb:hover {
  background: var(--gray-400);
}

/* ===== ENHANCED TYPOGRAPHY ===== */
.text-gradient {
  background: var(--grad-brand);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.text-gradient-accent {
  background: var(--grad-accent);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.fw-light { font-weight: 300; }
.fw-regular { font-weight: 400; }
.fw-medium { font-weight: 500; }
.fw-semibold { font-weight: 600; }
.fw-bold { font-weight: 700; }

/* ===== GLOW EFFECTS ===== */
.glow-brand {
  box-shadow: 0 0 40px -10px color-mix(in srgb, var(--brand) 40%, transparent);
}
.glow-accent {
  box-shadow: 0 0 40px -10px color-mix(in srgb, var(--accent) 40%, transparent);
}

/* ===== HOVER LIFT EFFECT ===== */
.hover-lift {
  transition: transform 0.3s var(--ease-out), box-shadow 0.3s var(--ease-out);
}
.hover-lift:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}
`;
(function(){ if (typeof document !== 'undefined' && !document.getElementById('ens-kit-css')) {
  const s = document.createElement('style'); s.id = 'ens-kit-css'; s.textContent = KIT_CSS; document.head.appendChild(s);
}})();

const cx = (...a) => a.filter(Boolean).join(' ');

/* React-owned Lucide icon: renders into a leaf <span> via a ref so React never
   reconciles the swapped <i>→<svg> DOM (which otherwise corrupts sibling updates). */
function LucideIcon({ name, size, className='', style }){
  const ref = React.useRef(null);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !window.lucide) return;
    el.innerHTML = '';
    const i = document.createElement('i');
    i.setAttribute('data-lucide', name);
    const px = size || (style && style.width);
    if (px) { i.setAttribute('width', String(px)); i.setAttribute('height', String(px)); }
    el.appendChild(i);
    try { window.lucide.createIcons(); } catch(e){}
  }, [name, size]);
  return <span ref={ref} className={cx('luc', className)} style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', lineHeight:0, ...style }} />;
}
const Icon = (name, opts={}) => <LucideIcon name={name} size={opts.size} className={opts.className} style={opts.style} />;

function Button({ variant='primary', size='md', fullWidth, iconLeft, iconRight, as='button', className='', children, ...rest }){
  const Tag = as;
  return <Tag className={cx('ens-btn','ens-btn--'+size, variant!=='primary'&&'ens-btn--'+variant, fullWidth&&'ens-btn--full', className)} {...rest}>
    {iconLeft && <span className="ens-btn__icon">{iconLeft}</span>}{children}{iconRight && <span className="ens-btn__icon">{iconRight}</span>}</Tag>;
}
function IconButton({ variant='ghost', size='md', label, className='', children, ...rest }){
  return <button type="button" className={cx('ens-iconbtn','ens-iconbtn--'+size, variant!=='ghost'&&'ens-iconbtn--'+variant, className)} aria-label={label} title={label} {...rest}>{children}</button>;
}
function Input({ icon, className='', ...rest }){
  return <div className="ens-input-wrap">{icon && <span className="ens-input__icon">{icon}</span>}<input className={cx('ens-input', icon&&'ens-input--has-icon', className)} {...rest}/></div>;
}
function Badge({ variant='neutral', dot, icon, className='', children, ...rest }){
  return <span className={cx('ens-badge','ens-badge--'+variant, dot&&'ens-badge__dot--pulse', className)} {...rest}>{dot&&<span className="ens-badge__dot"/>}{icon||null}{children}</span>;
}
function Tag({ category, glyph, className='', children, ...rest }){
  return <span className={cx('ens-tag', category&&'ens-tag--'+category, className)} {...rest}>{glyph&&<span className="ens-tag__glyph">{glyph}</span>}{children}</span>;
}
const SLABEL = { idle:'Idle', running:'Running', success:'Done', error:'Failed', paused:'Paused' };
function StatusDot({ status='idle', label, showLabel=true, className='', ...rest }){
  return <span className={cx('ens-status','ens-status--'+status, className)} {...rest}><span className="ens-status__dot"/>{showLabel&&<span>{label||SLABEL[status]}</span>}</span>;
}
function initials(name=''){ return name.trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase(); }
function Avatar({ name, src, size='md', square, color, style, className='', children, ...rest }){
  const bg = color ? { background:color, color:'#fff', borderColor:'transparent' } : null;
  return <span className={cx('ens-avatar','ens-avatar--'+size, square&&'ens-avatar--square', className)} style={{...bg,...style}} title={name} {...rest}>
    {src ? <img src={src} alt={name||''}/> : (children||initials(name))}</span>;
}
function AvatarGroup({ className='', children, ...rest }){ return <span className={cx('ens-avatar-group',className)} {...rest}>{children}</span>; }
function Card({ interactive, selected, className='', children, ...rest }){
  return <div className={cx('ens-card', interactive&&'ens-card--interactive', selected&&'ens-card--selected', className)} {...rest}>{children}</div>;
}
function CardHeader({ title, action, className='', children, ...rest }){
  return <div className={cx('ens-card__header',className)} {...rest}>{title?<span className="ens-card__title">{title}</span>:children}{action||null}</div>;
}
function CardBody({ className='', children, ...rest }){ return <div className={cx('ens-card__body',className)} {...rest}>{children}</div>; }
function Tabs({ items=[], value, onChange, variant='pill', className='', ...rest }){
  return <div role="tablist" className={cx('ens-tabs','ens-tabs--'+variant, className)} {...rest}>{items.map((it, idx)=>{
    const item = typeof it==='string'?{value:it,label:it}:it; const sel=item.value===value;
    return <button key={item.value} role="tab" type="button" aria-selected={sel} className={cx('ens-tab', 'stagger-' + Math.min(idx + 1, 6))} style={{opacity:0, animation:'fadeInUp 0.3s ease forwards', animationDelay: (idx * 0.05) + 's'}} onClick={()=>onChange&&onChange(item.value)}>
      {item.icon||null}{item.label}{item.count!=null&&<span className="ens-tab__count">{item.count}</span>}</button>;
  })}</div>;
}
const CATL = { design:'Design', seo:'SEO', copy:'Copy', social:'Social', ads:'Ads', data:'Data' };
function AgentCard({ name, role, description, category='design', glyph, status, added, onAdd, interactive, className='', style, ...rest }){
  return <div className={cx('ens-agentcard', interactive&&'ens-agentcard--interactive', className)} data-category={category} style={{opacity:0, animation:'fadeInUp 0.5s var(--ease-out) forwards', ...style}} {...rest}>
    <div className="ens-agentcard__top">
      <span className="ens-agentcard__glyph" style={{background:`var(--cat-${category}-bg)`, color:`var(--cat-${category})`}}>{glyph}</span>
      <div style={{flex:1,minWidth:0}}><div className="ens-agentcard__name">{name}</div><div className="ens-agentcard__role">{role}</div></div>
      <Tag category={category}>{CATL[category]}</Tag>
    </div>
    {description && <p className="ens-agentcard__desc">{description}</p>}
    <div className="ens-agentcard__foot">
      {status ? <StatusDot status={status}/> : <span className="ens-agentcard__meta">Specialist agent</span>}
      {onAdd && <Button size="sm" variant={added?'secondary':'primary'} onClick={onAdd}>{added?'Added':'Add to team'}</Button>}
    </div></div>;
}
const MCOL = { design:'var(--cat-design)', seo:'var(--cat-seo)', copy:'var(--cat-copy)', social:'var(--cat-social)', ads:'var(--cat-ads)', data:'var(--cat-data)' };
function TeamCard({ name, description, members=[], status='idle', lastRun, deployed, onDeploy, interactive, className='', style, ...rest }){
  const shown = members.slice(0,4); const extra = members.length - shown.length;
  return <div className={cx('ens-teamcard', interactive&&'ens-teamcard--interactive', className)} style={{opacity:0, animation:'fadeInUp 0.5s var(--ease-out) forwards', ...style}} {...rest}>
    <div className="ens-teamcard__bar"/>
    <div className="ens-teamcard__body">
      <div className="ens-teamcard__head">
        <div><div className="ens-teamcard__name">{name}</div><div className="ens-teamcard__sub">{members.length} agents{lastRun?` · last run ${lastRun}`:''}</div></div>
        <StatusDot status={status}/>
      </div>
      {description && <p className="ens-teamcard__desc">{description}</p>}
      <div className="ens-teamcard__members">
        <AvatarGroup>{shown.map((m,i)=><Avatar key={i} name={m.name} size="sm" color={MCOL[m.category]||'var(--gray-500)'}/>)}{extra>0&&<Avatar size="sm">+{extra}</Avatar>}</AvatarGroup>
        <span className="ens-teamcard__count">{shown.map(m=>m.name).join(' · ')}{extra>0?` +${extra}`:''}</span>
      </div>
      <div className="ens-teamcard__foot">
        <span className="ens-teamcard__count" style={{fontFamily:'var(--font-mono)',fontSize:11, fontWeight:500}}>{deployed?'Deployed':'Ready to deploy'}</span>
        {onDeploy && <Button size="sm" variant={deployed?'secondary':'brand'} onClick={onDeploy}>{deployed?'Open team':'Deploy team'}</Button>}
      </div>
    </div></div>;
}

function useLucide(){ /* icons self-render via LucideIcon; no-op kept for API compatibility */ }

Object.assign(window, { EnsKit: { Button, IconButton, Input, Badge, Tag, StatusDot, Avatar, AvatarGroup, Card, CardHeader, CardBody, Tabs, AgentCard, TeamCard, Icon, useLucide } });
