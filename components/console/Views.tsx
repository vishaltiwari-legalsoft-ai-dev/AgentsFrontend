"use client";

import { useEffect, useState } from "react";
import { agents, isAgentLive } from "@/lib/console-data";
import { Icon, Button, IconButton, Avatar, Badge, Tabs, AgentCard } from "@/lib/kit-ui";
import { GlyphTile } from "@/lib/glyph";

export function HomeView({
  onOpenAgents,
  onOpenAgent,
  onAdd,
  added,
  userName,
}: {
  onOpenAgents: () => void;
  onOpenAgent: (id: string) => void;
  onAdd: (id: string) => void;
  added: Record<string, boolean>;
  userName: string;
}) {
  const firstName = userName.split(" ")[0] || "there";

  return (
    <div className="cview">
      <div className="cgreet">
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em" }}>
            Welcome back, {firstName}
          </div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 3 }}>
            Pick a specialist agent to get started.
          </div>
        </div>
      </div>

      <section style={{ marginTop: 8 }}>
        <div className="csechead">
          <h3>Open an agent</h3>
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
      <div className="cplaceholder">
        <GlyphTile glyph="teams" tint="social" size={64} glyphSize={32} />
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18, marginTop: 18 }}>AI teams</div>
        <div style={{ fontSize: 13.5, color: "var(--text-tertiary)", maxWidth: 360, lineHeight: 1.6 }}>
          Coordinated workflows assembled from your agents. Team building is on the way.
        </div>
        <Badge variant="outline" style={{ marginTop: 14 }}>
          Coming soon
        </Badge>
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

/** Selectable color themes. `id` matches the `data-theme` value on <html>
 *  ("ocean" is the default and clears the attribute). */
const THEMES = [
  { id: "ocean", label: "Ocean", desc: "Premium blue", swatch: ["#0077B6", "#00B4D8", "#03045E"] },
  { id: "sky", label: "Sky & Amber", desc: "Aqua & warm amber", swatch: ["#219EBC", "#8ECAE6", "#FFB703", "#FB8500"] },
  { id: "prussian", label: "Midnight Orange", desc: "Prussian blue & orange", swatch: ["#14213D", "#FCA311", "#E5E5E5"] },
];

function ThemePicker() {
  const [theme, setTheme] = useState("ocean");

  // Reflect whatever the no-flash script (or a previous session) already applied.
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme || "ocean");
  }, []);

  const apply = (id: string) => {
    setTheme(id);
    if (id === "ocean") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = id;
    try {
      window.localStorage.setItem("app-theme", id);
    } catch {
      /* ignore storage failures (private mode etc.) */
    }
  };

  return (
    <div className="cthemegrid">
      {THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          className="cthemecard"
          data-active={theme === t.id ? "1" : "0"}
          onClick={() => apply(t.id)}
          aria-pressed={theme === t.id}
        >
          {theme === t.id && <Icon name="check" />}
          <span className="cthemecard__sw">
            {t.swatch.map((c, i) => (
              <span key={i} style={{ background: c }} />
            ))}
          </span>
          <span className="cthemecard__id">
            <span className="cthemecard__name">{t.label}</span>
            <span className="cthemecard__desc">{t.desc}</span>
          </span>
        </button>
      ))}
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
          <div className="csrow csrow--stack">
            <span className="csrow__main">
              <span className="csrow__label">Theme</span>
              <span className="csrow__desc">Choose the console color palette</span>
            </span>
            <ThemePicker />
          </div>
          <SettingToggleRow on={prefs.reducedMotion} onToggle={() => toggle("reducedMotion")} label="Reduce motion" desc="Minimize animations and transitions across the app." />
        </div>
      </section>
    </div>
  );
}
