/* Console views: Home (agents/teams layouts), Agents, Teams, Activity */
const { Icon, Button, IconButton, Avatar, AvatarGroup, Badge, Tag, StatusDot, Tabs, AgentCard, TeamCard, Card, Input, useLucide } = window.EnsKit;
const D = window.ConsoleData;

function Stat({ icon, label, value, delta, tint }){
  return (
    <div className="cstat" style={{animation: 'fadeInUp 0.4s ease forwards'}}>
      <span className="cstat__ic" style={{background:tint+'-bg'?`var(--cat-${tint}-bg)`:'var(--gray-100)',color:`var(--cat-${tint})`}}>{Icon(icon, {size: 20})}</span>
      <div>
        <div className="cstat__val">{value}</div>
        <div className="cstat__lbl">{label}</div>
      </div>
      {delta && <span className="cstat__delta">{delta}</span>}
    </div>
  );
}

function StatRow(){
  return (
    <div className="cstatrow">
      <Stat icon="bot" label="Active agents" value="8" tint="ads" delta="+2"/>
      <Stat icon="users-round" label="Active teams" value="4" tint="social" delta="+1"/>
      <Stat icon="zap" label="Runs today" value="37" tint="seo"/>
      <Stat icon="clock" label="Hours saved" value="124" tint="copy" delta="this week"/>
    </div>
  );
}

function HomeView({ mode, setMode, onOpenAgents, onDeploy, onAdd, added }){
  useLucide();
  return (
    <div className="cview">
      <div className="cgreet">
        <div>
          <div className="cgreet-title">Good morning, Mara</div>
          <div className="cgreet-subtitle">Your Campaign Manager is running. Two teams are ready to deploy.</div>
        </div>
        <Tabs variant="pill" value={mode} onChange={setMode} items={[
          { value:'agents', label:'Agents', icon:Icon('bot', {size: 16}) },
          { value:'teams', label:'Teams', icon:Icon('users-round', {size: 16}) },
        ]}/>
      </div>

      <StatRow/>

      {mode==='agents' ? (
        <section>
          <div className="csechead">
            <h3>Your specialists</h3>
            <Button variant="ghost" size="sm" iconRight={Icon('arrow-right', {size: 16})} onClick={onOpenAgents}>Browse all agents</Button>
          </div>
          <div className="cgrid cgrid--3">
            {D.agents.slice(0,6).map((a, idx) => (
              <div key={a.id} style={{opacity: 0, animation: `fadeInUp 0.5s ease ${idx * 0.1}s forwards`}}>
                <AgentCard {...a} glyph={Icon(a.glyph, {size: 24})} interactive added={!!added[a.id]} onAdd={()=>onAdd(a.id)}/>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <div className="chome-teams">
          <section>
            <div className="csechead"><h3>Active teams</h3><Button variant="ghost" size="sm" iconRight={Icon('arrow-right', {size: 16})}>Manage</Button></div>
            <div className="cgrid cgrid--2">
              {D.teams.map((t, idx) => (
                <div key={t.id} style={{opacity: 0, animation: `fadeInUp 0.5s ease ${idx * 0.1}s forwards`}}>
                  <TeamCard {...t} interactive onDeploy={()=>onDeploy(t)}/>
                </div>
              ))}
            </div>
          </section>
          <aside className="cactivity-mini">
            <div className="csechead"><h3>Live now</h3><StatusDot status="running"/></div>
            <RunMini/>
          </aside>
        </div>
      )}
    </div>
  );
}

function RunMini(){
  return (
    <div className="crunmini">
      {D.runSteps.slice(0,4).map((s,i)=>{
        const statusIcon = s.status==='running' ? <StatusDot status="running" showLabel={false}/> :
          s.status==='success' ? Icon('check', {style:{width:18,height:18,color:'var(--success)'}}) :
          Icon('circle-dashed',{style:{width:18,height:18,color:'var(--gray-300)'}});
        return (
          <div className="crunmini__row" key={i} style={{opacity: 0, animation: `fadeInUp 0.3s ease ${i * 0.08}s forwards`}}>
            <Avatar name={s.agent} size="xs" color={`var(--cat-${s.cat})`}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{s.agent}</div>
              <div style={{fontSize:12,fontWeight:400,color:'var(--text-tertiary)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{s.msg}</div>
            </div>
            {statusIcon}
          </div>
        );
      })}
    </div>
  );
}

const CATS = [
  { value:'all', label:'All' },{ value:'design', label:'Design' },{ value:'seo', label:'SEO' },
  { value:'copy', label:'Copy' },{ value:'social', label:'Social' },{ value:'ads', label:'Ads' },{ value:'data', label:'Data' },
];
function AgentsView({ added, onAdd }){
  useLucide();
  const [cat,setCat] = React.useState('all');
  const list = cat==='all' ? D.agents : D.agents.filter(a=>a.category===cat);
  return (
    <div className="cview">
      <div className="cfilterbar">
        <Tabs variant="line" value={cat} onChange={setCat} items={CATS}/>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <IconButton label="Grid view" variant="solid" size="sm">{Icon('layout-grid', {size: 18})}</IconButton>
          <IconButton label="List view" variant="ghost" size="sm">{Icon('list', {size: 18})}</IconButton>
        </div>
      </div>
      <div className="cgrid cgrid--3">
        {list.map((a, idx) => (
          <div key={a.id} style={{opacity: 0, animation: `fadeInUp 0.4s ease ${idx * 0.05}s forwards`}}>
            <AgentCard {...a} glyph={Icon(a.glyph, {size: 24})} interactive added={!!added[a.id]} onAdd={()=>onAdd(a.id)}/>
          </div>
        ))}
        <div className="caddcard" style={{opacity: 0, animation: `fadeInUp 0.5s ease ${list.length * 0.05}s forwards`}}>
          <span className="caddcard__ic">{Icon('sparkles', {size: 22})}</span>
          <div style={{fontWeight:600,fontSize:15,color: 'var(--text-primary)'}}>Need something else?</div>
          <div style={{fontSize:13,color:'var(--text-tertiary)',textAlign:'center',marginBottom:12}}>Describe a task and we'll spin up a custom agent.</div>
          <Button variant="secondary" size="sm" iconLeft={Icon('wand-sparkles', {size: 16})}>Create custom agent</Button>
        </div>
      </div>
    </div>
  );
}

function TeamsView({ onDeploy }){
  useLucide();
  return (
    <div className="cview">
      <div className="cgrid cgrid--2">
        {D.teams.map((t, idx) => (
          <div key={t.id} style={{opacity: 0, animation: `fadeInUp 0.4s ease ${idx * 0.08}s forwards`}}>
            <TeamCard {...t} interactive onDeploy={()=>onDeploy(t)}/>
          </div>
        ))}
        <button className="cbuildcard" style={{opacity: 0, animation: `fadeInUp 0.5s ease ${D.teams.length * 0.08}s forwards`}}>
          <span className="cbuildcard__ic">{Icon('plus', {size: 22})}</span>
          <div style={{fontFamily:'var(--font-display)',fontWeight:600,fontSize:17,color: 'var(--text-primary)'}}>Build a team</div>
          <div style={{fontSize:14,color:'var(--text-tertiary)',textAlign:'center',maxWidth:240}}>Combine specialist agents into a workflow that runs itself.</div>
        </button>
      </div>
    </div>
  );
}

function ActivityView(){
  useLucide();
  const team = D.teams[0];
  return (
    <div className="cview">
      <div className="crundetail">
        <div className="crun-main">
          <div className="crun-head">
            <div style={{display:'flex',alignItems:'center',gap:14}}>
              <span className="crun-mark">{Icon('users-round', {size: 22})}</span>
              <div>
                <div style={{fontFamily:'var(--font-display)',fontSize:19,fontWeight:600,color: 'var(--text-primary)'}}>{team.name}</div>
                <div style={{fontSize:13,color:'var(--text-tertiary)',fontFamily:'var(--font-mono)',fontWeight:500}}>run #4812 · started 14:02:31</div>
              </div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <StatusDot status="running"/>
              <Button variant="secondary" size="sm" iconLeft={Icon('pause', {size: 16})}>Pause</Button>
              <IconButton label="More" variant="solid" size="sm">{Icon('ellipsis', {size: 18})}</IconButton>
            </div>
          </div>
          <div className="ctimeline">
            {D.runSteps.map((s,i)=>(
              <div className="cstep" key={i} data-status={s.status} style={{opacity: 0, animation: `fadeInUp 0.3s ease ${i * 0.1}s forwards`}}>
                <div className="cstep__rail"><span className="cstep__node"/></div>
                <div className="cstep__card">
                  <div style={{display:'flex',alignItems:'center',gap:11}}>
                    <Avatar name={s.agent} size="sm" color={`var(--cat-${s.cat})`}/>
                    <div style={{flex:1}}>
                      <div style={{fontSize:14.5,fontWeight:600,color: 'var(--text-primary)'}}>{s.agent}</div>
                      <div style={{fontSize:13,color:'var(--text-secondary)',fontWeight:400}}>{s.msg}</div>
                    </div>
                    <span style={{fontFamily:'var(--font-mono)',fontSize:12,color:'var(--text-tertiary)',fontWeight:500}}>{s.t}</span>
                    {s.status==='success' && <Badge variant="success" dot>Done</Badge>}
                    {s.status==='running' && <Badge variant="brand" dot>Running</Badge>}
                    {s.status==='idle' && <Badge variant="outline">Queued</Badge>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <aside className="crun-side">
          <div className="csechead"><h3>Summary</h3></div>
          <div className="crun-stats">
            <div><div className="crun-stat__v">12</div><div className="crun-stat__l">posts drafted</div></div>
            <div><div className="crun-stat__v">6</div><div className="crun-stat__l">creatives</div></div>
            <div><div className="crun-stat__v">4m 17s</div><div className="crun-stat__l">elapsed</div></div>
            <div><div className="crun-stat__v">$0.42</div><div className="crun-stat__l">est. cost</div></div>
          </div>
          <div className="csechead" style={{marginTop:22}}><h3>Members</h3></div>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {team.members.map((m,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:11,opacity: 0, animation: `fadeInUp 0.3s ease ${i * 0.08}s forwards`}}>
                <Avatar name={m.name} size="xs" color={`var(--cat-${m.category})`}/>
                <span style={{fontSize:14,fontWeight:500,color: 'var(--text-primary)'}}>{m.name}</span>
                <Tag category={m.category} style={{marginLeft:'auto'}}>{m.category.toUpperCase()}</Tag>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

function PlaceholderView({ title }){
  return <div className="cview"><div className="cplaceholder">{Icon('shapes',{style:{width:36,height:36,color:'var(--gray-300)'}})}<div style={{fontWeight:600,fontSize:16,marginTop:12,color: 'var(--text-primary)'}}>{title}</div><div style={{fontSize:14,color:'var(--text-tertiary)',fontWeight: 400}}>This area is part of the kit's navigation shell.</div></div></div>;
}

window.ConsoleViews = { HomeView, AgentsView, TeamsView, ActivityView, PlaceholderView };
