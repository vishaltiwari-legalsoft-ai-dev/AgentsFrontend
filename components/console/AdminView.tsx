"use client";

import { useEffect, useState } from "react";
import {
  getAdminAnalytics,
  getAdminUsers,
  getAdminSettings,
  updateAdminSettings,
  testOpenRouterKey,
  type AdminUser,
  type Analytics,
  type AdminSettings,
  type AdminSettingsPatch,
} from "@/lib/api";
import { Icon, Button, Avatar } from "@/lib/kit-ui";
import { GlyphTile } from "@/lib/glyph";
import { useAuth } from "@/lib/auth";

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

export function AdminView({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const isCreator = !!user?.is_creator;
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Secrets & Integrations form state.
  const [cfg, setCfg] = useState<AdminSettings | null>(null);
  const [keyDraft, setKeyDraft] = useState("");
  const [models, setModels] = useState({ model: "", fast_model: "", image_model: "", vision_model: "" });
  const [saving, setSaving] = useState(false);
  const [secretMsg, setSecretMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const loadSettings = () =>
    getAdminSettings().then((s) => {
      setCfg(s);
      setModels({
        model: s.openrouter.model,
        fast_model: s.openrouter.fast_model,
        image_model: s.openrouter.image_model,
        vision_model: s.openrouter.vision_model,
      });
    });

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
    if (isCreator) loadSettings().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isCreator]);

  const saveSecrets = async () => {
    setSaving(true);
    setSecretMsg(null);
    try {
      const patch: AdminSettingsPatch = {
        openrouter_model: models.model,
        openrouter_fast_model: models.fast_model,
        openrouter_image_model: models.image_model,
        openrouter_vision_model: models.vision_model,
      };
      // Only send the key if the admin typed a new one (blank = leave as-is).
      if (keyDraft.trim()) patch.openrouter_api_key = keyDraft.trim();
      const next = await updateAdminSettings(patch);
      setCfg(next);
      setKeyDraft("");
      setSecretMsg({ kind: "ok", text: "Settings saved." });
    } catch (err) {
      setSecretMsg({ kind: "err", text: err instanceof Error ? err.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  const testKey = async () => {
    setSecretMsg(null);
    try {
      const r = await testOpenRouterKey();
      setSecretMsg({
        kind: "ok",
        text: `Key works${r.label ? ` (${r.label})` : ""}${r.is_free_tier ? " · free tier" : ""}.`,
      });
    } catch (err) {
      setSecretMsg({ kind: "err", text: err instanceof Error ? err.message : "Test failed" });
    }
  };

  const maxMonthly = analytics ? Math.max(1, ...analytics.monthly.map((m) => m.count)) : 1;

  return (
    <div className="cview" style={{ maxWidth: "100%" }}>
      <div className="csechead">
        <div>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name={isCreator ? "shield-check" : "shield"} /> {isCreator ? "Creator" : "Super admin"}
            {isCreator && (
              <span style={{ padding: "2px 9px", borderRadius: 99, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.04em", background: "var(--grad-brand)", color: "#fff" }}>
                OWNER
              </span>
            )}
          </h3>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
            {isCreator
              ? "Full owner access — manage secrets & integrations, plus the user directory and analytics."
              : "User directory and creative-request analytics."}
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

      {/* Secrets & Integrations — Creator-only runtime config (OpenRouter). */}
      {isCreator && (
      <section style={{ background: "var(--glass)", backdropFilter: "var(--glass-blur)", WebkitBackdropFilter: "var(--glass-blur)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-2xl)", padding: 24, boxShadow: "var(--shadow-xs), var(--glass-edge)" }}>
        <h4 style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 6px", color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="lock" size={13} /> Secrets &amp; Integrations
          <span style={{ marginLeft: 4, padding: "2px 8px", borderRadius: 99, fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", background: "var(--grad-brand)", color: "#fff" }}>CREATOR</span>
        </h4>
        <p style={{ fontSize: 12.5, color: "var(--text-secondary)", margin: "0 0 18px", lineHeight: 1.5 }}>
          Set the OpenRouter API key and models here instead of in the server environment. Stored securely
          server-side; the key is never shown again after saving.
        </p>

        {/* OpenRouter API key */}
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
          OpenRouter API key
          {cfg?.openrouter.api_key_set && (
            <span style={{ marginLeft: 8, fontWeight: 500, color: "var(--text-tertiary)" }}>
              currently set: {cfg.openrouter.api_key_hint} · {cfg.openrouter.api_key_source === "override" ? "saved here" : "from environment"}
            </span>
          )}
        </label>
        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          <input
            type="password"
            value={keyDraft}
            placeholder={cfg?.openrouter.api_key_set ? "Enter a new key to replace it…" : "sk-or-v1-…"}
            autoComplete="off"
            onChange={(e) => setKeyDraft(e.target.value)}
            style={{ flex: 1, padding: "9px 12px", borderRadius: "var(--radius-lg)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-primary)", fontSize: 13, fontFamily: "var(--font-mono)" }}
          />
          <Button variant="secondary" size="sm" onClick={testKey} disabled={!cfg?.openrouter.api_key_set}>
            Test key
          </Button>
        </div>

        {/* Global default models — curated dropdowns. These are the platform-wide
            fallback; per-agent overrides live in the Agent configuration panel. */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
          {([
            ["model", "openrouter_model", "Reasoning model"],
            ["fast_model", "openrouter_fast_model", "Fast / parsing model"],
            ["image_model", "openrouter_image_model", "Image model"],
            ["vision_model", "openrouter_vision_model", "Vision model"],
          ] as const).map(([key, field, label]) => {
            const options = cfg?.catalog?.[field] ?? [];
            const current = models[key];
            const known = options.some((m) => m.id === current);
            return (
              <label key={key} style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                {label}
                <select
                  value={current}
                  onChange={(e) => setModels((m) => ({ ...m, [key]: e.target.value }))}
                  style={{ width: "100%", marginTop: 5, padding: "8px 11px", borderRadius: "var(--radius-lg)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-primary)", fontSize: 12.5 }}
                >
                  {/* Preserve a value that isn't in the catalog (e.g. an env default). */}
                  {current && !known && <option value={current}>{current} (current)</option>}
                  {options.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                      {m.recommended ? " ★" : ""} — {m.provider}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Button size="sm" onClick={saveSecrets} disabled={saving}>
            {saving ? "Saving…" : "Save settings"}
          </Button>
          {secretMsg && (
            <span style={{ fontSize: 12.5, color: secretMsg.kind === "ok" ? "var(--success, #16a34a)" : "var(--danger, #dc2626)" }}>
              {secretMsg.text}
            </span>
          )}
        </div>
      </section>
      )}

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
