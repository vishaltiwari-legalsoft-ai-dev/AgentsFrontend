"use client";

import { useCallback, useEffect, useState } from "react";
import { mrSnapshotCapture, mrSnapshotDeltas, type MrVendorDelta } from "@/lib/api";
import { Button, Icon } from "@/lib/kit-ui";
import { fmtMoney, fmtNum } from "./shared";

const HEADLINE: { path: string; label: string; money: boolean }[] = [
  { path: "spend.performance", label: "Spend", money: true },
  { path: "leads.total", label: "Leads", money: false },
  { path: "leads.qualified", label: "Qualified", money: false },
  { path: "demos.total_booked_all", label: "Demos booked", money: false },
  { path: "demos.completed_all", label: "Demos completed", money: false },
];

function sign(n: number | null, money: boolean): string {
  if (n === null || n === undefined) return "—";
  if (n === 0) return money ? "$0" : "0";
  const v = money ? fmtMoney(Math.abs(n)) : fmtNum(Math.abs(n));
  return n < 0 ? `▼ ${v}` : `▲ ${v}`;
}

export function DailyMovement({ onToast }: { onToast: (m: string) => void }) {
  const [deltas, setDeltas] = useState<MrVendorDelta[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const load = useCallback(() => {
    mrSnapshotDeltas().then(setDeltas).catch(() => setDeltas([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function snapshotNow() {
    setBusy(true);
    onToast("Freezing today's tracker state…");
    try {
      const res = await mrSnapshotCapture();
      const ok = res.tabs.filter((t) => t.captured).length;
      const errs = res.tabs.filter((t) => t.error).length;
      onToast(errs ? `Captured ${ok} tabs · ${errs} error(s)` : `Captured ${ok} vendor tabs for ${res.date}`);
      load();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Snapshot failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mr-dm">
      <div className="mr-dm__head">
        <h3 className="mr-section__title">
          Daily movement
          {deltas?.length ? <span className="mr-dm__date"> · {deltas[0].date}</span> : null}
        </h3>
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => void snapshotNow()}
          iconLeft={<Icon name={busy ? "loader-circle" : "camera"} size={13} className={busy ? "cworkbar__spin" : undefined} />}>
          Snapshot now
        </Button>
      </div>

      {deltas === null ? (
        <div className="mr-empty">Reading snapshots…</div>
      ) : deltas.length === 0 ? (
        <div className="mr-empty">No snapshots yet — hit &ldquo;Snapshot now&rdquo; after today&apos;s sheet update to start the daily history.</div>
      ) : (
        <div className="mr-dm__grid">
          {deltas.map((d) => {
            const t = d.blocks.team_overall.additive;
            const isOpen = !!open[d.vendor_slug];
            const spend = t[HEADLINE[0].path];
            return (
              <button
                type="button"
                className="mr-dm__card"
                key={d.vendor_slug}
                data-open={isOpen ? "1" : "0"}
                aria-expanded={isOpen}
                onClick={() => setOpen((p) => ({ ...p, [d.vendor_slug]: !p[d.vendor_slug] }))}
              >
                <div className="mr-dm__vendor">
                  <span>{d.vendor}</span>
                  {d.month_start && <span className="badge-note">month start</span>}
                  {!d.month_start && d.days > 1 && <span className="badge-note">since {d.since} · {d.days}d</span>}
                  {d.corrected && <span className="badge-note badge-note--warn">corrected</span>}
                  <span className="mr-dm__spacer" />
                  {!isOpen && <b className="mr-dm__spend">{sign(spend?.delta ?? null, true)}</b>}
                  <Icon name="chevron-down" size={14} className="mr-dm__chev" />
                </div>
                {isOpen && (
                  <div className="mr-dm__rows">
                    {HEADLINE.map((h) => {
                      const f = t[h.path];
                      return (
                        <div className="mr-dm__row" key={h.path}>
                          <span>{h.label}</span>
                          <b className={f?.corrected ? "mr-dm__neg" : undefined}>{sign(f?.delta ?? null, h.money)}</b>
                          <small>MTD {h.money ? fmtMoney(f?.mtd) : fmtNum(f?.mtd)}</small>
                        </div>
                      );
                    })}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
