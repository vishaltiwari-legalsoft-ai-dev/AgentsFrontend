"use client";

import { useAuth } from "@/lib/auth";
import LoginScreen from "@/components/LoginScreen";
import ConsoleApp from "@/components/console/ConsoleApp";
import { Icon } from "@/lib/kit-ui";

export default function Page() {
  const { user, ready } = useAuth();

  if (!ready) {
    return (
      <main className="capp" style={{ alignItems: "center", justifyContent: "center" }}>
        <Icon name="loader-circle" size={28} style={{ color: "var(--brand)", animation: "spin 1s linear infinite" }} />
      </main>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return <ConsoleApp />;
}
