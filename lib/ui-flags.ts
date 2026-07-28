"use client";

import { useEffect, useState } from "react";

/** Per-browser opt-in for the new mascot agent-card look ("New look" switch in
 *  the header). Default off = the classic deployed cards. Synced across
 *  components via a window event so the grid flips the moment the switch does. */
const CARDS_V2_KEY = "cards-v2";
const CARDS_V2_EVENT = "agentos:cards-v2";

export function useCardsV2(): [boolean, () => void] {
  const [on, setOn] = useState(false);

  useEffect(() => {
    const read = () => {
      try {
        setOn(window.localStorage.getItem(CARDS_V2_KEY) === "1");
      } catch {
        /* ignore storage failures (private mode etc.) */
      }
    };
    read();
    window.addEventListener(CARDS_V2_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(CARDS_V2_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);

  const toggle = () => {
    try {
      const next = window.localStorage.getItem(CARDS_V2_KEY) === "1" ? "0" : "1";
      window.localStorage.setItem(CARDS_V2_KEY, next);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(CARDS_V2_EVENT));
  };

  return [on, toggle];
}
