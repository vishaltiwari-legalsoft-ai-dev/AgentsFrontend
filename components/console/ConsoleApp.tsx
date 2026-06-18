"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listConversations } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Sidebar, NewsBar } from "@/components/console/Chrome";
import { HomeView, AgentsView, TeamsView, SettingsView } from "@/components/console/Views";
import { IntegrationsView } from "@/components/console/IntegrationsView";
import { isAgentLive } from "@/lib/console-data";
import { AgentChat } from "@/components/console/AgentChat";
import { GraphicsStudio } from "@/components/console/GraphicsStudio";
import { LibraryView } from "@/components/console/LibraryView";
import { AdminView } from "@/components/console/AdminView";
import { AgentConfigView } from "@/components/console/AgentConfigView";
import { Icon } from "@/lib/kit-ui";

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
  const [mode, setMode] = useState("agents");
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ msg: string; k: number } | null>(null);
  const [convCount, setConvCount] = useState(0);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fire = useCallback((msg: string) => {
    setToast({ msg, k: Date.now() });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  useEffect(() => {
    listConversations()
      .then((c) => setConvCount(c.length))
      .catch(() => undefined);
  }, [nav]);

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
    setNav("studio");
  };

  return (
    <div className="capp">
      <Sidebar nav={nav} setNav={setNav} user={user} isAdmin={user.is_admin} isCreator={user.is_creator} onLogout={logout} />
      <div className="cmain">
        {nav !== "workspace" && nav !== "studio" && <NewsBar />}
        <div className="cscroll" style={nav === "workspace" || nav === "studio" ? { overflow: "hidden" } : undefined}>
          {nav === "home" && (
            <HomeView
              mode={mode}
              setMode={setMode}
              onOpenAgents={() => setNav("agents")}
              onOpenAgent={onOpenAgent}
              onAdd={onAdd}
              added={added}
              userName={user.name || user.email}
              convCount={convCount}
            />
          )}
          {nav === "agents" && <AgentsView onOpenAgent={onOpenAgent} />}
          {nav === "teams" && <TeamsView />}
          {nav === "workspace" && <AgentChat onToast={fire} onBack={() => setNav("agents")} />}
          {nav === "studio" && <GraphicsStudio onToast={fire} onBack={() => setNav("agents")} />}
          {nav === "library" && <LibraryView onBack={() => setNav("workspace")} />}
          {nav === "admin" && user.is_admin && <AdminView onBack={() => setNav("home")} />}
          {nav === "agentcfg" && user.is_creator && <AgentConfigView onBack={() => setNav("home")} />}
          {nav === "settings" && <SettingsView userName={user.name || user.email} userEmail={user.email} />}
          {nav === "integrations" && <IntegrationsView onToast={fire} />}
        </div>
      </div>
      <Toast toast={toast} />
    </div>
  );
}
