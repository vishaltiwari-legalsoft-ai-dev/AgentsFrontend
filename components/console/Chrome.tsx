"use client";

import { useEffect, useState } from "react";
import type { User } from "@/lib/api";
import { getNews } from "@/lib/api";
import { Icon, Avatar, IconButton } from "@/lib/kit-ui";

/** Fired by the creator's config panel after saving, so open bars refresh live. */
export const NEWS_UPDATED_EVENT = "agentos:news-updated";

const NAV = [
  { id: "home", label: "Home", icon: "layout-dashboard" },
  { id: "agents", label: "Agents", icon: "bot" },
  { id: "teams", label: "Teams", icon: "users-round" },
];

const NAV2 = [
  { id: "library", label: "Library", icon: "shapes" },
  { id: "integrations", label: "Integrations", icon: "plug" },
  { id: "settings", label: "Settings", icon: "settings" },
];

function Logo() {
  return (
    <div className="cbrand" style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <svg width="30" height="30" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="lsnav" x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
            <stop stopColor="#00B4D8" />
            <stop offset="1" stopColor="#03045E" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="36" height="36" rx="9" fill="url(#lsnav)" />
        <rect x="11" y="22" width="4.5" height="7" rx="1.2" fill="#fff" opacity="0.55" />
        <rect x="17.75" y="18" width="4.5" height="11" rx="1.2" fill="#fff" opacity="0.78" />
        <rect x="24.5" y="14" width="4.5" height="15" rx="1.2" fill="#fff" />
        <path d="M11 19.5 L18 15 L23 17.5 L30.5 11" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M27 10.4 L31 10 L30.6 14 Z" fill="#fff" />
      </svg>
      <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, letterSpacing: "-0.01em", color: "var(--blue-900)" }}>
        Agent<span style={{ color: "var(--blue-600)" }}>Hub</span>
      </span>
    </div>
  );
}

function NavItem({ item, active, onClick }: { item: { id: string; label: string; icon: string }; active: boolean; onClick: () => void }) {
  return (
    <button
      className="cnav"
      onClick={onClick}
      title={item.label}
      style={active ? { background: "var(--brand-subtle)", color: "var(--brand)", fontWeight: 600 } : undefined}
    >
      <Icon name={item.icon} />
      <span>{item.label}</span>
    </button>
  );
}

export function Sidebar({
  nav,
  setNav,
  user,
  isAdmin,
  isCreator,
  onLogout,
}: {
  nav: string;
  setNav: (id: string) => void;
  user: User;
  isAdmin?: boolean;
  isCreator?: boolean;
  onLogout: () => void;
}) {
  // Creator-only "Agent config" sits above the admin panel; both are appended to
  // the secondary nav so only privileged accounts ever see them.
  let nav2 = NAV2;
  if (isCreator) nav2 = [...nav2, { id: "agentcfg", label: "Agent config", icon: "sliders-horizontal" }];
  if (isAdmin) nav2 = [...nav2, { id: "database", label: "Database", icon: "database" }];
  if (isAdmin) nav2 = [...nav2, { id: "admin", label: "Admin", icon: "shield" }];

  // Collapsed state is remembered across navigation and reloads.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined" && window.localStorage.getItem("sidebar-collapsed") === "1") {
      setCollapsed(true);
    }
  }, []);
  const toggleCollapsed = () =>
    setCollapsed((c) => {
      const next = !c;
      if (typeof window !== "undefined") window.localStorage.setItem("sidebar-collapsed", next ? "1" : "0");
      return next;
    });

  return (
    <aside className="csidebar" data-collapsed={collapsed ? "1" : "0"}>
      <div className="csidehead">
        <Logo />
        <button
          type="button"
          className="csidetoggle"
          onClick={toggleCollapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <Icon name={collapsed ? "panel-left-open" : "panel-left-close"} />
        </button>
      </div>
      <nav className="cnavlist">
        {NAV.map((it) => (
          <NavItem
            key={it.id}
            item={it}
            active={nav === it.id || (it.id === "agents" && nav === "workspace")}
            onClick={() => setNav(it.id)}
          />
        ))}
        <div className="cnavdiv" />
        {nav2.map((it) => (
          <NavItem key={it.id} item={it} active={nav === it.id} onClick={() => setNav(it.id)} />
        ))}
      </nav>
      <div className="cuser">
        <Avatar name={user.name || user.email} src={user.picture} size="sm" color="var(--cat-social)" />
        <div className="cuser__info" style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{user.name || user.email}</div>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{user.email}</div>
        </div>
        <span className="cuser__signout">
          <IconButton label="Sign out" size="sm" onClick={onLogout}>
            <Icon name="log-out" />
          </IconButton>
        </span>
      </div>
    </aside>
  );
}

/**
 * Announcement strip that replaces the old top bar. Shows the single news
 * bulletin the creator writes (via the Agent-config panel), scrolling right →
 * left. Every signed-in user sees the same text; it refreshes on mount, when the
 * tab regains focus, and immediately after the creator saves a new message.
 */
export function NewsBar() {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      getNews()
        .then((n) => {
          if (!cancelled) setText(n.text || "");
        })
        .catch(() => {
          if (!cancelled) setText("");
        });
    load();

    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    window.addEventListener(NEWS_UPDATED_EVENT, onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(NEWS_UPDATED_EVENT, onFocus);
    };
  }, []);

  // Before the first fetch resolves, render the strip empty (no flash of text).
  if (text === null) {
    return (
      <header className="cnewsbar cnewsbar--empty">
        <span className="cnewsbar__tag">
          <Icon name="megaphone" /> News
        </span>
      </header>
    );
  }

  if (!text) {
    return (
      <header className="cnewsbar cnewsbar--empty">
        <span className="cnewsbar__tag">
          <Icon name="megaphone" /> News
        </span>
        <span>No announcements right now.</span>
      </header>
    );
  }

  // Two copies of the message make the marquee loop seamlessly (the keyframe
  // translates the track by exactly one copy's width, -50%).
  return (
    <header className="cnewsbar">
      <span className="cnewsbar__tag">
        <Icon name="megaphone" /> News
      </span>
      <div className="cnewsbar__viewport">
        <div className="cnewsbar__track">
          <span className="cnewsbar__item">{text}</span>
          <span className="cnewsbar__item" aria-hidden="true">
            {text}
          </span>
        </div>
      </div>
    </header>
  );
}
