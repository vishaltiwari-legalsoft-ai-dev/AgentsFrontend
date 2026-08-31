"use client";

import { useEffect, useRef, useState } from "react";
import { googleLogin } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { BrandMark } from "@/lib/kit-ui";
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, unknown>,
          ) => void;
        };
      };
    };
  }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
      <BrandMark size={40} title="LegalSoft" />
      <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, letterSpacing: "-0.01em", color: "var(--text-primary)" }}>
        Legal<span style={{ color: "var(--blue-600)" }}>Soft</span>
      </span>
    </div>
  );
}

export default function LoginScreen() {
  const { login } = useAuth();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!CLIENT_ID) {
      setError("NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set.");
      return;
    }

    let cancelled = false;

    async function handleCredential(response: { credential: string }) {
      try {
        const { token, user } = await googleLogin(response.credential);
        if (!cancelled) login(token, user);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Sign-in failed");
      }
    }

    function tryInit() {
      if (!window.google || !buttonRef.current) return false;
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: handleCredential,
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: "outline",
        size: "large",
        shape: "pill",
        text: "continue_with",
        logo_alignment: "center",
        width: 280,
      });
      return true;
    }

    if (!tryInit()) {
      const timer = setInterval(() => {
        if (tryInit()) clearInterval(timer);
      }, 150);
      setTimeout(() => clearInterval(timer), 8000);
      return () => {
        cancelled = true;
        clearInterval(timer);
      };
    }
    return () => {
      cancelled = true;
    };
  }, [login]);

  return (
    <div className="capp" style={{ alignItems: "center", justifyContent: "center", background: "var(--grad-hero)" }}>
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          margin: 16,
          padding: "40px 36px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-xl)",
          boxShadow: "var(--shadow-lg)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <Logo />
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, margin: "0 0 6px", letterSpacing: "-0.02em" }}>
          Hire AI specialists. Or deploy a whole team.
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "0 0 28px", lineHeight: 1.5 }}>
          Sign in to orchestrate your brand creatives with Agent Nexus.
        </p>

        <div ref={buttonRef} style={{ minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center" }} />

        {error && (
          <p style={{ color: "var(--danger)", fontSize: 12, fontWeight: 500, marginTop: 16 }}>{error}</p>
        )}

        <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 24 }}>
          Secure sign-in with Google. No passwords stored.
        </p>
      </div>
    </div>
  );
}
