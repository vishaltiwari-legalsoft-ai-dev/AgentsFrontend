"use client";

/** The AgentHub shell: the rail, the header, and whatever panel the hash names.
 *
 *  This is the prototype's `index.html` plus its `shell wiring` section, with
 *  three things that a prototype does not need and a console does:
 *
 *  1. **Panels are gated.** Models is creator-only and Admin is admin-only, and
 *     the gate is applied in one place — `panelsFor` — so a panel cannot be
 *     reachable from the rail but refused by the API, or the reverse.
 *  2. **Failure has a tone.** The prototype's toast said one thing in one voice
 *     because nothing in it could fail. Here a failed 90-second run must not
 *     read like a success that cleared itself, so `error` stays until dismissed.
 *  3. **Every figure is fetched.** The rail's counts and the header's spend come
 *     from the API and are simply absent until they arrive, rather than
 *     rendering a placeholder number that could be mistaken for a real one.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Sprite, Ic } from "./Sprite";
import {
  HOME, LIVE_AGENTS, PANELS,
  agentById, agentBySlug, canOpen, panelsFor, routeFromHash, routeToHash,
  type PanelId, type Route,
} from "./model";
import { HubProvider, type Headline, type HubContextValue, type ToastFn, type WorkNav } from "./context";
import { HubToasts, useToasts } from "./Toasts";
import { HubPalette } from "./Palette";
import { BriefDialog } from "./BriefDialog";
import { PanelSwitch } from "./PanelSwitch";
import { useShellStats } from "./useShellStats";

/* ------------------------------------------------------------------- theme -- */

/** Written by the inline script in `app/layout.tsx` before first paint, and by
 *  the appearance button here. One key, so a reload never flashes the theme the
 *  reader did not pick. */
const THEME_KEY = "app-theme";

function readTheme(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "dark";
}

function writeTheme(dark: boolean): void {
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  try {
    localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  } catch {
    /* storage off — the class on <html> is still correct for this session */
  }
}

/* -------------------------------------------------------------------- rail -- */

function Rail({
  route, panels, counts, stat, onGo, onOpenPalette, dark, onTheme, user, onLogout, workRail,
}: {
  route: Route;
  panels: ReturnType<typeof panelsFor>;
  counts: Partial<Record<PanelId, number>>;
  stat: string;
  onGo: (id: PanelId) => void;
  onOpenPalette: () => void;
  dark: boolean;
  onTheme: () => void;
  user: { name: string; email: string; is_admin?: boolean; is_creator?: boolean };
  onLogout: () => void;
  workRail: React.ReactNode;
}) {
  const groups = useMemo(() => [...new Set(panels.map((p) => p.group))], [panels]);
  const tier = user.is_creator ? "creator" : user.is_admin ? "admin" : "member";
  const avatar = (user.name || user.email || "?").slice(0, 2).toUpperCase();

  return (
    <aside className="rail" aria-label="Sections">
      <div className="rail__brand">
        <span className="rail__glyph" aria-hidden="true" />
        <span className="rail__names">
          <b>AgentHub</b>
          <em>Legal Soft · Marketing</em>
        </span>
      </div>

      <nav className="nav" aria-label="Panels">
        {workRail}
        {groups.map((g) => (
          <div className="nav__group" key={g}>
            <p className="nav__label">{g}</p>
            {panels.filter((p) => p.group === g).map((p) => {
              const on = !route.work && p.id === route.panel;
              const c = counts[p.id];
              return (
                <button
                  type="button"
                  key={p.id}
                  className={`nav__item${on ? " is-on" : ""}`}
                  aria-current={on ? "page" : undefined}
                  title={p.label}
                  onClick={() => onGo(p.id)}
                >
                  <Ic name={p.icon} />
                  <span>{p.label}</span>
                  {c !== undefined && c > 0 && <span className="nav__count">{c.toLocaleString("en-US")}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="rail__foot">
        <p className="rail__stat">{stat}</p>
        <button type="button" className="rail__btn" onClick={onOpenPalette} aria-label="Search" title="Search — Ctrl K">
          <Ic name="search" />
          <span>Search</span>
          <kbd>Ctrl K</kbd>
        </button>
        <button
          type="button"
          className="rail__btn"
          aria-pressed={dark}
          aria-label="Appearance"
          title="Switch between light and dark"
          onClick={onTheme}
        >
          <Ic name={dark ? "sun" : "moon"} />
          <span>Appearance</span>
          <span className="swap">{dark ? "Dark" : "Light"}</span>
        </button>
        <div className="whoami">
          <span className="whoami__av" aria-hidden="true">{avatar}</span>
          <span className="whoami__who">
            <b>{user.name || user.email}</b>
            <em>{user.email}</em>
          </span>
          <span className="whoami__tier">{tier}</span>
        </div>
        <button type="button" className="rail__btn" onClick={onLogout} title="Sign out of AgentHub">
          <Ic name="x" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}


/** The workspace group at the head of the rail.
 *
 *  It is inserted *above* the console's own groups rather than replacing them:
 *  the record stays one keystroke away and the rail remembers the panel you
 *  left. That arrangement is the reason no workspace in this product needs a
 *  second tab bar of its own — the sections are the rail.
 */
function WorkRail({ nav, backLabel, onBack }: { nav: WorkNav; backLabel: string; onBack: () => void }) {
  const agent = agentById(nav.agentId);
  return (
    <div className="nav__group nav__group--work">
      <button type="button" className="nav__back" onClick={onBack} title={`Back to ${backLabel}`}>
        <Ic name="chevron" />
        <span>{backLabel}</span>
      </button>

      <div className="nav__ws">
        <span className="mono" aria-hidden="true">{agent?.mono || "??"}</span>
        <span className="nav__wsid">
          <b>{agent?.name || nav.agentId}</b>
          <em>{agent?.role || ""}</em>
        </span>
      </div>

      {nav.subjects.length > 1 && (
        <div className="nav__sites">
          {nav.subjects.map((s) => (
            <button
              type="button"
              key={s.id}
              className={`nav__site${s.id === nav.subject ? " is-on" : ""}`}
              title={s.name}
              onClick={() => nav.onSubject(s.id)}
            >
              <u className="nav__ab" aria-hidden="true">{s.ab}</u>
              <span>{s.name}</span>
              {s.busy && (<><i className="nav__go" aria-hidden="true" /><span className="sr">running now</span></>)}
            </button>
          ))}
        </div>
      )}

      {nav.sections.map((sec) => (
        <button
          type="button"
          key={sec.id}
          className={`nav__item${sec.id === nav.section ? " is-on" : ""}`}
          aria-current={sec.id === nav.section ? "page" : undefined}
          title={sec.label}
          onClick={() => nav.onSection(sec.id)}
        >
          <Ic name={sec.icon} />
          <span>{sec.label}</span>
          {sec.count != null && sec.count > 0 && (
            <span className="nav__count">{sec.count.toLocaleString("en-US")}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------------- app -- */

export default function HubApp() {
  const { user, logout } = useAuth();
  const [route, setRoute] = useState<Route>(HOME);
  const [head, setHeadState] = useState<Headline>({ sub: "" });
  const [dark, setDark] = useState(false);
  const [revision, setRevision] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [briefFor, setBriefFor] = useState<string | null>(null);
  const [workNav, setWorkNav] = useState<WorkNav | null>(null);
  const { toasts, fire, dismiss } = useToasts();

  const viewer = useMemo(
    () => ({ is_admin: user?.is_admin, is_creator: user?.is_creator }),
    [user?.is_admin, user?.is_creator],
  );

  // The hash is the address bar's copy of `route`; `route` is the truth. Writing
  // it with pushState means Back returns to the previous panel instead of
  // leaving the console — the one thing Back must never do.
  useEffect(() => {
    if (!user) return;
    setRoute(routeFromHash(window.location.hash, viewer));
    const onPop = () => setRoute(routeFromHash(window.location.hash, viewer));
    window.addEventListener("popstate", onPop);
    window.addEventListener("hashchange", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("hashchange", onPop);
    };
  }, [user, viewer]);

  useEffect(() => setDark(readTheme()), []);

  const navigate = useCallback((next: Route) => {
    setRoute(next);
    const hash = routeToHash(next);
    if (typeof window !== "undefined" && window.location.hash !== hash) {
      window.history.pushState(null, "", hash);
    }
  }, []);

  const go = useCallback((panel: PanelId) => navigate({ panel, work: null }), [navigate]);

  // A workspace is layered over the panel you came from, not instead of it, so
  // the way out returns you to where you were rather than always to Agents.
  const openWork = useCallback(
    (slug: string, subject = "", section = "") => {
      if (!agentBySlug(slug)) return;
      navigate({ panel: route.panel, work: { slug, subject, section } });
    },
    [navigate, route.panel],
  );

  const closeWork = useCallback(() => {
    navigate({ panel: route.panel, work: null });
  }, [navigate, route.panel]);

  const setHead = useCallback((h: Headline) => setHeadState(h), []);
  const setWorkNavStable = useCallback((nav: WorkNav | null) => setWorkNav(nav), []);
  const bumpRevision = useCallback(() => setRevision((r) => r + 1), []);
  const openBrief = useCallback((agentId?: string) => setBriefFor(agentId || LIVE_AGENTS[0].id), []);

  const toggleTheme = useCallback(() => {
    setDark((d) => {
      writeTheme(!d);
      return !d;
    });
  }, []);

  // Ctrl/Cmd-K anywhere but inside a text field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const stats = useShellStats(!!user, revision);

  const ctx: HubContextValue | null = useMemo(
    () => (user ? {
      user, route, go, openWork, closeWork,
      toast: fire as ToastFn,
      setHead, setWorkNav: setWorkNavStable, openBrief, bumpRevision, revision,
    } : null),
    [user, route, go, openWork, closeWork, fire, setHead, setWorkNavStable, openBrief, bumpRevision, revision],
  );

  if (!user || !ctx) return null;

  const panels = panelsFor(viewer);
  const activePanel = PANELS.find((p) => p.id === route.panel && canOpen(p, viewer)) || PANELS[0];
  const title = head.title || (route.work ? agentBySlug(route.work.slug)?.name || "Workspace" : activePanel.title);

  return (
    <HubProvider value={ctx}>
      <Sprite />
      <div className="app">
        <Rail
          route={route}
          panels={panels}
          counts={stats.counts}
          stat={stats.railStat}
          onGo={go}
          onOpenPalette={() => setPaletteOpen(true)}
          dark={dark}
          onTheme={toggleTheme}
          user={user}
          onLogout={logout}
          workRail={
            route.work && workNav
              ? <WorkRail nav={workNav} backLabel={activePanel.label} onBack={closeWork} />
              : null
          }
        />

        <div className="frame">
          <header className="head">
            <div className="head__title">
              <h1>{title}</h1>
              <p>{head.sub}</p>
            </div>
            <div className="head__ops">
              <div className="spend" aria-label="OpenRouter account">
                {stats.spend.map((s) => (
                  <div key={s.label}>
                    <b>{s.value}</b>
                    <span>{s.label}</span>
                  </div>
                ))}
              </div>
              <button type="button" className="btn btn--quiet btn--sm" id="bell-btn" onClick={() => go("settings")}>
                <Ic name="bell" />
                <span className="sr">Announcements</span>
                {stats.hasNews && <i className="dot" aria-hidden="true" />}
              </button>
              <button type="button" className="btn btn--solid btn--sm" onClick={() => openBrief()}>
                <Ic name="plus" />
                New work
              </button>
            </div>
          </header>

          <main className="canvas" id="canvas" tabIndex={-1}>
            <PanelSwitch route={route} />
          </main>
        </div>
      </div>

      <HubPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        panels={panels}
        onGo={go}
        onOpenWork={openWork}
        onBrief={openBrief}
      />

      <BriefDialog
        agentId={briefFor}
        onClose={() => setBriefFor(null)}
        onToast={fire}
        onOpenWork={openWork}
        onQueued={bumpRevision}
      />

      <HubToasts toasts={toasts} onDismiss={dismiss} />
    </HubProvider>
  );
}
