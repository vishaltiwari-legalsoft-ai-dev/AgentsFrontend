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
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(PREVIEW_NO_AUTH ? PREVIEW_USER : null);
  const [ready, setReady] = useState(PREVIEW_NO_AUTH);

  const logout = useCallback(() => {
    // In preview mode there is no session to end, and a 401 from a connected
    // backend must not dump the viewer back onto a login screen that the
    // bypass exists to remove.
    if (PREVIEW_NO_AUTH) return;
    setAuthToken(null);
    setUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
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
    if (PREVIEW_NO_AUTH) return; // mock user is already in place; nothing stored to restore
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
    () => ({ user, ready, login, logout }),
    [user, ready, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
