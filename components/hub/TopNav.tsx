"use client";

/** The revamped shell header — everything the dark rail used to hold, laid
 *  across the top of a pure-white page.
 *
 *  Work and Assets panels sit inline as pills; the Setup group folds into one
 *  menu so ten destinations never fight for one row; search, announcements and
 *  "New work" keep their places on the right; identity, appearance and
 *  sign-out live under the avatar. Workspaces still render the rail — this
 *  header only dresses the panel views (see HubApp).
 */

import { useEffect, useRef, useState } from "react";
import { AvatarDialog, UserAvatar, useAvatarStyle } from "./avatar";
import { Ic } from "./Sprite";
import type { panelsFor } from "./model";
import type { PanelId, Route } from "./model";

export default function TopNav({
  route, panels, counts, onGo, onOpenPalette, dark, onTheme, user, onLogout,
  hasNews, onBell, onNewWork, usage,
}: {
  route: Route;
  panels: ReturnType<typeof panelsFor>;
  counts: Partial<Record<PanelId, number>>;
  onGo: (id: PanelId) => void;
  onOpenPalette: () => void;
  dark: boolean;
  onTheme: () => void;
  user: { name: string; email: string; is_admin?: boolean; is_creator?: boolean; is_geo_only?: boolean };
  onLogout: () => void;
  hasNews: boolean;
  onBell: () => void;
  onNewWork: () => void;
  /** How much the agents have been used — absent until the record answers. */
  usage?: { runs?: number; live: number };
}) {
  const [menu, setMenu] = useState<"setup" | "user" | null>(null);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [avatarStyle, saveAvatarStyle] = useAvatarStyle(user.email);
  const barRef = useRef<HTMLElement>(null);

  // Any press outside the bar, or Escape, closes whichever menu is open.
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const primary = panels.filter((p) => p.group !== "Setup");
  const setup = panels.filter((p) => p.group === "Setup");
  const setupOn = setup.some((p) => p.id === route.panel);

  const tier = user.is_geo_only
    ? "GEO only"
    : user.is_creator ? "creator" : user.is_admin ? "admin" : "member";

  const go = (id: PanelId) => {
    setMenu(null);
    onGo(id);
  };

  return (
    <header className="tnav" ref={barRef}>
      {/* the usage strip: how much work the staff has actually done */}
      {usage?.runs != null && (
        <div className="usebar">
          <span className="usebar__in">
            <Ic name="runs" />
            Agents put to work
            <b>{usage.runs.toLocaleString("en-US")}</b>
            times
            <i aria-hidden="true" />
            {usage.live} specialist{usage.live === 1 ? "" : "s"} live
          </span>
        </div>
      )}
      <div className="tnav__in">
        <button type="button" className="tnav__brand" onClick={() => go("home")} title="Home">
          <span className="tnav__glyph" aria-hidden="true" />
          <span className="tnav__names">
            <b>AgentHub</b>
            <em>Legal Soft · Marketing</em>
          </span>
        </button>

        <nav className="tnav__nav" aria-label="Sections">
          {primary.map((p) => {
            const on = p.id === route.panel;
            const c = counts[p.id];
            return (
              <button
                type="button"
                key={p.id}
                className={`tnav__item${on ? " is-on" : ""}`}
                aria-current={on ? "page" : undefined}
                title={p.label}
                onClick={() => go(p.id)}
              >
                <Ic name={p.icon} />
                <span>{p.label}</span>
                {c !== undefined && c > 0 && <span className="tnav__count">{c.toLocaleString("en-US")}</span>}
              </button>
            );
          })}

          {setup.length > 0 && (
            <div className="tnav__drop">
              <button
                type="button"
                className={`tnav__item${setupOn ? " is-on" : ""}${menu === "setup" ? " is-open" : ""}`}
                aria-expanded={menu === "setup"}
                aria-haspopup="menu"
                onClick={() => setMenu(menu === "setup" ? null : "setup")}
              >
                <Ic name="settings" />
                <span>Setup</span>
                <i className="tnav__caret" aria-hidden="true"><Ic name="chevron" /></i>
              </button>
              {menu === "setup" && (
                <div className="tnav__menu tnav__menu--nav" role="menu">
                  {setup.map((p) => {
                    const on = p.id === route.panel;
                    const c = counts[p.id];
                    return (
                      <button
                        type="button"
                        key={p.id}
                        role="menuitem"
                        className={`tnav__mi${on ? " is-on" : ""}`}
                        onClick={() => go(p.id)}
                      >
                        <Ic name={p.icon} />
                        <span>{p.label}</span>
                        {c !== undefined && c > 0 && <span className="tnav__count">{c.toLocaleString("en-US")}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </nav>

        <div className="tnav__ops">
          <button type="button" className="tnav__ic tnav__search" onClick={onOpenPalette} title="Search — Ctrl K">
            <Ic name="search" />
            <span className="tnav__slabel">Search</span>
            <kbd>Ctrl K</kbd>
          </button>
          <button type="button" className="tnav__ic" onClick={onBell} title="Announcements">
            <Ic name="bell" />
            <span className="sr">Announcements</span>
            {hasNews && <i className="tnav__dot" aria-hidden="true" />}
          </button>
          <button type="button" className="btn btn--solid btn--sm" onClick={onNewWork}>
            <Ic name="sweep" />
            Request an agent
          </button>

          <div className="tnav__drop">
            <button
              type="button"
              className={`tnav__av${menu === "user" ? " is-open" : ""}`}
              aria-expanded={menu === "user"}
              aria-haspopup="menu"
              title={user.email}
              onClick={() => setMenu(menu === "user" ? null : "user")}
            >
              <UserAvatar name={user.name} email={user.email} style={avatarStyle} size={33} />
            </button>
            {menu === "user" && (
              <div className="tnav__menu tnav__menu--user" role="menu">
                <div className="tnav__who">
                  <b>{user.name || user.email}</b>
                  <em>{user.email}</em>
                  <span className="tnav__tier">{tier}</span>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  className="tnav__mi"
                  onClick={() => { setMenu(null); setAvatarOpen(true); }}
                >
                  <Ic name="kit" />
                  <span>Customize avatar</span>
                </button>
                <button type="button" role="menuitem" className="tnav__mi" aria-pressed={dark} onClick={onTheme}>
                  <Ic name={dark ? "sun" : "moon"} />
                  <span>Appearance</span>
                  <span className="tnav__count">{dark ? "Dark" : "Light"}</span>
                </button>
                <button type="button" role="menuitem" className="tnav__mi" onClick={() => { setMenu(null); onLogout(); }}>
                  <Ic name="x" />
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <AvatarDialog
        open={avatarOpen}
        name={user.name}
        email={user.email}
        style={avatarStyle}
        onSave={saveAvatarStyle}
        onClose={() => setAvatarOpen(false)}
      />
    </header>
  );
}
