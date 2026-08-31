"use client";

/** What the canvas shows for the current route.
 *
 *  The console is being moved onto the new design one surface at a time, and
 *  this is where the seam sits. All eight console panels are rebuilt. The five
 *  specialist workspaces are not, and render the working screens they have
 *  always had inside `.legacy`, which pins the one design token the two systems
 *  disagree on so nothing shifts underneath them.
 *
 *  The seam is a list rather than a scatter of conditionals, so what is left is
 *  countable and removing the last entry is a deliberate commit.
 */

import { useHub } from "./context";
import type { Route } from "./model";
import { agentBySlug } from "./model";
import { HomeView } from "./panels/HomeView";
import { IssuesView } from "./panels/IssuesView";
import { AgentsView } from "./panels/AgentsView";
import { RunsView } from "./panels/RunsView";
import { LibraryView } from "./panels/LibraryView";
import { ModelsView } from "./panels/ModelsView";
import { IntegrationsView } from "./panels/IntegrationsView";
import { SettingsView } from "./panels/SettingsView";
import { AdminView } from "./panels/AdminView";
import { GeoWorkspace } from "./work/GeoWorkspace";
import { MrWorkspace } from "./work/MrWorkspace";

import { GraphicsStudioV2 } from "@/components/console/gd2/GraphicsStudioV2";
import { SeoAgent } from "@/components/console/seo/SeoAgent";
import { BlogWriter } from "@/components/console/blogwriter/BlogWriter";

/** The surfaces still rendering their pre-revamp markup. */
export const LEGACY = ["w/art", "w/seo", "w/blog"] as const;

function Legacy({ children }: { children: React.ReactNode }) {
  return <div className="legacy">{children}</div>;
}

export function PanelSwitch({ route }: { route: Route }) {
  const { toast, go, closeWork } = useHub();

  if (route.work) {
    const agent = agentBySlug(route.work.slug);
    if (!agent) {
      go("agents");
      return null;
    }
    // Rebuilt workspaces render straight onto the canvas. The rest still render
    // the screens they have always had, inside the wrapper that pins the one
    // token the two design systems disagree on.
    if (agent.id === "a10") {
      return <GeoWorkspace subject={route.work.subject} section={route.work.section} />;
    }
    if (agent.id === "a6") {
      return <MrWorkspace subject={route.work.subject} section={route.work.section} />;
    }
    const back = () => closeWork();
    return (
      <Legacy>
        {agent.id === "a1" && <GraphicsStudioV2 onToast={toast} onBack={back} />}
        {agent.id === "a2" && <SeoAgent onToast={toast} onBack={back} />}
        {agent.id === "a9" && <BlogWriter onToast={toast} onBack={back} />}
      </Legacy>
    );
  }

  switch (route.panel) {
    case "home": return <HomeView />;
    case "issues": return <IssuesView />;
    case "agents": return <AgentsView />;
    case "runs": return <RunsView />;
    case "library": return <LibraryView />;
    case "models": return <ModelsView />;
    case "integrations": return <IntegrationsView />;
    case "settings": return <SettingsView />;
    case "admin": return <AdminView />;
    default: return <HomeView />;
  }
}
