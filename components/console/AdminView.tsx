"use client";

import { useEffect, useState } from "react";
import { getAdminAnalytics, getAdminUsers, type AdminUser, type Analytics } from "@/lib/api";
import { Icon, Button, Avatar } from "@/lib/kit-ui";
import { GlyphTile } from "@/lib/glyph";

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

export function AdminView({ onBack }: { onBack: () => void }) {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getAdminUsers(), getAdminAnalytics()])
      .then(([u, a]) => {
        if (cancelled) return;
        setUsers(u.users);
        setAnalytics(a);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const maxMonthly = analytics ? Math.max(1, ...analytics.monthly.map((m) => m.count)) : 1;

  return (
    <div className="cview" style={{ maxWidth: "100%" }}>
      <div className="csechead">
        <div>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="shield" /> Super admin
          </h3>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
            User directory and creative-request analytics.
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={onBack}>
          Back
        </Button>
      </div>

      {error && (
        <div style={{ background: "var(--danger-bg)", color: "var(--danger)", padding: 14, borderRadius: "var(--radius-lg)", fontSize: 13 }}>
          {error}
        </div>
      )}

      <div className="cstatrow">
        <div className="cstat">
          <GlyphTile glyph="teams" tint="ads" size={40} glyphSize={21} />
          <div>
            <div className="cstat__val">{users ? users.length : "—"}</div>
            <div className="cstat__lbl">Total users</div>
          </div>
        </div>
        <div className="cstat">
          <GlyphTile glyph="data" tint="seo" size={40} glyphSize={21} />
          <div>
            <div className="cstat__val">{analytics ? analytics.total_requests : "—"}</div>
            <div className="cstat__lbl">Total requests</div>
          </div>
        </div>
        <div className="cstat">
          <GlyphTile glyph="clock" tint="copy" size={40} glyphSize={21} />
          <div>
            <div className="cstat__val">{analytics ? analytics.monthly.length : "—"}</div>
            <div className="cstat__lbl">Active months</div>
          </div>
        </div>
      </div>

      {analytics && analytics.monthly.length > 0 && (
        <section style={{ background: "var(--glass)", backdropFilter: "var(--glass-blur)", WebkitBackdropFilter: "var(--glass-blur)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-2xl)", padding: 24, boxShadow: "var(--shadow-xs), var(--glass-edge)" }}>
          <h4 style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 16px", color: "var(--text-tertiary)" }}>Requests — month on month</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {analytics.monthly.map((m) => (
              <div key={m.month} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, width: 56, color: "var(--text-tertiary)" }}>{m.month}</span>
                <div style={{ flex: 1, background: "var(--gray-100)", borderRadius: 99, height: 8, overflow: "hidden" }}>
                  <div style={{ height: "100%", background: "var(--grad-brand)", width: `${(m.count / maxMonthly) * 100}%`, borderRadius: 99 }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, width: 32, textAlign: "right" }}>{m.count}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section style={{ background: "var(--glass)", backdropFilter: "var(--glass-blur)", WebkitBackdropFilter: "var(--glass-blur)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-2xl)", overflow: "hidden", boxShadow: "var(--shadow-xs), var(--glass-edge)" }}>
        <h4 style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", margin: "18px 22px 12px", color: "var(--text-tertiary)" }}>User directory</h4>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderTop: "1px solid var(--border-subtle)", borderBottom: "1px solid var(--border-subtle)", color: "var(--text-tertiary)", fontSize: 11, textTransform: "uppercase" }}>
              <th style={{ textAlign: "left", padding: "10px 20px" }}>User</th>
              <th style={{ textAlign: "left", padding: "10px 20px" }}>Email</th>
              <th style={{ textAlign: "left", padding: "10px 20px" }}>Joined</th>
              <th style={{ textAlign: "left", padding: "10px 20px" }}>Last login</th>
            </tr>
          </thead>
          <tbody>
            {users?.map((u) => (
              <tr key={u.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <td style={{ padding: "12px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Avatar name={u.name || u.email} src={u.picture} size="sm" />
                    <span style={{ fontWeight: 500 }}>{u.name || "—"}</span>
                  </div>
                </td>
                <td style={{ padding: "12px 20px", color: "var(--text-secondary)" }}>{u.email}</td>
                <td style={{ padding: "12px 20px", color: "var(--text-tertiary)" }}>{formatDate(u.created_at)}</td>
                <td style={{ padding: "12px 20px", color: "var(--text-tertiary)" }}>{formatDate(u.last_login)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
