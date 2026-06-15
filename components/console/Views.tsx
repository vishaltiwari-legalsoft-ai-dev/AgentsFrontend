"use client";

import { useState } from "react";
import { agents, teams, runSteps, isAgentLive } from "@/lib/console-data";
import { Icon, Button, IconButton, Avatar, Badge, StatusDot, Tabs, AgentCard, TeamCard } from "@/lib/kit-ui";
import { GlyphTile } from "@/lib/glyph";

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

export function HomeView({
  mode,
  setMode,
  onOpenAgents,
  onOpenAgent,
  onAdd,
  added,
  userName,
  convCount,
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
  const firstName = userName.split(" ")[0] || "there";

  return (
    <div className="cview">
      <div className="cgreet">
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em" }}>
            Good morning, {firstName}
          </div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 3 }}>
            Graphic Designer is live. Open the agent to start a creative run.
          </div>
        </div>
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

      <StatRow convCount={convCount} />

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
