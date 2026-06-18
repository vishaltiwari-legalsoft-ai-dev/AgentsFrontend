"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  deleteConversation,
  getAgentSettings,
  getConversation,
  listBrands,
  listConversations,
  runAgent,
  type AgentResult,
  type AgentSettingsConfigResponse,
  type BrandSummary,
  type ConversationSummary,
} from "@/lib/api";
import {
  defaultAgentSettingsConfig,
  loadAgentSettings,
  saveAgentSettings,
  type AgentSettingsValues,
} from "@/lib/agent-settings";
import { graphicDesignerAgent } from "@/lib/console-data";
import { Icon, Button, IconButton, Avatar, Badge, StatusDot } from "@/lib/kit-ui";
import { GlyphTile } from "@/lib/glyph";
import { AgentSettingsPanel } from "@/components/console/AgentSettingsPanel";
import { ResultView } from "@/components/console/ResultPanels";

type Phase = "research" | "generate";

// Step 2/3 — automatic brand intelligence while researching the brand.
const RESEARCH_STEPS = [
  "Visiting the brand website...",
  "Analyzing the brand's design language...",
  "Building the brand persona...",
  "Fetching logo & brand elements from the library...",
];
// Step 5 — decide the creative type and render the design.
const GENERATE_STEPS = [
  "Reading your brief...",
  "Deciding the best creative format...",
  "Composing layout, copy & visual treatment...",
  "Rendering the design with the logo...",
];
const READING_STEP = "Reading attachment(s)...";

interface ThreadMsg {
  id: string;
  role: "user" | "assistant" | "loading" | "error";
  text?: string;
  attachments?: string[];
  result?: AgentResult;
  error?: string;
  statusLabel?: string;
}

const AGENT = graphicDesignerAgent;

export function AgentChat({
  onToast,
  onBack,
}: {
  onToast: (msg: string) => void;
  onBack?: () => void;
}) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ThreadMsg[]>([]);
  const [tab, setTab] = useState<"chat" | "history">("chat");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [settingsConfig, setSettingsConfig] = useState<AgentSettingsConfigResponse | null>(null);
  const [agentSettings, setAgentSettings] = useState<AgentSettingsValues | null>(null);
  const [brands, setBrands] = useState<BrandSummary[]>([]);
  // The brand pinned for the whole conversation; its id is sent on every turn.
  const [selectedBrand, setSelectedBrand] = useState<BrandSummary | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    listConversations()
      .then(setConversations)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    listBrands()
      .then(setBrands)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fallback = defaultAgentSettingsConfig();

    getAgentSettings()
      .then((config) => {
        if (cancelled) return;
        setSettingsConfig(config);
        setAgentSettings(loadAgentSettings(config.defaults));
      })
      .catch(() => {
        if (cancelled) return;
        setSettingsConfig(fallback);
        setAgentSettings(loadAgentSettings(fallback.defaults));
        onToast("Using offline agent settings — restart the backend to sync models.");
      });

    return () => {
      cancelled = true;
    };
  }, [onToast]);

  useEffect(() => {
    if (tab !== "chat") return;
    // Pin to the newest message. rAF waits for layout to settle so tall
    // messages (long pasted briefs) don't strand the scroll at a stale offset.
    const raf = requestAnimationFrame(() => {
      const el = scroller.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(raf);
  }, [messages, tab]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const canva = params.get("canva");
    if (!canva) return;
    if (canva === "connected") onToast("Canva connected. Try import again.");
    else onToast("Canva connection failed.");
    window.history.replaceState({}, "", window.location.pathname);
  }, [onToast]);

  useEffect(() => {
    if (!settingsOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSettingsOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settingsOpen]);

  async function loadConversation(id: string) {
    setCurrentId(id);
    setTab("chat");
    setMessages([]);
    try {
      const convo = await getConversation(id);
      const restored: ThreadMsg[] = [];
      let pendingUser: { text: string; attachments: string[] } | null = null;
      for (const msg of convo.messages) {
        if (msg.role === "user") {
          pendingUser = { text: msg.text || "", attachments: msg.attachments || [] };
        } else if (msg.role === "assistant") {
          restored.push({
            id: `${id}-${restored.length}`,
            role: "assistant",
            text: pendingUser?.text,
            attachments: pendingUser?.attachments,
            result: msg.result,
          });
          pendingUser = null;
        }
      }
      setMessages(restored);
      // Re-pin the brand from any result that carries a brand name so
      // follow-up turns in a resumed conversation keep sending brand_id.
      const named = [...convo.messages]
        .reverse()
        .map((m) => m.result)
        .find((r): r is AgentResult => Boolean(r && "brand" in r && r.brand));
      const brandName = named && "brand" in named ? (named.brand as string | null) : null;
      if (brandName) {
        const match = brands.find((b) => b.brand_name.toLowerCase() === brandName.toLowerCase());
        setSelectedBrand(match ?? null);
      } else {
        setSelectedBrand(null);
      }
    } catch {
      onToast("Couldn't load conversation.");
    }
  }

  function startNew() {
    setCurrentId(null);
    setMessages([]);
    setTab("chat");
    setDraft("");
    setFiles([]);
    setSelectedBrand(null);
  }

  // Step 2 → 3: pin a brand and kick off automatic website research.
  function pickBrand(brand: BrandSummary) {
    setSelectedBrand(brand);
    void send(`Let's create graphics for ${brand.brand_name}.`, brand.id, "research");
  }

  function changeBrand() {
    startNew();
    onToast("Pick a brand to start a new conversation.");
  }

  // Step 4 → 5: the intake mini-form submits aspect ratio + brief.
  function provideRequirements(aspectRatio: string, brief: string) {
    void send(`Aspect ratio: ${aspectRatio}\n\n${brief}`, undefined, "generate");
  }

  async function removeConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await deleteConversation(id);
      if (id === currentId) startNew();
      refresh();
      onToast("Conversation deleted.");
    } catch {
      onToast("Couldn't delete conversation.");
    }
  }

  async function send(text: string, brandId?: string | null, phase: Phase = "generate") {
    const trimmed = text.trim();
    if ((!trimmed && files.length === 0) || busy) return;

    // Explicit arg wins (brand kickoff); otherwise use the pinned brand.
    const useBrandId = brandId !== undefined ? brandId : selectedBrand?.id ?? null;

    setDraft("");
    const picked = files;
    setFiles([]);
    setBusy(true);

    const userId = `u-${Date.now()}`;
    const loadId = `l-${Date.now()}`;
    const baseSteps = phase === "research" ? RESEARCH_STEPS : GENERATE_STEPS;
    const steps = picked.length > 0 ? [READING_STEP, ...baseSteps] : baseSteps;

    setMessages((prev) => [
      ...prev,
      {
        id: userId,
        role: "user",
        text: trimmed || "(attachment only)",
        attachments: picked.map((f) => f.name),
      },
      { id: loadId, role: "loading", statusLabel: steps[0] },
    ]);

    let stepIndex = 0;
    const timer = setInterval(() => {
      stepIndex = Math.min(stepIndex + 1, steps.length - 1);
      setMessages((prev) =>
        prev.map((m) => (m.id === loadId ? { ...m, statusLabel: steps[stepIndex] } : m)),
      );
    }, 1100);

    try {
      const { conversation_id, result } = await runAgent(
        trimmed || "Create a creative from the attachment",
        picked,
        currentId,
        useBrandId,
        null,
        agentSettings ?? undefined,
      );
      clearInterval(timer);
      setMessages((prev) =>
        prev
          .filter((m) => m.id !== loadId)
          .concat({ id: `a-${Date.now()}`, role: "assistant", text: trimmed, result }),
      );
      if (conversation_id !== currentId) setCurrentId(conversation_id);
      refresh();
    } catch (err) {
      clearInterval(timer);
      const message = err instanceof Error ? err.message : "Something went wrong";
      setMessages((prev) =>
        prev
          .filter((m) => m.id !== loadId)
          .concat({ id: `e-${Date.now()}`, role: "error", error: message }),
      );
    } finally {
      setBusy(false);
    }
  }

  const attachmentsEnabled = agentSettings?.enabled_tools.includes("file_attachments") ?? true;

  function updateAgentSettings(next: AgentSettingsValues) {
    setAgentSettings(next);
    saveAgentSettings(next);
  }

  return (
    <div className="twspace">
      <div className="twconv">
        <header className="twconv__head">
          {onBack ? (
            <IconButton label="Back to agents" variant="ghost" size="sm" onClick={onBack}>
              <Icon name="arrow-left" size={16} />
            </IconButton>
          ) : null}
          <GlyphTile glyph="design" tint="design" size={42} glyphSize={22} />
          <div className="twconv__id">
            <div className="twconv__name">{AGENT.name}</div>
            {/* Model name intentionally not shown — model selection is creator-only
                (Agent configuration panel). Users never see which LLM is used. */}
            <div className="twconv__sub">{AGENT.role}</div>
          </div>
          <div className="twconv__actions">
            {selectedBrand ? (
              <Badge variant="brand" icon={<Icon name="bot" size={12} />}>
                {selectedBrand.brand_name}
                <button
                  type="button"
                  onClick={changeBrand}
                  title="Change brand (starts a new conversation)"
                  className="twconv__badgex"
                  aria-label="Change brand"
                >
                  ×
                </button>
              </Badge>
            ) : null}
            {busy ? <StatusDot status="running" showLabel={false} /> : null}
            <div className="twseg" role="tablist" aria-label="View">
              <button role="tab" aria-selected={tab === "chat"} data-active={tab === "chat"} onClick={() => setTab("chat")}>
                <Icon name="messages-square" size={14} /> Chat
              </button>
              <button role="tab" aria-selected={tab === "history"} data-active={tab === "history"} onClick={() => setTab("history")}>
                <Icon name="history" size={14} /> History
                {conversations.length > 0 ? <span className="twseg__c">{conversations.length}</span> : null}
              </button>
            </div>
            <IconButton label="New conversation" variant="ghost" size="sm" onClick={startNew}>
              <Icon name="plus" size={17} />
            </IconButton>
            {/* Per-user "Agent settings" (Switch A) removed: model/LLM selection is
                now creator-only via the Agent configuration panel. The drawer code
                below is kept but no longer reachable. */}
          </div>
        </header>

        {tab === "chat" ? (
          <>
            <div className="twthread" ref={scroller}>
              <div className="twthread__inner">
                {messages.length === 0 ? (
                  <div className="twwelcome">
                    <GlyphTile glyph="design" tint="design" size={74} glyphSize={37} className="twwelcome__tile" />
                    <div className="twwelcome__title">Let&apos;s design something on-brand</div>
                    <p className="twwelcome__sub">
                      Pick a brand and I&apos;ll research its website, build a brand persona, and pull
                      its logo before we start designing.
                    </p>
                    <BrandPicker brands={brands} busy={busy} onPick={pickBrand} />
                  </div>
                ) : (
                  messages.map((m, i) => (
                    <ChatMsg
                      key={m.id}
                      m={m}
                      interactive={i === messages.length - 1 && !busy}
                      busy={busy}
                      onRequirements={provideRequirements}
                    />
                  ))
                )}
                <div ref={bottomRef} />
              </div>
            </div>
            <div className="twcomposer">
              <div className="twcomposer__inner">
                <input ref={fileRef} type="file" multiple style={{ display: "none" }} onChange={(e) => {
                  const picked = Array.from(e.target.files ?? []);
                  if (picked.length) setFiles((prev) => [...prev, ...picked]);
                  e.target.value = "";
                }} />
                {files.length > 0 && (
                  <div className="twcomposer__files">
                    {files.map((f, i) => (
                      <span key={`${f.name}-${i}`} className="twfile">
                        {f.name}
                        <button type="button" onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`}>×</button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="twcomposer__box">
                  <input
                    className="twcomposer__input"
                    placeholder="Message Graphic Designer…"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void send(draft);
                      }
                    }}
                    disabled={busy}
                  />
                  <div className="twcomposer__actions">
                    {attachmentsEnabled ? (
                      <IconButton label="Attach" variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
                        <Icon name="paperclip" size={16} />
                      </IconButton>
                    ) : null}
                    <Button variant="brand" size="sm" onClick={() => void send(draft)} disabled={busy || (!draft.trim() && files.length === 0)} iconRight={<Icon name="arrow-up" size={15} />}>
                      Send
                    </Button>
                  </div>
                </div>
                <div className="twcomposer__hint">
                  <Icon name="palette" size={12} /> Try &quot;Generate a Legal Soft launch banner&quot; or attach a brand PDF.
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="twthread">
            <div className="twthread__inner">
              <div className="twhistory">
                {conversations.length === 0 ? (
                  <div className="cplaceholder" style={{ padding: 40 }}>
                    <div style={{ color: "var(--text-tertiary)" }}>No conversations yet.</div>
                  </div>
                ) : (
                  conversations.map((c) => (
                    <div className="twrun" key={c.id}>
                      <span className="twrun__ic">
                        <Icon name="check" size={15} />
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="twrun__name">{c.title}</div>
                        <div className="twrun__stats">Updated {new Date(c.updated_at).toLocaleString()}</div>
                      </div>
                      <span className="twrun__when">{new Date(c.updated_at).toLocaleDateString()}</span>
                      <IconButton label="Delete" variant="ghost" size="sm" onClick={(e) => void removeConversation(c.id, e)}>
                        <Icon name="trash-2" size={14} />
                      </IconButton>
                      <IconButton label="Open" variant="ghost" size="sm" onClick={() => void loadConversation(c.id)}>
                        <Icon name="chevron-right" size={16} />
                      </IconButton>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {settingsOpen ? (
        <>
          <div className="twdrawer__scrim" onClick={() => setSettingsOpen(false)} />
          <aside className="twdrawer" role="dialog" aria-modal="true" aria-label="Agent settings">
            {settingsConfig && agentSettings ? (
              <AgentSettingsPanel
                config={settingsConfig}
                values={agentSettings}
                onChange={updateAgentSettings}
                onNewConversation={() => {
                  startNew();
                  setSettingsOpen(false);
                }}
                onClose={() => setSettingsOpen(false)}
              />
            ) : (
              <div className="twsettings twsettings--loading">
                <Icon name="loader-circle" size={22} style={{ color: "var(--brand)", animation: "spin 1s linear infinite" }} />
              </div>
            )}
          </aside>
        </>
      ) : null}
    </div>
  );
}

function BrandPicker({
  brands,
  busy,
  onPick,
}: {
  brands: BrandSummary[];
  busy: boolean;
  onPick: (brand: BrandSummary) => void;
}) {
  return (
    <div className="twbrandpick">
      {brands.length === 0 ? (
        <span className="twbrandpick__loading">Loading brands…</span>
      ) : (
        brands.map((b) => (
          <button
            key={b.id}
            type="button"
            className="twbrandchip"
            disabled={busy}
            onClick={() => onPick(b)}
          >
            {b.brand_name}
          </button>
        ))
      )}
    </div>
  );
}

function ChatMsg({
  m,
  interactive = false,
  busy = false,
  onRequirements,
}: {
  m: ThreadMsg;
  interactive?: boolean;
  busy?: boolean;
  onRequirements?: (aspectRatio: string, brief: string) => void;
}) {
  if (m.role === "user") {
    return (
      <div className="twmsg twmsg--user">
        {m.attachments && m.attachments.length > 0 && (
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 4 }}>
            {m.attachments.join(", ")}
          </div>
        )}
        <div className="twbubble twbubble--user">{m.text}</div>
      </div>
    );
  }
  if (m.role === "loading") {
    return (
      <div className="twmsg">
        <Avatar size="sm" square color="var(--cat-design)">
          <Icon name="palette" size={14} />
        </Avatar>
        <div className="twbubble">
          <Badge variant="brand" dot>
            {m.statusLabel}
          </Badge>
        </div>
      </div>
    );
  }
  if (m.role === "error") {
    return (
      <div className="twmsg">
        <Avatar size="sm" square color="var(--cat-design)">
          <Icon name="palette" size={14} />
        </Avatar>
        <div className="twbubble" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>
          {m.error}
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {m.result ? (
        <ResultView
          result={m.result}
          interactive={interactive}
          busy={busy}
          onRequirements={onRequirements}
        />
      ) : m.text ? (
        <div className="twmsg">
          <Avatar size="sm" square color="var(--cat-design)">
            <Icon name="palette" size={14} />
          </Avatar>
          <div className="twbubble">{m.text}</div>
        </div>
      ) : null}
    </div>
  );
}
