/* Team workspace: channel list + coordinator chat (orchestrates member agents) + history */
const { Icon, Button, IconButton, Avatar, AvatarGroup, Badge, Tag, StatusDot } = window.EnsKit;
const TD = window.ConsoleData;

const STEP_MSG = {
  design:'Producing on-brand creatives', copy:'Drafting copy variants', seo:'Running a keyword + audit pass',
  social:'Scheduling posts to the calendar', ads:'Setting budgets and launching', data:'Pulling research and insights',
};
const nowTime = () => new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
let _mid = 1; const mid = () => 'm' + (_mid++);

function ChannelItem({ team, chat, active, onClick }){
  return (
    <button className="twchan" data-active={active ? '1' : '0'} onClick={onClick}
      style={active ? { background:'var(--gray-100)' } : undefined}>
      <span className="twchan__ic" style={{ background:'var(--ink)' }}>{Icon('users-round',{size:18})}</span>
      <div className="twchan__body">
        <div className="twchan__top"><span className="twchan__name">{team.name}</span><span className="twchan__time">{chat.time}</span></div>
        <div className="twchan__prev">{chat.preview}</div>
      </div>
      {chat.unread > 0 ? <span className="twchan__unread">{chat.unread}</span> : <StatusDot status={team.status} showLabel={false}/>}
    </button>
  );
}

function Msg({ m }){
  if (m.role === 'user') {
    return <div className="twmsg twmsg--user"><div className="twbubble twbubble--user">{m.text}</div></div>;
  }
  if (m.role === 'step') {
    return (
      <div className="twstep">
        <Avatar name={m.agent} size="sm" color={`var(--cat-${m.cat})`}/>
        <div className="twstep__body">
          <div className="twstep__name">{m.agent}</div>
          <div className="twstep__msg">{m.msg}</div>
        </div>
        {m.status === 'running' ? <StatusDot status="running" showLabel={false}/> : <Badge variant="success" dot>Done</Badge>}
      </div>
    );
  }
  // coordinator
  return (
    <div className="twmsg">
      <Avatar size="sm" square color="var(--ink)">{Icon('sparkles',{size:16})}</Avatar>
      <div className="twbubble">{m.text}</div>
    </div>
  );
}

function Composer({ coordinator, onSend }){
  const [draft,setDraft] = React.useState('');
  const submit = () => { const t = draft.trim(); if(!t) return; setDraft(''); onSend(t); };
  return (
    <div className="twcomposer">
      <div className="twcomposer__box">
        <input className="twcomposer__input" placeholder={`Message ${coordinator}, the coordinator...`}
          value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') submit(); }}/>
        <div className="twcomposer__actions">
          <IconButton label="Attach" variant="ghost" size="sm">{Icon('paperclip',{size:18})}</IconButton>
          <Button variant="brand" size="sm" onClick={submit} iconRight={Icon('arrow-up',{size:16})}>Send</Button>
        </div>
      </div>
      <div className="twcomposer__hint">{Icon('sparkles',{size:14})} The coordinator routes your request to the team's agents.</div>
    </div>
  );
}

function History({ chat }){
  return (
    <div className="twhistory">
      {chat.history.map((h,i)=>(
        <div className="twrun" key={i}>
          <span className="twrun__ic" data-s={h.status}>{Icon(h.status==='paused'?'pause':'check',{size:18})}</span>
          <div style={{flex:1,minWidth:0}}>
            <div className="twrun__name">{h.name}</div>
            <div className="twrun__stats">{h.stats}</div>
          </div>
          <span className="twrun__when">{h.when}</span>
          <IconButton label="Open run" variant="ghost" size="sm">{Icon('chevron-right',{size:18})}</IconButton>
        </div>
      ))}
    </div>
  );
}

function TeamWorkspace({ openTeam, setOpenTeam }){
  const teams = TD.teams;
  const tid = openTeam && teams.find(t=>t.id===openTeam) ? openTeam : teams[0].id;
  const team = teams.find(t=>t.id===tid);
  const chat = TD.teamChat[tid];
  const [tab,setTab] = React.useState('chat');
  const [threads,setThreads] = React.useState(() => {
    const o = {}; teams.forEach(t => { o[t.id] = (TD.teamChat[t.id].seed || []).map(s => ({ id:mid(), ...s })); }); return o;
  });
  const scroller = React.useRef(null);
  const messages = threads[tid];

  React.useEffect(() => { setTab('chat'); }, [tid]);
  React.useEffect(() => { const el = scroller.current; if (el && tab==='chat') el.scrollTop = el.scrollHeight; }, [messages, tab]);

  const append = (id, msg) => setThreads(p => ({ ...p, [id]: [...p[id], { id:mid(), ...msg }] }));
  const patch = (id, msgId, changes) => setThreads(p => ({ ...p, [id]: p[id].map(m => m.id===msgId ? { ...m, ...changes } : m) }));

  const send = (text) => {
    const id = tid;
    append(id, { role:'user', text });
    setTimeout(() => append(id, { role:'coordinator', text:"Got it - routing this to the team now." }), 500);
    const picks = team.members.slice(0, 3);
    let base = 1150;
    picks.forEach((m) => {
      const stepId = mid();
      setTimeout(() => setThreads(p => ({ ...p, [id]: [...p[id], { id:stepId, role:'step', agent:m.name, cat:m.category, msg:STEP_MSG[m.category] || 'Working...', status:'running', t:nowTime() }] })), base);
      setTimeout(() => patch(id, stepId, { status:'success' }), base + 850);
      base += 1050;
    });
    setTimeout(() => append(id, { role:'coordinator', text:`Done - ${picks.length} agents finished and I've logged this run in History.` }), base + 400);
  };

  return (
    <div className="twspace">
      <div className="twchannels">
        <div className="twchannels__head">
          <span style={{fontWeight: 600}}>Teams</span>
          <IconButton label="New team" variant="ghost" size="sm">{Icon('plus',{size:18})}</IconButton>
        </div>
        <div className="twchannels__list">
          {teams.map(t => (
            <ChannelItem key={t.id} team={t} chat={TD.teamChat[t.id]} active={t.id===tid} onClick={()=>setOpenTeam(t.id)}/>
          ))}
        </div>
      </div>

      <div className="twconv">
        <div className="twconv__head">
          <span className="twconv__mark">{Icon('users-round',{size:20})}</span>
          <div style={{flex:1,minWidth:0}}>
            <div className="twconv__name">{team.name}</div>
            <div className="twconv__sub">Coordinated by {chat.coordinator} · {team.members.length} agents</div>
          </div>
          <AvatarGroup>
            {team.members.slice(0,4).map((m,i)=><Avatar key={i} name={m.name} size="sm" color={`var(--cat-${m.category})`}/>)}
          </AvatarGroup>
          <StatusDot status={team.status}/>
          <IconButton label="Team settings" variant="solid" size="md">{Icon('settings',{size:18})}</IconButton>
        </div>

        <div className="twconv__tabs">
          <button className="twtab" data-active={tab==='chat'} onClick={()=>setTab('chat')}>{Icon('messages-square',{size:16})} Conversation</button>
          <button className="twtab" data-active={tab==='history'} onClick={()=>setTab('history')}>{Icon('history',{size:16})} History <span className="twtab__c">{chat.history.length}</span></button>
        </div>

        {tab==='chat' ? (
          <React.Fragment>
            <div className="twthread" ref={scroller}>
              <div className="twthread__day">Today</div>
              {messages.map(m => <Msg key={m.id} m={m}/>)}
            </div>
            <Composer coordinator={chat.coordinator} onSend={send}/>
          </React.Fragment>
        ) : (
          <div className="twthread" ref={scroller}><History chat={chat}/></div>
        )}
      </div>
    </div>
  );
}

window.ConsoleTeamspace = { TeamWorkspace };
