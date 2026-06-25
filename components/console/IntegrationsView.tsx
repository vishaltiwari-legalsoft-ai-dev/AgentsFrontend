"use client";

import { useState } from "react";
import { Button, Badge } from "@/lib/kit-ui";
import { gdRefSyncDrive } from "@/lib/api";

interface Integration {
  id: string;
  name: string;
  logo: string; // file in /public/logo
  category: string;
  description: string;
}

const INTEGRATIONS: Integration[] = [
  {
    id: "hubspot",
    name: "HubSpot",
    logo: "hubspot",
    category: "CRM & Marketing",
    description: "Sync contacts and campaigns, and push generated creatives straight into your HubSpot marketing hub.",
  },
  {
    id: "google",
    name: "Google Workspace",
    logo: "google",
    category: "Productivity",
    description: "Single sign-on with Google, save creatives to Drive, and pull briefs from Docs & Sheets.",
  },
  {
    id: "slack",
    name: "Slack",
    logo: "slack",
    category: "Messaging",
    description: "Get run notifications and approve or reject creatives right from your team channels.",
  },
  {
    id: "google-sheets",
    name: "Google Sheets",
    logo: "google-sheets",
    category: "Data & Spreadsheets",
    description: "Pull briefs, product data and copy from Sheets, and export campaign results back to a spreadsheet.",
  },
  {
    id: "google-drive",
    name: "Google Drive",
    logo: "google-drive",
    category: "Storage",
    description: "Save generated creatives and brand assets straight to a shared Drive folder your team can access.",
  },
  {
    id: "figma",
    name: "Figma",
    logo: "figma",
    category: "Design",
    description: "Import brand frames and components from Figma, and push generated designs back as new frames.",
  },
];

export function IntegrationsView({ onToast }: { onToast?: (msg: string) => void }) {
  // Google starts "connected" to mirror the Google sign-in already used for auth.
  const [connected, setConnected] = useState<Record<string, boolean>>({ google: true });
  const [syncing, setSyncing] = useState(false);

  function toggle(id: string, name: string) {
    setConnected((prev) => {
      const next = !prev[id];
      onToast?.(next ? `${name} connected` : `${name} disconnected`);
      return { ...prev, [id]: next };
    });
  }

  // Pull the shared Drive folder of on-brand references into the agent's library.
  async function syncDrive() {
    if (syncing) return;
    setSyncing(true);
    onToast?.("Syncing reference creatives from Google Drive…");
    try {
      const r = await gdRefSyncDrive();
      const types = Object.entries(r.by_type)
        .map(([t, n]) => `${n} ${t}`)
        .join(", ");
      onToast?.(
        `Drive sync complete — ingested ${r.ingested} reference${r.ingested === 1 ? "" : "s"}` +
          (types ? ` (${types})` : "") +
          (r.skipped_folders.length ? `. Skipped: ${r.skipped_folders.join(", ")}` : ""),
      );
    } catch (e) {
      onToast?.(`Drive sync failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="cview" style={{ maxWidth: 1080 }}>
      <div className="csechead">
        <div>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, margin: 0 }}>Integrations</h3>
          <div style={{ fontSize: 13.5, color: "var(--text-secondary)", marginTop: 4 }}>
            Connect your tools so agents can work where your team already does.
          </div>
        </div>
      </div>

      <div className="cgrid cgrid--3">
        {INTEGRATIONS.map((it) => {
          const on = !!connected[it.id];
          return (
            <div className="cintg" key={it.id}>
              <div className="cintg__top">
                <span className="logotile">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/logo/${it.logo}.svg`} alt={`${it.name} logo`} width={28} height={28} style={{ objectFit: "contain" }} />
                </span>
                {on ? (
                  <Badge variant="success" dot>
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="outline">Not connected</Badge>
                )}
              </div>
              <div className="cintg__id">
                <div className="cintg__name">{it.name}</div>
                <div className="cintg__cat">{it.category}</div>
              </div>
              <p className="cintg__desc">{it.description}</p>
              <div className="cintg__foot">
                {it.id === "google-drive" ? (
                  <Button size="sm" variant="brand" onClick={syncDrive} disabled={syncing}>
                    {syncing ? "Syncing…" : "Sync references"}
                  </Button>
                ) : (
                  <Button size="sm" variant={on ? "secondary" : "brand"} onClick={() => toggle(it.id, it.name)}>
                    {on ? "Disconnect" : "Connect"}
                  </Button>
                )}
                {it.id === "google-drive" ? (
                  <span className="cintg__cat" style={{ alignSelf: "center" }}>
                    Pulls on-brand reference creatives into the agent
                  </span>
                ) : on ? (
                  <button type="button" className="cintg__manage" onClick={() => onToast?.(`${it.name} settings — coming soon`)}>
                    Manage
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
