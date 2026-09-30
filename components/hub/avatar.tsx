"use client";

/** The avatar studio: every user gets a face of their own choosing.
 *
 *  The faces come from DiceBear's designed collections — real illustrated
 *  avatars, not initials on a wash. Four sets ship, all CC0 (no attribution
 *  owed): Notionists, Lorelei, Open Peeps and Thumbs. Everything renders
 *  client-side to an SVG data URI from a seed string, so no request leaves
 *  the page and the same seed is the same face for ever.
 *
 *  A choice is three small values — set, seed, backdrop — kept in this
 *  browser keyed by account (like the theme and Your list), ready to move
 *  server-side whenever a profile API exists. Old saves from the studio's
 *  first draft (gradient + pattern) fall back to a default face rather
 *  than crashing the read.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { createAvatar, type Style } from "@dicebear/core";
import { lorelei, notionists, openPeeps, thumbs } from "@dicebear/collection";
import { Ic } from "./Sprite";

/* Each collection ships its own option type; this studio only ever passes a
   seed, so the sets are held at the common `Style<object>` altitude. */
export const AVATAR_SETS: { key: string; name: string; style: Style<object> }[] = [
  { key: "notionists", name: "Notion", style: notionists as unknown as Style<object> },
  { key: "lorelei", name: "Lorelei", style: lorelei as unknown as Style<object> },
  { key: "peeps", name: "Peeps", style: openPeeps as unknown as Style<object> },
  { key: "thumbs", name: "Thumbs", style: thumbs as unknown as Style<object> },
];

export const AVATAR_GRADIENTS: { name: string; css: string }[] = [
  { name: "Paper", css: "linear-gradient(135deg, #F4F5F7, #DDE0E5)" },
  { name: "Graphite", css: "linear-gradient(135deg, #3E4756, #14161C)" },
  { name: "Cobalt", css: "linear-gradient(135deg, #6D7CFF, #2A3AAB)" },
  { name: "Ocean", css: "linear-gradient(135deg, #3FA7D6, #145C8E)" },
  { name: "Emerald", css: "linear-gradient(135deg, #34C08B, #0A6B4D)" },
  { name: "Bronze", css: "linear-gradient(135deg, #E3BC70, #8F6B2E)" },
  { name: "Rose", css: "linear-gradient(135deg, #F08FA4, #A33B57)" },
  { name: "Marigold", css: "linear-gradient(135deg, #FFE894, #E9A23B)" },
];

export interface AvatarStyle {
  /** index into AVATAR_SETS */
  s: number;
  /** the DiceBear seed — same seed, same face, for ever */
  v: string;
  /** index into AVATAR_GRADIENTS (the backdrop) */
  g: number;
}

const key = (email: string) => `agentos.avatar.${email}`;
const defaultFor = (email: string): AvatarStyle => ({ s: 0, v: `${email}|0|0`, g: 0 });

const clamp = (v: unknown, max: number) =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v < max ? v : 0;

export function useAvatarStyle(email: string): [AvatarStyle, (s: AvatarStyle) => void] {
  const [style, setStyle] = useState<AvatarStyle>(() => defaultFor(email));

  useEffect(() => {
    setStyle(defaultFor(email));
    try {
      const raw = localStorage.getItem(key(email));
      if (raw) {
        const p = JSON.parse(raw) as Partial<AvatarStyle>;
        setStyle({
          s: clamp(p.s, AVATAR_SETS.length),
          v: typeof p.v === "string" && p.v ? p.v : defaultFor(email).v,
          g: clamp(p.g, AVATAR_GRADIENTS.length),
        });
      }
    } catch {
      /* storage off or an old save — the default face is a fine face */
    }
  }, [email]);

  const save = useCallback(
    (s: AvatarStyle) => {
      setStyle(s);
      try {
        localStorage.setItem(key(email), JSON.stringify(s));
      } catch {
        /* still applied for this session */
      }
    },
    [email],
  );

  return [style, save];
}

/* ------------------------------------------------------------- the face -- */

function faceUri(setIndex: number, seed: string): string {
  const set = AVATAR_SETS[setIndex] ?? AVATAR_SETS[0];
  return createAvatar(set.style, { seed }).toDataUri();
}

export function UserAvatar({
  name, email, style, size = 33,
}: {
  name: string;
  email: string;
  style: AvatarStyle;
  size?: number;
}) {
  const uri = useMemo(() => faceUri(style.s, style.v || `${email}|0|0`), [style.s, style.v, email]);
  const g = AVATAR_GRADIENTS[style.g] ?? AVATAR_GRADIENTS[0];
  return (
    <span className="uav" style={{ width: size, height: size, background: g.css }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={uri} alt={`${name || email}'s avatar`} width={size} height={size} />
    </span>
  );
}

/* ----------------------------------------------------------- the studio -- */

const GRID = 12;

export function AvatarDialog({
  open, name, email, style, onSave, onClose,
}: {
  open: boolean;
  name: string;
  email: string;
  style: AvatarStyle;
  onSave: (s: AvatarStyle) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<AvatarStyle>(style);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (open) {
      setDraft(style);
      setNonce(0);
    }
  }, [open, style]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const seeds = useMemo(
    () => Array.from({ length: GRID }, (_, k) => `${email}|${draft.s}|${nonce}|${k}`),
    [email, draft.s, nonce],
  );

  if (!open) return null;

  return (
    <div className="avd" role="dialog" aria-modal="true" aria-label="Your avatar" onClick={onClose}>
      <div className="avd__card" onClick={(e) => e.stopPropagation()}>
        <header className="avd__head">
          <b>Your avatar</b>
          <p>How you appear across the hub. Kept in this browser.</p>
        </header>

        <div className="avd__preview">
          <UserAvatar name={name} email={email} style={draft} size={76} />
        </div>

        <p className="avd__label">Style</p>
        <div className="avd__pats" role="radiogroup" aria-label="Avatar style">
          {AVATAR_SETS.map((s, i) => (
            <button
              type="button"
              key={s.key}
              role="radio"
              aria-checked={i === draft.s}
              className={i === draft.s ? "is-on" : ""}
              onClick={() => setDraft((d) => ({ ...d, s: i, v: `${email}|${i}|0|0` }))}
            >
              <UserAvatar name={name} email={email} style={{ s: i, v: `${email}|${i}|0|0`, g: draft.g }} size={40} />
              <span>{s.name}</span>
            </button>
          ))}
        </div>

        <div className="avd__row">
          <p className="avd__label">Face</p>
          <button type="button" className="avd__shuffle" onClick={() => setNonce((n) => n + 1)}>
            <Ic name="tries" />
            Shuffle
          </button>
        </div>
        <div className="avd__grid" role="radiogroup" aria-label="Pick a face">
          {seeds.map((seed) => (
            <button
              type="button"
              key={seed}
              role="radio"
              aria-checked={seed === draft.v}
              className={seed === draft.v ? "is-on" : ""}
              onClick={() => setDraft((d) => ({ ...d, v: seed }))}
            >
              <UserAvatar name={name} email={email} style={{ ...draft, v: seed }} size={42} />
            </button>
          ))}
        </div>

        <p className="avd__label">Backdrop</p>
        <div className="avd__swatches" role="radiogroup" aria-label="Backdrop colour">
          {AVATAR_GRADIENTS.map((g, i) => (
            <button
              type="button"
              key={g.name}
              role="radio"
              aria-checked={i === draft.g}
              aria-label={g.name}
              title={g.name}
              className={i === draft.g ? "is-on" : ""}
              style={{ background: g.css }}
              onClick={() => setDraft((d) => ({ ...d, g: i }))}
            />
          ))}
        </div>

        <footer className="avd__acts">
          <button type="button" className="btn btn--quiet btn--sm" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--solid btn--sm"
            onClick={() => {
              onSave(draft);
              onClose();
            }}
          >
            <Ic name="check" />
            Save
          </button>
        </footer>
      </div>
    </div>
  );
}
