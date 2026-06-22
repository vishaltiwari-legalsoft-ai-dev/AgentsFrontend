"use client";

import { useEffect, useState } from "react";
import { agents, teams, runSteps, isAgentLive } from "@/lib/console-data";
import { Icon, Button, IconButton, Avatar, Badge, StatusDot, Tabs, AgentCard, TeamCard } from "@/lib/kit-ui";
import { GlyphTile, CATEGORY_GLYPH } from "@/lib/glyph";
import { getUsage, type UsageResponse, type UsageUser } from "@/lib/api";
import { useAuth } from "@/lib/auth";

function Stat({ icon, iso, label, value, delta, tint }: { icon: string; iso?: string; label: string; value: string; delta?: string; tint: string }) {
  return (
    <div className="cstat">
      {iso ? (
        <GlyphTile glyph={iso} tint={tint} size={40} glyphSize={21} />
      ) : (
        <span className="cstat__ic" style={{ background: `var(--cat-${tint}-bg)`, color: `var(--cat-${tint})` }}>
          <Icon name={icon} />
        </span>
      )}
      <div>
        <div className="cstat__val">{value}</div>
        <div className="cstat__lbl">{label}</div>
      </div>
      {delta ? <span className="cstat__delta">{delta}</span> : null}
    </div>
  );
}

function StatRow({ convCount }: { convCount: number }) {
  return (
    <div className="cstatrow">
      <Stat icon="bot" iso="rocket" label="Active agents" value="1" tint="ads" />
      <Stat icon="users-round" iso="teams" label="Active teams" value="0" tint="social" />
      <Stat icon="zap" iso="bolt" label="Runs today" value={String(convCount || 0)} tint="seo" />
      <Stat icon="clock" iso="clock" label="Hours saved" value="124" tint="copy" delta="this week" />
    </div>
  );
}

function RunMini() {
  return (
    <div className="crunmini">
      {runSteps.slice(0, 4).map((s, i) => (
        <div className="crunmini__row" key={i}>
          <Avatar name={s.agent} size="xs" color={`var(--cat-${s.cat})`} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {s.agent}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {s.msg}
            </div>
          </div>
          {s.status === "running" ? (
            <StatusDot status="running" showLabel={false} />
          ) : s.status === "success" ? (
            <Icon name="check" style={{ width: 15, height: 15, color: "var(--success)" }} />
          ) : (
            <Icon name="circle-dashed" style={{ width: 15, height: 15, color: "var(--gray-300)" }} />
          )}
        </div>
      ))}
    </div>
  );
}

const WINDOWS = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
];

/** Per-agent usage tile: the headline number is sessions/runs (the chosen
 *  "one use" unit); creatives produced is the secondary line. */
function AgentUsageTile({ agent }: { agent: UsageResponse["per_agent"][number] }) {
  return (
    <div className="cusagetile" data-live={agent.live ? "1" : "0"}>
      <GlyphTile glyph={CATEGORY_GLYPH[agent.category] ?? "design"} tint={agent.category} size={40} glyphSize={21} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="cusagetile__name" title={agent.name}>{agent.name}</div>
        <div className="cusagetile__sub">{agent.creatives} creative{agent.creatives === 1 ? "" : "s"}</div>
      </div>
      <div className="cusagetile__num">
        <div className="cusagetile__val">{agent.sessions}</div>
        <div className="cusagetile__lbl">{agent.live ? "runs" : "soon"}</div>
      </div>
    </div>
  );
}

/** One ranked row in the leaderboard. Top three ranks get a subtle medal tint. */
function LeaderRow({ rank, u, metric }: { rank: number; u: UsageUser; metric: "creatives" | "sessions" }) {
  const value = metric === "creatives" ? u.creatives : u.sessions;
  return (
    <div className="clbrow">
      <div className="clbrow__rank" data-top={rank <= 3 ? rank : undefined}>{rank}</div>
      <Avatar name={u.name} src={u.picture || undefined} size="sm" />
      <div className="clbrow__id">
        <div className="clbrow__name" title={u.name}>{u.name}</div>
        <div className="clbrow__sub">
          {u.agents_used} agent{u.agents_used === 1 ? "" : "s"} used
        </div>
      </div>
      <div className="clbrow__num">
        <div className="clbrow__val">{value}</div>
        <div className="clbrow__lbl">{metric === "creatives" ? "creatives" : "runs"}</div>
      </div>
    </div>
  );
}

/** Live, self-refreshing ranking of who has used the agents the most. */
function Leaderboard({
  data,
  metric,
  setMetric,
}: {
  data: UsageResponse | null;
  metric: "creatives" | "sessions";
  setMetric: (m: "creatives" | "sessions") => void;
}) {
  const board = [...(data?.per_user ?? [])].sort((a, b) =>
    metric === "creatives" ? b.creatives - a.creatives : b.sessions - a.sessions
  );
  return (
    <section className="ccard">
      <div className="csechead" style={{ marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h3>Leaderboard</h3>
          <span className="clblive">
            <span className="clblive__dot" />
            Live
          </span>
        </div>
        <Tabs
          variant="pill"
          value={metric}
          onChange={(v) => setMetric(v as "creatives" | "sessions")}
          items={[
            { value: "sessions", label: "Runs" },
            { value: "creatives", label: "Creatives" },
          ]}
        />
      </div>
      {data ? (
        board.length ? (
          <div className="clbboard">
            {board.map((u, i) => (
              <LeaderRow key={u.user_id} rank={i + 1} u={u} metric={metric} />
            ))}
          </div>
        ) : (
          <div className="clbempty">No activity yet — runs will appear here as agents are used.</div>
        )
      ) : (
        <div className="clbempty">Loading…</div>
      )}
    </section>
  );
}

const USAGE_POLL_MS = 10_000; // keep the leaderboard "live" without a refresh

function UsageDashboard({ userIsCreator }: { userIsCreator: boolean }) {
  const [days, setDays] = useState("30");
  const [scope, setScope] = useState<"me" | "all">("me");
  const [metric, setMetric] = useState<"creatives" | "sessions">("sessions");
  const [data, setData] = useState<UsageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null); // show the loading state while the window/scope changes
    const load = (initial: boolean) => {
      if (initial) setError(null);
      getUsage(Number(days), scope)
        .then((d) => {
          if (!cancelled) setData(d);
        })
        .catch((e: unknown) => {
          // Only surface errors on the first load; quiet on background polls.
          if (!cancelled && initial) setError(e instanceof Error ? e.message : "Failed to load usage");
        });
    };
    load(true);
    const id = setInterval(() => load(false), USAGE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [days, scope]);

  const t = data?.totals;

  return (
    <>
      {/* Controls: time window, creator scope, and the headline totals */}
      <div className="cusagebar">
        <div className="cstatrow" style={{ flex: 1, gridTemplateColumns: "repeat(3, 1fr)" }}>
          <Stat icon="zap" iso="bolt" label={`Sessions · last ${days}d`} value={String(t?.sessions ?? 0)} tint="ads" />
          <Stat icon="image" iso="rocket" label="Creatives made" value={String(t?.creatives ?? 0)} tint="seo" />
          <Stat icon="activity" iso="bolt" label="Active days" value={String(t?.active_days ?? 0)} tint="copy" />
        </div>
        <div className="cusagebar__ctrls">
          {userIsCreator && (
            <Tabs
              variant="pill"
              value={scope}
              onChange={(v) => setScope(v as "me" | "all")}
              items={[
                { value: "me", label: "My usage" },
                { value: "all", label: "All users" },
              ]}
            />
          )}
          <Tabs variant="line" value={days} onChange={setDays} items={WINDOWS} />
        </div>
      </div>

      {error && (
        <div style={{ background: "var(--danger-bg)", color: "var(--danger)", padding: 12, borderRadius: "var(--radius-lg)", fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Live leaderboard — who has used the agents the most */}
      <Leaderboard data={data} metric={metric} setMetric={setMetric} />

      {/* Per-agent usage tiles */}
      <section>
        <div className="csechead">
          <h3>Usage by agent</h3>
          <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>runs in the last {days} days</span>
        </div>
        <div className="cgrid cgrid--3">
          {(data?.per_agent ?? []).map((a) => (
            <AgentUsageTile key={a.agent_id} agent={a} />
          ))}
        </div>
      </section>
    </>
  );
}

export function HomeView({
  mode,
  setMode,
  onOpenAgents,
  onOpenAgent,
  onAdd,
  added,
  userName,
}: {
  mode: string;
  setMode: (m: string) => void;
  onOpenAgents: () => void;
  onOpenAgent: (id: string) => void;
  onAdd: (id: string) => void;
  added: Record<string, boolean>;
  userName: string;
  convCount: number;
}) {
  const { user } = useAuth();
  const firstName = userName.split(" ")[0] || "there";

  return (
    <div className="cview">
      <div className="cgreet">
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em" }}>
            Welcome back, {firstName}
          </div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 3 }}>
            Your activity across every agent, at a glance.
          </div>
        </div>
      </div>

      <UsageDashboard userIsCreator={!!user?.is_creator} />

      <div className="csechead" style={{ marginTop: 8 }}>
        <h3>Open an agent</h3>
        <Tabs
          variant="pill"
          value={mode}
          onChange={setMode}
          items={[
            { value: "agents", label: "Agents", icon: <Icon name="bot" /> },
            { value: "teams", label: "Teams", icon: <Icon name="users-round" /> },
          ]}
        />
      </div>

      {mode === "agents" ? (
        <section>
          <div className="csechead">
            <h3>Your specialists</h3>
            <Button variant="ghost" size="sm" iconRight={<Icon name="arrow-right" />} onClick={onOpenAgents}>
              Browse all agents
            </Button>
          </div>
          <div className="cgrid cgrid--3">
            {agents.slice(0, 6).map((a) => {
              const live = isAgentLive(a.id);
              return (
                <AgentCard
                  key={a.id}
                  {...a}
                  glyph={<Icon name={a.glyph} />}
                  interactive
                  comingSoon={!live}
                  status={live ? "success" : undefined}
                  onOpen={live ? () => onOpenAgent(a.id) : undefined}
                  added={live ? !!added[a.id] : undefined}
                  onAdd={live ? () => onAdd(a.id) : undefined}
                />
              );
            })}
          </div>
        </section>
      ) : (
        <div className="chome-teams">
          <section>
            <div className="csechead">
              <h3>Active teams</h3>
              <Button variant="ghost" size="sm" iconRight={<Icon name="arrow-right" />}>
                Manage
              </Button>
            </div>
            <div className="cgrid cgrid--2">
              {teams.map((t) => (
                <TeamCard key={t.id} {...t} comingSoon />
              ))}
            </div>
          </section>
          <aside className="cactivity-mini">
            <div className="csechead">
              <h3>Live now</h3>
              <StatusDot status="running" />
            </div>
            <RunMini />
          </aside>
        </div>
      )}
    </div>
  );
}

const CATS = [
  { value: "all", label: "All" },
  { value: "design", label: "Design" },
  { value: "seo", label: "SEO" },
  { value: "copy", label: "Copy" },
  { value: "social", label: "Social" },
  { value: "ads", label: "Ads" },
  { value: "data", label: "Data" },
];

export function AgentsView({
  onOpenAgent,
}: {
  onOpenAgent: (id: string) => void;
}) {
  const [cat, setCat] = useState("all");
  const list = cat === "all" ? agents : agents.filter((a) => a.category === cat);

  return (
    <div className="cview">
      <div className="cfilterbar">
        <Tabs variant="line" value={cat} onChange={setCat} items={CATS} />
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <IconButton label="Grid view" variant="solid">
            <Icon name="layout-grid" />
          </IconButton>
          <IconButton label="List view" variant="ghost">
            <Icon name="list" />
          </IconButton>
        </div>
      </div>
      <div className="cgrid cgrid--3">
        {list.map((a) => {
          const live = isAgentLive(a.id);
          return (
            <AgentCard
              key={a.id}
              {...a}
              glyph={<Icon name={a.glyph} />}
              interactive
              comingSoon={!live}
              status={live ? "success" : undefined}
              onOpen={live ? () => onOpenAgent(a.id) : undefined}
            />
          );
        })}
        <div className="caddcard" style={{ opacity: 0.72 }}>
          <span className="caddcard__ic">
            <Icon name="sparkles" />
          </span>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Need something else?</div>
          <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", textAlign: "center", marginBottom: 10 }}>
            More specialist agents are on the way.
          </div>
          <Badge variant="outline">Coming soon</Badge>
        </div>
      </div>
    </div>
  );
}

export function TeamsView() {
  return (
    <div className="cview">
      <div className="cgreet">
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>
            AI teams
          </div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 3 }}>
            Coordinated workflows assembled from agents — all coming soon.
          </div>
        </div>
      </div>
      <div className="cgrid cgrid--2">
        {teams.map((t) => (
          <TeamCard key={t.id} {...t} comingSoon />
        ))}
        <button className="cbuildcard" style={{ opacity: 0.72, cursor: "default" }} type="button" disabled>
          <span className="cbuildcard__ic">
            <Icon name="plus" />
          </span>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16 }}>Build a team</div>
          <div style={{ fontSize: 13, color: "var(--text-tertiary)", textAlign: "center", maxWidth: 230 }}>
            Team builder is coming soon.
          </div>
          <Badge variant="outline" style={{ marginTop: 8 }}>
            Coming soon
          </Badge>
        </button>
      </div>
    </div>
  );
}

export function PlaceholderView({ title }: { title: string }) {
  return (
    <div className="cview">
      <div className="cplaceholder">
        <GlyphTile glyph="bolt" tint="design" size={64} glyphSize={32} />
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18, marginTop: 18 }}>{title}</div>
        <div style={{ fontSize: 13.5, color: "var(--text-tertiary)", maxWidth: 360, lineHeight: 1.6 }}>
          Connect your tools and channels here — this area is coming soon.
        </div>
        <Badge variant="outline" style={{ marginTop: 14 }}>
          Coming soon
        </Badge>
      </div>
    </div>
  );
}

function SettingToggleRow({
  on,
  onToggle,
  label,
  desc,
}: {
  on: boolean;
  onToggle: () => void;
  label: string;
  desc: string;
}) {
  return (
    <button type="button" className="csrow csrow--btn" onClick={onToggle} aria-pressed={on}>
      <span className="csrow__main">
        <span className="csrow__label">{label}</span>
        <span className="csrow__desc">{desc}</span>
      </span>
      <span className="csswitch" data-on={on ? "1" : "0"} aria-hidden>
        <span />
      </span>
    </button>
  );
}

export function SettingsView({ userName, userEmail }: { userName: string; userEmail: string }) {
  const [prefs, setPrefs] = useState({
    runAlerts: true,
    weeklyDigest: false,
    productNews: true,
    reducedMotion: false,
  });
  const toggle = (k: keyof typeof prefs) => setPrefs((p) => ({ ...p, [k]: !p[k] }));

  return (
    <div className="cview" style={{ maxWidth: 860 }}>
      <section className="cset">
        <div className="cset__head">
          <GlyphTile glyph="teams" tint="ads" size={38} glyphSize={20} />
          <div className="cset__id">
            <div className="cset__title">Workspace</div>
            <div className="cset__sub">Brand workspace · Marketing</div>
          </div>
        </div>
        <div className="cset__rows">
          <div className="csrow">
            <span className="csrow__main">
              <span className="csrow__label">Workspace name</span>
              <span className="csrow__desc">Shown across the console</span>
            </span>
            <span className="csrow__val">Brand workspace</span>
          </div>
          <div className="csrow">
            <span className="csrow__main">
              <span className="csrow__label">Plan</span>
              <span className="csrow__desc">Pro trial — 6 days left</span>
            </span>
            <Button size="sm" variant="accent">Upgrade</Button>
          </div>
          <div className="csrow">
            <span className="csrow__main" style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar name={userName} size="sm" color="var(--cat-social)" />
              <span>
                <span className="csrow__label" style={{ display: "block" }}>{userName}</span>
                <span className="csrow__desc">{userEmail}</span>
              </span>
            </span>
            <Button size="sm" variant="secondary">Manage</Button>
          </div>
        </div>
      </section>

      <section className="cset">
        <div className="cset__head">
          <GlyphTile glyph="bolt" tint="seo" size={38} glyphSize={20} />
          <div className="cset__id">
            <div className="cset__title">Notifications</div>
            <div className="cset__sub">How we keep you posted</div>
          </div>
        </div>
        <div className="cset__rows">
          <SettingToggleRow on={prefs.runAlerts} onToggle={() => toggle("runAlerts")} label="Run completion alerts" desc="Notify me when an agent finishes a run." />
          <SettingToggleRow on={prefs.weeklyDigest} onToggle={() => toggle("weeklyDigest")} label="Weekly digest" desc="A Monday summary of your workspace activity." />
          <SettingToggleRow on={prefs.productNews} onToggle={() => toggle("productNews")} label="Product news" desc="Occasional updates about new agents and features." />
        </div>
      </section>

      <section className="cset">
        <div className="cset__head">
          <GlyphTile glyph="data" tint="data" size={38} glyphSize={20} />
          <div className="cset__id">
            <div className="cset__title">Appearance</div>
            <div className="cset__sub">Theme &amp; motion</div>
          </div>
        </div>
        <div className="cset__rows">
          <div className="csrow">
            <span className="csrow__main">
              <span className="csrow__label">Theme</span>
              <span className="csrow__desc">Ocean — premium blue</span>
            </span>
            <Badge variant="brand">Active</Badge>
          </div>
          <SettingToggleRow on={prefs.reducedMotion} onToggle={() => toggle("reducedMotion")} label="Reduce motion" desc="Minimize animations and transitions across the app." />
        </div>
      </section>
    </div>
  );
}
