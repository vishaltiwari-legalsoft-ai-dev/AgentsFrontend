/* Console app orchestrator */
const { Sidebar, Topbar } = window.ConsoleChrome;
const { HomeView, AgentsView, TeamsView, ActivityView, PlaceholderView } = window.ConsoleViews;
const { TeamWorkspace } = window.ConsoleTeamspace;
const { Icon, useLucide } = window.EnsKit;

const TITLES = {
  home: { title:'Home', subtitle:'Your marketing workspace at a glance', newLabel:'New agent' },
  agents: { title:'Agents', subtitle:'Specialist AI workers for single tasks', newLabel:'New agent' },
  teams: { title:'Teams', subtitle:'Workflows assembled from agents', newLabel:'Build team' },
  activity: { title:'Activity', subtitle:'Live and recent runs', newLabel:'New run' },
};

function Toast({ toast }){
  if(!toast) return null;
  return (
    <div className="ctoast" key={toast.k}>
      <span className="ctoast__ic">{Icon('check')}</span>
      <span>{toast.msg}</span>
    </div>
  );
}

function App(){
  useLucide();
  const [nav,setNav] = React.useState('home');
  const [mode,setMode] = React.useState('teams');
  const [openTeam,setOpenTeam] = React.useState('t1');
  const [added,setAdded] = React.useState({});
  const [toast,setToast] = React.useState(null);

  const fire = (msg) => { setToast({ msg, k:Date.now() }); setTimeout(()=>setToast(null), 2600); };
  const onAdd = (id) => { setAdded(p=>({...p,[id]:!p[id]})); fire(added[id]?'Removed from team':'Added to team'); };
  const onDeploy = (t) => { setOpenTeam(t.id); setNav('teams'); fire(t.deployed ? `Opened ${t.name}` : `${t.name} is live. Message the coordinator below.`); };
  const onNew = () => fire(nav==='teams' ? 'Team builder opened' : 'New agent dialog opened');

  const meta = TITLES[nav] || { title:nav, subtitle:'' };

  return (
    <div className="capp">
      <Sidebar key={nav} nav={nav} setNav={setNav}/>
      <div className="cmain">
        <Topbar {...meta} onNew={onNew}/>
        <div className="cscroll">
          {nav==='home' && <HomeView mode={mode} setMode={setMode} onOpenAgents={()=>setNav('agents')} onDeploy={onDeploy} onAdd={onAdd} added={added}/>}
          {nav==='agents' && <AgentsView added={added} onAdd={onAdd}/>}
          {nav==='teams' && <TeamWorkspace openTeam={openTeam} setOpenTeam={setOpenTeam}/>}
          {nav==='activity' && <ActivityView/>}
          {['library','integrations','settings'].includes(nav) && <PlaceholderView title={meta.title}/>}
        </div>
      </div>
      <Toast toast={toast}/>
    </div>
  );
}

window.ConsoleApp = App;
