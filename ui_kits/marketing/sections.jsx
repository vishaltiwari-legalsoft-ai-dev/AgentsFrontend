/* Marketing landing page sections */
const { Icon, Button, Badge, Tag, AgentCard, TeamCard, Avatar, AvatarGroup, StatusDot } = window.EnsKit;
const D = window.ConsoleData;

function Nav(){
  return (
    <header className="mnav">
      <div className="mnav__in">
        <a className="mnav__logo" href="#">
          <svg width="30" height="30" viewBox="0 0 40 40" fill="none"><defs><linearGradient id="mlnav" x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse"><stop stopColor="#5F9DF7"/><stop offset="1" stopColor="#1746A2"/></linearGradient></defs><rect x="2" y="2" width="36" height="36" rx="9" fill="url(#mlnav)"/><rect x="11" y="22" width="4.5" height="7" rx="1.2" fill="#fff" opacity="0.55"/><rect x="17.75" y="18" width="4.5" height="11" rx="1.2" fill="#fff" opacity="0.78"/><rect x="24.5" y="14" width="4.5" height="15" rx="1.2" fill="#fff"/><path d="M11 19.5 L18 15 L23 17.5 L30.5 11" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/><path d="M27 10.4 L31 10 L30.6 14 Z" fill="#fff"/></svg>
          <span>Legal<em style={{fontStyle:'normal',color:'var(--accent)'}}>Soft</em></span>
        </a>
        <nav className="mnav__links">
          <a href="#agents">Agents</a><a href="#teams">Teams</a><a href="#how">How it works</a><a href="#pricing">Pricing</a>
        </nav>
        <div className="mnav__cta">
          <Button variant="ghost" size="sm" as="a" href="#">Sign in</Button>
          <Button variant="gradient" size="sm" as="a" href="#" iconRight={Icon('arrow-right',{size:15})}>Get started</Button>
        </div>
      </div>
    </header>
  );
}

function Hero(){
  return (
    <section className="mhero">
      <div className="mhero__copy">
        <span className="mbadge"><span className="mbadge__dot"/>New · Teams that run themselves</span>
        <h1>Hire AI specialists.<br/>Or deploy a whole <em>team</em>.</h1>
        <p>LegalSoft gives your marketing team specialist AI agents for single tasks — and lets you
          combine them into teams that plan, create, and ship campaigns end to end.</p>
        <div className="mhero__actions">
          <Button variant="gradient" size="lg" as="a" href="#" iconRight={Icon('arrow-right',{size:17})}>Start free</Button>
          <Button variant="secondary" size="lg" as="a" href="#" iconLeft={Icon('play',{size:16})}>Watch demo</Button>
        </div>
        <div className="mhero__trust">
          <AvatarGroup>
            <Avatar name="A" size="sm" color="var(--cat-design)"/><Avatar name="B" size="sm" color="var(--cat-copy)"/>
            <Avatar name="C" size="sm" color="var(--cat-social)"/><Avatar name="D" size="sm" color="var(--cat-ads)"/>
          </AvatarGroup>
          <span>Trusted by 4,000+ marketing teams</span>
        </div>
      </div>
      <div className="mhero__art">
        <TeamCard {...D.teams[0]} />
        <div className="mhero__floats">
          <AgentCard name="Copywriter" role="Words that convert" category="copy" glyph={Icon('pen-line')} status="success" />
          <AgentCard name="Ads Optimizer" role="Paid performance" category="ads" glyph={Icon('target')} status="running" />
        </div>
      </div>
    </section>
  );
}

function Logos(){
  const names = ['Northwind','Lumen','Forge','Acre','Vela','Cobalt'];
  return (
    <section className="mlogos">
      <span>Powering campaigns at</span>
      <div className="mlogos__row">{names.map(n => <span key={n} className="mlogo">{n}</span>)}</div>
    </section>
  );
}

function Split(){
  return (
    <section className="msplit" id="agents">
      <div className="msplit__col">
        <span className="meyebrow" style={{color:'var(--cat-ads)'}}>{Icon('bot',{size:15})} AI Agents</span>
        <h2>One specialist.<br/>One job. Done well.</h2>
        <p>Each agent owns a niche — design, SEO, copy, social, paid, research. Brief it, and it
          delivers like a dedicated hire.</p>
        <ul className="mlist">
          <li>{Icon('check',{size:16})} Purpose-built for a single skill</li>
          <li>{Icon('check',{size:16})} Works from a short brief</li>
          <li>{Icon('check',{size:16})} Plug into any team</li>
        </ul>
      </div>
      <div className="msplit__col" id="teams">
        <span className="meyebrow" style={{color:'var(--cat-social)'}}>{Icon('users-round',{size:15})} AI Teams</span>
        <h2>Many specialists.<br/>Coordinated. Automatic.</h2>
        <p>Teams combine agents into a workflow — a Campaign Manager or Outbound Reach crew that
          routes work between members and reports back as one.</p>
        <ul className="mlist">
          <li>{Icon('check',{size:16})} Pre-built for common goals</li>
          <li>{Icon('check',{size:16})} Agents hand off work to each other</li>
          <li>{Icon('check',{size:16})} Deploy in one click</li>
        </ul>
      </div>
    </section>
  );
}

function AgentGrid(){
  return (
    <section className="msection" id="how">
      <div className="msection__head">
        <h2>Meet the specialists</h2>
        <p>Start with one agent, or assemble a team. Add more as you grow.</p>
      </div>
      <div className="magrid">
        {D.agents.slice(0,6).map(a => <AgentCard key={a.id} {...a} glyph={Icon(a.glyph)} interactive />)}
      </div>
    </section>
  );
}

function HowItWorks(){
  const steps = [
    { ic:'mouse-pointer-click', t:'Pick agents or a team', d:'Browse specialists or deploy a ready-made team.' },
    { ic:'pencil-ruler', t:'Set the goal', d:'Describe what you want. No prompts to engineer.' },
    { ic:'rocket', t:'It runs itself', d:'Work routes between agents and reports back to you.' },
  ];
  return (
    <section className="mhow">
      <div className="msection__head"><h2>Out of the box in minutes</h2></div>
      <div className="mhow__row">
        {steps.map((s,i)=>(
          <div className="mstep" key={i}>
            <span className="mstep__n">{i+1}</span>
            <span className="mstep__ic">{Icon(s.ic,{size:22})}</span>
            <h3>{s.t}</h3><p>{s.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function CTA(){
  return (
    <section className="mcta" id="pricing">
      <h2>Put your marketing on autopilot.</h2>
      <p>Free to start. Deploy your first team today.</p>
      <div className="mcta__actions">
        <Button variant="gradient" size="lg" as="a" href="#" iconRight={Icon('arrow-right',{size:17})}>Get started free</Button>
        <Button variant="secondary" size="lg" as="a" href="#">Talk to sales</Button>
      </div>
    </section>
  );
}

function Footer(){
  return (
    <footer className="mfooter">
      <div className="mfooter__in">
        <div className="mfooter__brand">
          <svg width="26" height="26" viewBox="0 0 40 40" fill="none"><rect x="2" y="2" width="36" height="36" rx="9" fill="#1746A2"/><rect x="11" y="22" width="4.5" height="7" rx="1.2" fill="#fff" opacity="0.55"/><rect x="17.75" y="18" width="4.5" height="11" rx="1.2" fill="#fff" opacity="0.78"/><rect x="24.5" y="14" width="4.5" height="15" rx="1.2" fill="#fff"/><path d="M11 19.5 L18 15 L23 17.5 L30.5 11" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
          <span>Legal<em style={{fontStyle:'normal',color:'var(--accent)'}}>Soft</em></span>
        </div>
        <span className="mfooter__copy">© 2026 LegalSoft. AI specialists and teams for your marketing.</span>
      </div>
    </footer>
  );
}

function Landing(){
  return (
    <div className="mpage">
      <Nav/><Hero/><Logos/><Split/><AgentGrid/><HowItWorks/><CTA/><Footer/>
    </div>
  );
}
window.MarketingLanding = Landing;
