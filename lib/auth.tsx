"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  setAuthToken,
  setUnauthorizedHandler,
  type User,
} from "@/lib/api";

const STORAGE_KEY = "agentos.auth";
/** Preview only: set once the visitor has come through the landing page, so a
 *  reload inside the session skips it but every fresh visit sees it again. */
const ENTERED_KEY = "agentos.entered";

/** Preview bypass for the UI-lab deployments: with NEXT_PUBLIC_PREVIEW_NO_AUTH
 *  set to "1" the shell boots straight into the hub as the mock user below —
 *  no Google panel, no logout-on-401 — so a deploy is viewable by just opening
 *  it. Client-side only: requests still carry no valid token, so a connected
 *  backend refuses them exactly as before. Unset (every non-lab deployment),
 *  this file behaves as it always has. */
const PREVIEW_NO_AUTH = process.env.NEXT_PUBLIC_PREVIEW_NO_AUTH === "1";

const PREVIEW_USER: User = {
  id: "preview-user",
  email: "preview@agenthub.lab",
  name: "Preview User",
  picture: "",
  // Every role on, so the whole surface (admin + creator panels included)
  // renders while the UI is being revamped.
  is_admin: true,
  is_creator: true,
  is_geo_editor: true,
  is_geo_only: false,
};

interface StoredAuth {
  token: string;
  user: User;
}

interface AuthContextValue {
  user: User | null;
  ready: boolean;
  /** True on the UI-lab deployments, where the landing's Google button enters
   *  as the mock user instead of running the real Google flow. */
  preview: boolean;
  login: (token: string, user: User) => void;
  /** Preview only: walk in from the landing page as the mock user. */
  enterPreview: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const logout = useCallback(() => {
    // Preview has no real session to end: signing out just walks the viewer
    // back to the landing page, and a 401 from a connected backend must not
    // do the same behind their back — only the menu's own button calls this.
    if (PREVIEW_NO_AUTH) {
      try {
        sessionStorage.removeItem(ENTERED_KEY);
      } catch {
        /* ignore */
      }
      setUser(null);
      return;
    }
    setAuthToken(null);
    setUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const enterPreview = useCallback(() => {
    if (!PREVIEW_NO_AUTH) return;
    try {
      sessionStorage.setItem(ENTERED_KEY, "1");
    } catch {
      /* storage off — entering still works for this render */
    }
    setUser(PREVIEW_USER);
  }, []);

  const login = useCallback((token: string, nextUser: User) => {
    setAuthToken(token);
    setUser(nextUser);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user: nextUser }));
    } catch {
      /* ignore */
    }
  }, []);

  // Restore session on first load + register the global 401 handler.
  useEffect(() => {
    if (PREVIEW_NO_AUTH) {
      // Every fresh visit lands on the landing page; a reload mid-session
      // walks straight back in. (Client-only, so no hydration mismatch.)
      try {
        if (sessionStorage.getItem(ENTERED_KEY) === "1") setUser(PREVIEW_USER);
      } catch {
        setUser(PREVIEW_USER); // storage off — never trap the viewer outside
      }
      setReady(true);
      return;
    }
    setUnauthorizedHandler(() => logout());
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as StoredAuth;
        if (stored?.token && stored?.user) {
          setAuthToken(stored.token);
          setUser(stored.user);
        }
      }
    } catch {
      /* ignore corrupt storage */
    }
    setReady(true);
  }, [logout]);

  const value = useMemo(
    () => ({ user, ready, preview: PREVIEW_NO_AUTH, login, enterPreview, logout }),
    [user, ready, login, enterPreview, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
