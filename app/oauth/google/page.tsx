"use client";

/** Where Google sends the browser back after the Inbox Triage consent screen.
 *
 *  Google's redirect lands on the console, not the backend, because the code
 *  it carries has to be exchanged by the account that asked for it — and that
 *  account's bearer lives in this browser. So this page does exactly one
 *  thing: hands `code` and `state` to the backend with the stored session,
 *  then sends the reader back to the workspace with one flag in the hash for
 *  the workspace to say out loud. It never shows the code, never keeps it, and
 *  runs the exchange once even when React mounts it twice in development.
 */

import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { inboxOauthComplete } from "@/lib/api";

const WORKSPACE = "/#/w/inbox";

const back = (query: string) => window.location.replace(`${WORKSPACE}?${query}`);
const failed = (why: string) => back(`error=${encodeURIComponent(why)}`);

export default function GoogleOAuthReturn() {
  const { user, ready } = useAuth();
  const started = useRef(false);

  useEffect(() => {
    if (!ready || !user || started.current) return;
    started.current = true;

    const q = new URLSearchParams(window.location.search);
    const error = q.get("error");
    if (error) {
      failed(error);
      return;
    }
    const code = q.get("code");
    const state = q.get("state");
    if (!code || !state) {
      failed("Google sent the browser back without a code");
      return;
    }
    inboxOauthComplete(code, state)
      .then(() => back("connected=1"))
      .catch((e: unknown) => failed(e instanceof Error && e.message ? e.message : "the connection could not be finished"));
  }, [ready, user]);

  if (ready && !user) {
    return (
      <main className="boot">
        <p className="calm">
          Sign in to the console first, then press Connect Gmail again.{" "}
          <a href="/">Open the console</a>
        </p>
      </main>
    );
  }

  return (
    <main className="boot" aria-busy="true">
      <span className="boot__spin" aria-hidden="true" />
      <span className="sr">Finishing the Gmail connection</span>
    </main>
  );
}
