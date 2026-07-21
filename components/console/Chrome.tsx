"use client";

import { useEffect, useRef, useState } from "react";
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
    <div className="cbrand">
      <svg width="30" height="30" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="2" width="36" height="36" rx="9" fill="#7624f4" />
        <rect x="11" y="22" width="4.5" height="7" rx="1.2" fill="#fff" opacity="0.55" />
        <rect x="17.75" y="18" width="4.5" height="11" rx="1.2" fill="#fff" opacity="0.78" />
        <rect x="24.5" y="14" width="4.5" height="15" rx="1.2" fill="#fff" />
        <path d="M11 19.5 L18 15 L23 17.5 L30.5 11" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M27 10.4 L31 10 L30.6 14 Z" fill="#fff" />
      </svg>
      <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, letterSpacing: "-0.01em", color: "var(--text-primary)" }}>
        Agent<span style={{ color: "var(--blue-600)" }}>Hub</span>
      </span>
    </div>
  );
}

function NavItem({ item, active, onClick }: { item: { id: string; label: string; icon: string }; active: boolean; onClick: () => void }) {
  return (
    <button
      className={active ? "cnav cnav--active" : "cnav"}
      onClick={onClick}
      title={item.label}
      aria-current={active ? "page" : undefined}
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
  if (isAdmin) nav2 = [...nav2, { id: "imagelib", label: "Image library", icon: "images" }];
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

/** OpenRouter account stats served by /api/or-stats (key stays server-side). */
interface OrStats {
  configured: boolean;
  error?: boolean;
  totalCredits?: number | null;
  totalUsage?: number | null;
  tokens30d?: number | null;
  spend30d?: number | null;
}

function fmtTokens(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}

function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

/** Viewer-local wall clock, 12-hour. Rendered only after mount so SSR markup
 *  never carries a server-zone time (hydration-safe). */
function ClockPill() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, []);

  if (!now) return null;
  return (
    <span
      className="cstatsbar__stat cstatsbar__clock"
      title={now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
    >
      <Icon name="clock" />
      <b>{now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true })}</b>
    </span>
  );
}

const NOTE_KEY = "topbar-note";

/** Personal scratch note — saved in this browser only (localStorage). */
function StickyNotePill() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      setText(window.localStorage.getItem(NOTE_KEY) || "");
    } catch {
      /* ignore */
    }
  }, []);

  // Close on any outside click (same pattern as the bell popover).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const save = (v: string) => {
    setText(v);
    try {
      window.localStorage.setItem(NOTE_KEY, v);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="cstatsbar__notewrap" ref={wrapRef}>
      <button
        type="button"
        className="cstatsbar__stat cstatsbar__notebtn"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Sticky note"
      >
        <Icon name="sticky-note" /> Note
        {text.trim() !== "" && <span className="cstatsbar__notedot" aria-hidden />}
      </button>
      {open && (
        <div className="cstatsbar__pop cstatsbar__notepop" role="dialog" aria-label="Sticky note">
          <div className="cstatsbar__pophead"><Icon name="sticky-note" /> Sticky note</div>
          <textarea
            className="cstatsbar__notearea"
            value={text}
            onChange={(e) => save(e.target.value)}
            placeholder="Jot anything — todos, reminders. Saved in this browser."
            rows={7}
            autoFocus
          />
        </div>
      )}
    </div>
  );
}

/**
 * Top strip: viewer-local clock + sticky note, live OpenRouter stats (tokens
 * used, credits left, 30-day spend) plus a notification bell on the right. The
 * creator's news bulletin — which used to scroll here as a marquee — now lives
 * in the bell's popover.
 */
export function StatsBar() {
  const [stats, setStats] = useState<OrStats | null>(null);
  const [news, setNews] = useState<{ text: string; updated_at: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [seenAt, setSeenAt] = useState<string>("");
  const bellRef = useRef<HTMLDivElement | null>(null);

  // Stats: fetch on mount and when the tab regains focus.
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/or-stats")
        .then((r) => r.json())
        .then((s: OrStats) => {
          if (!cancelled) setStats(s);
        })
        .catch(() => {
          if (!cancelled) setStats({ configured: true, error: true });
        });
    load();
    window.addEventListener("focus", load);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", load);
    };
  }, []);

  // News: same refresh triggers as the old marquee (mount, focus, creator save).
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      getNews()
        .then((n) => {
          if (!cancelled) setNews({ text: n.text || "", updated_at: n.updated_at || "" });
        })
        .catch(() => {
          if (!cancelled) setNews({ text: "", updated_at: "" });
        });
    load();
    window.addEventListener("focus", load);
    window.addEventListener(NEWS_UPDATED_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", load);
      window.removeEventListener(NEWS_UPDATED_EVENT, load);
    };
  }, []);

  useEffect(() => {
    try {
      setSeenAt(window.localStorage.getItem("news-seen-at") || "");
    } catch {
      /* ignore */
    }
  }, []);

  // Close the popover on any outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const unread = Boolean(news?.text) && news!.updated_at !== seenAt;

  const toggle = () => {
    setOpen((o) => !o);
    if (news?.updated_at) {
      setSeenAt(news.updated_at);
      try {
        window.localStorage.setItem("news-seen-at", news.updated_at);
      } catch {
        /* ignore */
      }
    }
  };

  const creditsLeft =
    stats?.totalCredits != null && stats?.totalUsage != null
      ? Math.max(0, stats.totalCredits - stats.totalUsage)
      : null;

  return (
    <header className="cstatsbar">
      <ClockPill />
      <StickyNotePill />
      {stats && !stats.configured ? null : (
        <>
          {stats?.tokens30d != null && (
            <span className="cstatsbar__stat" title="Tokens used in the last 30 days">
              <Icon name="activity" /> Tokens (30d) <b>{fmtTokens(stats.tokens30d)}</b>
            </span>
          )}
          {creditsLeft != null && (
            <span className="cstatsbar__stat" title="Credits remaining on the account">
              <Icon name="wallet" /> Credits left <b>{fmtUsd(creditsLeft)}</b>
            </span>
          )}
          {stats?.spend30d != null && (
            <span className="cstatsbar__stat" title="Spend in the last 30 days">
              <Icon name="coins" /> Spend (30d) <b>{fmtUsd(stats.spend30d)}</b>
            </span>
          )}
          {stats?.error && <span className="cstatsbar__hint">OpenRouter stats unavailable</span>}
        </>
      )}
      <div className="cstatsbar__spacer" />
      <div className="cstatsbar__bellwrap" ref={bellRef}>
        <button
          type="button"
          className="cstatsbar__bell"
          onClick={toggle}
          aria-label="Notifications"
          aria-expanded={open}
        >
          <Icon name="bell" />
          {unread && <span className="cstatsbar__dot" />}
        </button>
        {open && (
          <div className="cstatsbar__pop" role="dialog" aria-label="Announcements">
            <div className="cstatsbar__pophead">
              <Icon name="megaphone" /> Announcements
            </div>
            {news?.text ? (
              <>
                <p className="cstatsbar__poptext">{news.text}</p>
                {news.updated_at && (
                  <div className="cstatsbar__popdate">
                    {new Date(news.updated_at).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                )}
              </>
            ) : (
              <p className="cstatsbar__poptext cstatsbar__poptext--muted">No announcements right now.</p>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
