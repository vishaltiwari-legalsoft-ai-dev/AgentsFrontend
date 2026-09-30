"use client";

/** The avatar studio: every user gets a face of their own making.
 *
 *  An avatar here is a choice, not an upload: one of eight curated duotone
 *  gradients and one of four quiet patterns, with the wearer's initials on
 *  top — so every combination stays on the console's level, and no picture
 *  moderation problem is invented. The choice is kept in this browser
 *  (like the theme and Your list), keyed by account, and the storage shape
 *  is one tiny JSON — ready to move server-side whenever a profile API
 *  exists.
 */

import { useCallback, useEffect, useState } from "react";
import { Ic } from "./Sprite";

export interface AvatarStyle {
  /** index into AVATAR_GRADIENTS */
  g: number;
  /** index into AVATAR_PATTERNS */
  p: number;
}

export const AVATAR_GRADIENTS: { name: string; css: string; ink: string }[] = [
  { name: "Graphite", css: "linear-gradient(135deg, #3E4756, #14161C)", ink: "#FFFFFF" },
  { name: "Cobalt", css: "linear-gradient(135deg, #6D7CFF, #2A3AAB)", ink: "#FFFFFF" },
  { name: "Ocean", css: "linear-gradient(135deg, #3FA7D6, #145C8E)", ink: "#FFFFFF" },
  { name: "Emerald", css: "linear-gradient(135deg, #34C08B, #0A6B4D)", ink: "#FFFFFF" },
  { name: "Bronze", css: "linear-gradient(135deg, #E3BC70, #8F6B2E)", ink: "#2E2306" },
  { name: "Rose", css: "linear-gradient(135deg, #F08FA4, #A33B57)", ink: "#FFFFFF" },
  { name: "Violet", css: "linear-gradient(135deg, #9B86E8, #54409F)", ink: "#FFFFFF" },
  { name: "Marigold", css: "linear-gradient(135deg, #FFE894, #E9A23B)", ink: "#45340A" },
];

export const AVATAR_PATTERNS = ["Plain", "Orbits", "Dots", "Beam"] as const;

const DEFAULT: AvatarStyle = { g: 0, p: 0 };
const key = (email: string) => `agentos.avatar.${email}`;

const clamp = (v: unknown, max: number) =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v < max ? v : 0;

export function useAvatarStyle(email: string): [AvatarStyle, (s: AvatarStyle) => void] {
  const [style, setStyle] = useState<AvatarStyle>(DEFAULT);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key(email));
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AvatarStyle>;
        setStyle({
          g: clamp(parsed.g, AVATAR_GRADIENTS.length),
          p: clamp(parsed.p, AVATAR_PATTERNS.length),
        });
      }
    } catch {
      /* storage off or corrupt — the default face is a fine face */
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

export function UserAvatar({
  name, email, style, size = 33,
}: {
  name: string;
  email: string;
  style: AvatarStyle;
  size?: number;
}) {
  const g = AVATAR_GRADIENTS[style.g] ?? AVATAR_GRADIENTS[0];
  const initials = (name || email || "?").slice(0, 2).toUpperCase();
  return (
    <span
      className="uav"
      style={{ width: size, height: size, background: g.css, color: g.ink, fontSize: Math.max(9, Math.round(size / 3)) }}
    >
      {style.p === 1 && (
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="26" cy="108" r="58" />
          <circle cx="26" cy="108" r="84" />
        </svg>
      )}
      {style.p === 2 && (
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="20" cy="22" r="3.5" fill="currentColor" stroke="none" opacity="0.35" />
          <circle cx="80" cy="30" r="2.6" fill="currentColor" stroke="none" opacity="0.28" />
          <circle cx="68" cy="80" r="3.2" fill="currentColor" stroke="none" opacity="0.3" />
          <circle cx="26" cy="72" r="2.2" fill="currentColor" stroke="none" opacity="0.24" />
        </svg>
      )}
      {style.p === 3 && (
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <path d="M -12 78 L 78 -12 L 108 18 L 18 108 Z" fill="currentColor" stroke="none" opacity="0.16" />
        </svg>
      )}
      <b>{initials}</b>
    </span>
  );
}

/* ----------------------------------------------------------- the studio -- */

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

  useEffect(() => {
    if (open) setDraft(style);
  }, [open, style]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

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

        <p className="avd__label">Colour</p>
        <div className="avd__swatches" role="radiogroup" aria-label="Avatar colour">
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

        <p className="avd__label">Pattern</p>
        <div className="avd__pats" role="radiogroup" aria-label="Avatar pattern">
          {AVATAR_PATTERNS.map((p, i) => (
            <button
              type="button"
              key={p}
              role="radio"
              aria-checked={i === draft.p}
              className={i === draft.p ? "is-on" : ""}
              onClick={() => setDraft((d) => ({ ...d, p: i }))}
            >
              <UserAvatar name={name} email={email} style={{ ...draft, p: i }} size={40} />
              <span>{p}</span>
            </button>
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
