"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Sidebar, StatsBar } from "@/components/console/Chrome";
import { HomeView, AgentsView, TeamsView, SettingsView } from "@/components/console/Views";
import { IntegrationsView } from "@/components/console/IntegrationsView";
import { isAgentLive, LIVE_AGENTS } from "@/lib/console-data";
import { AgentChat } from "@/components/console/AgentChat";
import { GraphicsStudioV2 } from "@/components/console/gd2/GraphicsStudioV2";
import { MarketingResearch } from "@/components/console/mr/MarketingResearch";
import { LibraryView } from "@/components/console/LibraryView";
import { AdminView } from "@/components/console/AdminView";
import { DatabaseView } from "@/components/console/DatabaseView";
import { ImageLibraryView } from "@/components/console/ImageLibraryView";
import { AgentConfigView } from "@/components/console/AgentConfigView";
import { Icon } from "@/lib/kit-ui";
import { WorkProvider, useIsWorking } from "@/lib/work";

function WorkBar() {
  const working = useIsWorking();
  return (
    <div className={`cworkbar${working ? " cworkbar--on" : ""}`} role="status" aria-live="polite" aria-hidden={!working}>
      <Icon name="loader-circle" size={15} className="cworkbar__spin" />
      <span>Working…</span>
    </div>
  );
}

// Views that can be reflected in the URL so a reload restores the current page.
const NAV_VIEWS = [
  "home",
  "agents",
  "teams",
  "workspace",
  "studio",
  "marketing",
  "library",
  "imagelib",
  "admin",
  "database",
  "agentcfg",
  "settings",
  "integrations",
] as const;

type NavView = (typeof NAV_VIEWS)[number];

function isNavView(value: string): value is NavView {
  return (NAV_VIEWS as readonly string[]).includes(value);
}

// Some views are permission-gated; don't restore one the user can't access.
function canAccess(view: NavView, user: { is_admin?: boolean; is_creator?: boolean }): boolean {
  if (view === "admin" || view === "database" || view === "imagelib") return !!user.is_admin;
  if (view === "agentcfg") return !!user.is_creator;
  return true;
}

function readNavFromHash(): NavView | null {
  if (typeof window === "undefined") return null;
  const raw = window.location.hash.replace(/^#\/?/, "");
  return isNavView(raw) ? raw : null;
}

function Toast({ toast }: { toast: { msg: string; k: number } | null }) {
  if (!toast) return null;
  return (
    <div className="ctoast" key={toast.k}>
      <span className="ctoast__ic">
        <Icon name="check" />
      </span>
      <span>{toast.msg}</span>
    </div>
  );
}

export default function ConsoleApp() {
  const { user, logout } = useAuth();
  const [nav, setNav] = useState("home");
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ msg: string; k: number } | null>(null);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore the view from the URL hash on first load (so a reload keeps you in
  // place instead of bouncing to home), and follow browser back/forward.
  useEffect(() => {
    if (!user) return;
    const sync = () => {
      const fromHash = readNavFromHash();
      if (fromHash && canAccess(fromHash, user)) setNav(fromHash);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.is_admin, user?.is_creator]);

  // Keep the URL hash in sync with the current view. replaceState avoids
  // piling up history entries while still surviving a reload.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const target = `#/${nav}`;
    if (window.location.hash !== target) {
      window.history.replaceState(null, "", target);
    }
  }, [nav]);

  const fire = useCallback((msg: string) => {
    setToast({ msg, k: Date.now() });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  if (!user) return null;

  const onAdd = (id: string) => {
    setAdded((p) => ({ ...p, [id]: !p[id] }));
    fire(added[id] ? "Removed from team" : "Added to team");
  };

  const onOpenAgent = (id: string) => {
    if (!isAgentLive(id)) {
      fire("This agent is coming soon.");
      return;
    }
    setNav(LIVE_AGENTS[id]);
  };

  return (
    <WorkProvider>
    <div className="capp">
      <Sidebar nav={nav} setNav={setNav} user={user} isAdmin={user.is_admin} isCreator={user.is_creator} onLogout={logout} />
      <div className="cmain">
        <WorkBar />
        {nav !== "workspace" && nav !== "studio" && <StatsBar />}
        <div className="cscroll" style={nav === "workspace" || nav === "studio" ? { overflow: "hidden" } : undefined}>
          {nav === "home" && (
            <HomeView
              onOpenAgents={() => setNav("agents")}
              onOpenAgent={onOpenAgent}
              onAdd={onAdd}
              added={added}
              userName={user.name || user.email}
            />
          )}
          {nav === "agents" && <AgentsView onOpenAgent={onOpenAgent} />}
          {nav === "teams" && <TeamsView />}
          {nav === "workspace" && <AgentChat onToast={fire} onBack={() => setNav("agents")} />}
          {nav === "studio" && <GraphicsStudioV2 onToast={fire} onBack={() => setNav("agents")} />}
          {nav === "marketing" && <MarketingResearch onToast={fire} onBack={() => setNav("agents")} />}
          {nav === "library" && <LibraryView onBack={() => setNav("workspace")} />}
          {nav === "imagelib" && user.is_admin && <ImageLibraryView onBack={() => setNav("home")} />}
          {nav === "admin" && user.is_admin && <AdminView onBack={() => setNav("home")} />}
          {nav === "database" && user.is_admin && <DatabaseView onBack={() => setNav("home")} />}
          {nav === "agentcfg" && user.is_creator && <AgentConfigView onBack={() => setNav("home")} />}
          {nav === "settings" && <SettingsView userName={user.name || user.email} userEmail={user.email} />}
          {nav === "integrations" && <IntegrationsView onToast={fire} />}
        </div>
      </div>
      <Toast toast={toast} />
    </div>
    </WorkProvider>
  );
}
