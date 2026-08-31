"use client";

import { useAuth } from "@/lib/auth";
import LoginScreen from "@/components/LoginScreen";
import HubApp from "@/components/hub/HubApp";

export default function Page() {
  const { user, ready } = useAuth();

  // Auth resolves from localStorage after mount, so there is a moment before
  // either answer is known. Showing the sign-in screen during it would flash a
  // login at somebody who is already signed in.
  if (!ready) {
    return (
      <main className="boot" aria-busy="true">
        <span className="boot__spin" aria-hidden="true" />
        <span className="sr">Opening AgentHub</span>
      </main>
    );
  }

  if (!user) return <LoginScreen />;

  return <HubApp />;
}
