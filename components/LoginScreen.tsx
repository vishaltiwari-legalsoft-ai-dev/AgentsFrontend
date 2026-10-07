"use client";

/** The landing: the staff at work behind glass.
 *
 *  A visitor arrives on the film — the robots at their desks in the law
 *  office — with one card of glass floating over it: the name, one line of
 *  what this is, and the Google door in. Nothing else competes for the
 *  moment. On the lab deployments the Google button walks straight in as the
 *  preview user; everywhere else it runs the real Google Identity flow this
 *  screen has always run.
 *
 *  The film is decoration, so it is muted, looped, and absent for anyone who
 *  asked for reduced motion — a deep navy stage stands behind it either way,
 *  which is also what shows while the first frames arrive.
 */

import { useEffect, useRef, useState } from "react";
import { googleLogin } from "@/lib/api";
import { useAuth } from "@/lib/auth";

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

/** Google's four-colour G, drawn inline so the button needs no asset. */
function GoogleG() {
  return (
    <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M9 3.48c1.69 0 2.83.73 3.48 1.34l2.54-2.48C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l2.91 2.26C4.6 5.05 6.62 3.48 9 3.48z" />
      <path fill="#4285F4" d="M17.64 9.2c0-.74-.06-1.28-.19-1.84H9v3.34h4.96c-.1.83-.64 2.08-1.84 2.92l2.84 2.2c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#FBBC05" d="M3.88 10.78A5.54 5.54 0 0 1 3.58 9c0-.62.11-1.22.29-1.78L.96 4.96A9.008 9.008 0 0 0 0 9c0 1.45.35 2.82.96 4.04l2.92-2.26z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.84-2.2c-.76.53-1.78.9-3.12.9-2.38 0-4.4-1.57-5.12-3.74L.97 13.04C2.45 15.98 5.48 18 9 18z" />
    </svg>
  );
}

export default function LoginScreen() {
  const { login, preview, enterPreview } = useAuth();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  // The real Google flow, untouched — it just never runs on the lab.
  useEffect(() => {
    if (preview) return;
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
  }, [login, preview]);

  return (
    <div className="land">
      <span className="land__fall" aria-hidden="true" />
      <video
        className="land__vid"
        src="/landing.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        tabIndex={-1}
        aria-hidden="true"
      />
      <span className="land__shade" aria-hidden="true" />

      <header className="land__brand">
        <span className="land__glyph" aria-hidden="true" />
        <span>
          <b>AgentHub</b>
          <em>Legal Soft · Marketing</em>
        </span>
      </header>

      <main className="land__card">
        <p className="land__eyebrow">Your marketing staff, on call</p>
        <h1>Six AI specialists are already at their desks.</h1>
        <p className="land__sub">
          Brief one in plain words — collect finished creatives, audits, reports and drafts.
        </p>

        {preview ? (
          <button type="button" className="land__google" onClick={enterPreview}>
            <GoogleG />
            Continue with Google
          </button>
        ) : (
          <div ref={buttonRef} className="land__gis" />
        )}

        {error && <p className="land__err">{error}</p>}
        <p className="land__fine">Secure sign-in with Google. No passwords stored.</p>
      </main>

      <footer className="land__foot">
        Graphic Designer · SEO Analyst · Marketing Research · Blog Writer · GEO · Inbox Triage
      </footer>
    </div>
  );
}
