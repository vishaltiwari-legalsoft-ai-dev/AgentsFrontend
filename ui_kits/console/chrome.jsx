/* Console chrome: Sidebar + Topbar */
const { Icon, IconButton, Button, Avatar, Input, Badge } = window.EnsKit;

const NAV = [
  { id:'home', label:'Home', icon:'layout-dashboard' },
  { id:'agents', label:'Agents', icon:'bot' },
  { id:'teams', label:'Teams', icon:'users-round' },
  { id:'activity', label:'Activity', icon:'activity' },
];
const NAV2 = [
  { id:'library', label:'Library', icon:'shapes' },
  { id:'integrations', label:'Integrations', icon:'plug' },
  { id:'settings', label:'Settings', icon:'settings' },
];

function Logo(){
  return (
    <div style={{display:'flex',alignItems:'center',gap:10}}>
      <svg width="30" height="30" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs><linearGradient id="lsnav" x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse"><stop stopColor="#5F9DF7"/><stop offset="1" stopColor="#1746A2"/></linearGradient></defs>
        <rect x="2" y="2" width="36" height="36" rx="9" fill="url(#lsnav)"/>
        <rect x="11" y="22" width="4.5" height="7" rx="1.2" fill="#fff" opacity="0.55"/>
        <rect x="17.75" y="18" width="4.5" height="11" rx="1.2" fill="#fff" opacity="0.78"/>
        <rect x="24.5" y="14" width="4.5" height="15" rx="1.2" fill="#fff"/>
        <path d="M11 19.5 L18 15 L23 17.5 L30.5 11" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <path d="M27 10.4 L31 10 L30.6 14 Z" fill="#fff"/>
      </svg>
      <span style={{fontFamily:'var(--font-display)',fontWeight:800,fontSize:18,letterSpacing:'-0.01em',color:'var(--blue-700)'}}>Legal<span style={{color:'var(--accent)'}}>Soft</span></span>
    </div>
  );
}

function NavItem({ item, active, onClick }){
  return (
    <button
      className="cnav"
      onClick={onClick}
      style={active ? { background:'var(--gray-100)', color:'var(--text-primary)', fontWeight:600 } : undefined}
    >
      {Icon(item.icon)}
      <span>{item.label}</span>
    </button>
  );
}

function Sidebar({ nav, setNav }){
  return (
    <aside className="csidebar">
      <div style={{padding:'18px 16px 8px'}}><Logo/></div>
      <div className="cworkspace">
        <Avatar name="Northwind Co" size="sm" square color="var(--cat-ads)"/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>Northwind Co</div>
          <div style={{fontSize:11,color:'var(--text-tertiary)'}}>Marketing workspace</div>
        </div>
        {Icon('chevrons-up-down',{style:{width:15,height:15,color:'var(--text-tertiary)'}})}
      </div>
      <nav className="cnavlist">
        {NAV.map(it => <NavItem key={it.id} item={it} active={nav===it.id} onClick={()=>setNav(it.id)}/>)}
        <div className="cnavdiv"/>
        {NAV2.map(it => <NavItem key={it.id} item={it} active={nav===it.id} onClick={()=>setNav(it.id)}/>)}
      </nav>
      <div className="cupgrade">
        <div style={{fontSize:12.5,fontWeight:600,marginBottom:2}}>Pro trial · 6 days left</div>
        <div style={{fontSize:11.5,color:'var(--text-tertiary)',marginBottom:10,lineHeight:1.4}}>Unlimited agents and teams.</div>
        <Button size="sm" variant="accent" fullWidth>Upgrade plan</Button>
      </div>
      <div className="cuser">
        <Avatar name="Mara Okafor" size="sm" color="var(--cat-social)"/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:600}}>Mara Okafor</div>
          <div style={{fontSize:11,color:'var(--text-tertiary)'}}>mara@northwind.co</div>
        </div>
        <IconButton label="Account" size="sm">{Icon('ellipsis')}</IconButton>
      </div>
    </aside>
  );
}

function Topbar({ title, subtitle, onNew, newLabel='New agent' }){
  return (
    <header className="ctopbar">
      <div>
        <div style={{fontFamily:'var(--font-display)',fontSize:20,fontWeight:600,letterSpacing:'-0.018em'}}>{title}</div>
        {subtitle && <div style={{fontSize:12.5,color:'var(--text-tertiary)',marginTop:1}}>{subtitle}</div>}
      </div>
      <div style={{flex:1,maxWidth:360,margin:'0 24px'}}>
        <Input icon={Icon('search')} placeholder="Search agents, teams, runs…"/>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:8}}>
        <IconButton label="Help" variant="ghost">{Icon('life-buoy')}</IconButton>
        <div style={{position:'relative'}}>
          <IconButton label="Notifications" variant="ghost">{Icon('bell')}</IconButton>
          <span style={{position:'absolute',top:6,right:7,width:7,height:7,borderRadius:99,background:'var(--brand)',boxShadow:'0 0 0 2px var(--surface)'}}/>
        </div>
        <Button variant="primary" iconLeft={Icon('plus')} onClick={onNew}>{newLabel}</Button>
      </div>
    </header>
  );
}

window.ConsoleChrome = { Sidebar, Topbar, Logo };
