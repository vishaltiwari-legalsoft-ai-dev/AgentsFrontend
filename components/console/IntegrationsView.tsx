"use client";

import { useState } from "react";
import type { ToastFn } from "@/components/console/ConsoleApp";
import { Button, Badge } from "@/lib/kit-ui";
import { gdRefSyncDrive } from "@/lib/api";

interface Integration {
  id: string;
  name: string;
  logo: string; // file in /public/logo
  category: string;
  description: string;
}

// Only integrations that actually do something are listed. HubSpot, Slack,
// Google Sheets and Figma used to render here with a Connect button that
// flipped a useState and fired "<name> connected" without making a request —
// a user waiting on Slack notifications would wait forever.
const INTEGRATIONS: Integration[] = [
  {
    id: "google",
    name: "Google Workspace",
    logo: "google",
    category: "Productivity",
    description: "Signing in to this console uses your Google account. Nothing else in Workspace is connected.",
  },
  {
    id: "google-drive",
    name: "Google Drive",
    logo: "google-drive",
    category: "Storage",
    description: "Save generated creatives and brand assets straight to a shared Drive folder your team can access.",
  },
];

export function IntegrationsView({ onToast }: { onToast?: ToastFn }) {
  const [syncing, setSyncing] = useState(false);

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
      onToast?.(`Drive sync failed: ${e instanceof Error ? e.message : String(e)}`, "error");
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
        {INTEGRATIONS.map((it) => (
          <div className="cintg" key={it.id}>
            <div className="cintg__top">
              <span className="logotile">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/logo/${it.logo}.svg`} alt={`${it.name} logo`} width={28} height={28} style={{ objectFit: "contain" }} />
              </span>
              {it.id === "google" ? (
                <Badge variant="neutral">Used for sign-in</Badge>
              ) : (
                <Badge variant="outline">Not connected</Badge>
              )}
            </div>
            <div className="cintg__id">
              <div className="cintg__name">{it.name}</div>
              <div className="cintg__cat">{it.category}</div>
            </div>
            <p className="cintg__desc">{it.description}</p>
            {it.id === "google-drive" ? (
              <div className="cintg__foot">
                <Button size="sm" variant="brand" onClick={syncDrive} disabled={syncing}>
                  {syncing ? "Syncing…" : "Sync references"}
                </Button>
                <span className="cintg__cat" style={{ alignSelf: "center" }}>
                  Pulls on-brand reference creatives into the agent
                </span>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div style={{ fontSize: 13.5, color: "var(--text-secondary)", marginTop: 18 }}>
        More integrations are not built yet.
      </div>
    </div>
  );
}
