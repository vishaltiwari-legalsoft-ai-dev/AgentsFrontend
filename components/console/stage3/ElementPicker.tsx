"use client";

import { useEffect, useMemo, useState } from "react";
import { gdElements, gdElementUpload, type GdElement, type EmojiRow } from "../../../lib/api";

type Tab = "emoji" | "icons" | "stickers" | "upload";

// Catalogues are large (emoji ~1552, icons ~1994) — never render them flat.
// Results are filtered by the search box and hard-capped so the DOM stays small.
const MAX_TILES = 200;

// The raw emoji catalogue is codepoint-ordered, which surfaces obscure enclosed
// symbols and a wall of country flags first. Re-order by category so the picker
// opens with the emoji people actually reach for (smileys, gestures, hearts) and
// pushes flags/symbols to the end.
const EMOJI_CAT_ORDER: Record<string, number> = {
  "smileys & emotion": 0,
  "people & body": 1,
  "animals & nature": 2,
  "food & drink": 3,
  "activities": 4,
  "travel & places": 5,
  "objects": 6,
  "symbols": 7,
  "flags": 8,
};
const emojiRank = (c: string) => EMOJI_CAT_ORDER[(c || "").toLowerCase()] ?? 6.5;

function newEl(kind: GdElement["kind"], ref: string): GdElement {
  return {
    id: `el-${Math.random().toString(36).slice(2, 9)}`,
    kind, ref, x: 0.5, y: 0.5,
    w: kind === "sticker" ? 0.35 : 0.15, h: kind === "sticker" ? 0.35 : 0.15,
    anchor: "mc", z: 5, rotation: 0, opacity: 1, fill: "#1746A2",
  };
}

export function ElementPicker({ runId, onAdd }: { runId: string; onAdd: (el: GdElement) => void }) {
  const [tab, setTab] = useState<Tab>("emoji");
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<{ emoji: EmojiRow[]; icons: string[]; stickers: string[] } | null>(null);

  useEffect(() => { gdElements().then(setCat).catch(() => setCat({ emoji: [], icons: [], stickers: [] })); }, []);

  const q = query.trim().toLowerCase();

  // Sort the full catalogue once (by category, then stable within), so both the
  // default view and search results lead with friendly, common emoji.
  const emojiSorted = useMemo(() => {
    const all = (cat?.emoji ?? []).map((e, i) => ({ e, i }));
    all.sort((a, b) => emojiRank(a.e.category) - emojiRank(b.e.category) || a.i - b.i);
    return all.map((x) => x.e);
  }, [cat]);

  const emojiMatches = useMemo(() => {
    if (!q) return emojiSorted;
    return emojiSorted.filter((e) => e.name.toLowerCase().includes(q) || e.category.toLowerCase().includes(q));
  }, [emojiSorted, q]);

  const iconMatches = useMemo(() => {
    const all = cat?.icons ?? [];
    if (!q) return all;
    return all.filter((k) => k.toLowerCase().includes(q));
  }, [cat, q]);

  const stickerMatches = useMemo(() => {
    const all = cat?.stickers ?? [];
    if (!q) return all;
    return all.filter((s) => s.toLowerCase().includes(q));
  }, [cat, q]);

  const emojiShown = emojiMatches.slice(0, MAX_TILES);
  const iconsShown = iconMatches.slice(0, MAX_TILES);
  const stickersShown = stickerMatches.slice(0, MAX_TILES);

  const truncated =
    (tab === "emoji" && emojiMatches.length > MAX_TILES) ||
    (tab === "icons" && iconMatches.length > MAX_TILES) ||
    (tab === "stickers" && stickerMatches.length > MAX_TILES);

  const upload = async (f: File) => {
    const { ref } = await gdElementUpload(runId, f);
    onAdd(newEl("image", ref));
  };

  const showSearch = tab === "emoji" || tab === "icons" || tab === "stickers";
  const noStickersYet = tab === "stickers" && (cat?.stickers?.length ?? 0) === 0;

  return (
    <div className="gdpicker">
      <p className="gdpicker__help">
        Click to add → then <strong>drag</strong> it on the preview to place, and drag the
        <strong> corner dot</strong> to resize. Manage layers below.
      </p>
      <div className="gdpicker__tabs">
        {(["emoji", "icons", "stickers", "upload"] as Tab[]).map((t) => (
          <button key={t} className={`gdminibtn${tab === t ? " is-active" : ""}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      {showSearch && !noStickersYet && (
        <input
          className="gdselect gdselect--sm gdpicker__search"
          type="text"
          value={query}
          placeholder={`Search ${tab}...`}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}
      <div className="gdpicker__grid">
        {tab === "emoji" && emojiShown.map((e) => (
          <button key={e.file} title={e.name} className="gdpicker__tile" onClick={() => onAdd(newEl("emoji", e.char))}>
            <img src={`/emoji/apple/${e.file}`} alt={e.name} width={28} height={28} />
          </button>
        ))}
        {tab === "icons" && iconsShown.map((k) => (
          <button key={k} title={k} className="gdpicker__tile" onClick={() => onAdd(newEl("icon", k))}>
            <img src={`/gd-icons/${k}.svg`} alt={k} width={24} height={24} />
          </button>
        ))}
        {tab === "stickers" && !noStickersYet && stickersShown.map((s) => (
          <button key={s} title={s} className="gdpicker__tile" onClick={() => onAdd(newEl("sticker", s))}>
            <img src={`/gd-stickers/${s}.svg`} alt={s} width={40} height={40} />
          </button>
        ))}
        {noStickersYet && (
          <div className="gdpicker__empty">No stickers yet — coming soon</div>
        )}
        {tab === "upload" && (
          <label className="gdminibtn">
            Upload PNG
            <input type="file" accept="image/png,image/webp" hidden
                   onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
        )}
      </div>
      {truncated && (
        <div className="gdpicker__hint">Showing first {MAX_TILES} matches — refine your search for more.</div>
      )}
    </div>
  );
}
