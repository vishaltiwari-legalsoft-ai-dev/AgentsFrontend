"use client";

import { useState } from "react";
import { GraphicsStudio } from "@/components/console/GraphicsStudio";
import { GraphicsStudioV2 } from "./GraphicsStudioV2";

/* Feature toggle between the classic Studio and V2. The choice persists in
   localStorage; classic remains the default, so nothing changes for anyone
   who doesn't opt in. */
export function StudioSwitch(props: { onToast: (m: string) => void; onBack?: () => void }) {
  const [v2, setV2] = useState<boolean>(
    () => typeof window !== "undefined" && window.localStorage.getItem("gd_ui_v2") === "1",
  );
  const flip = (on: boolean) => {
    try {
      window.localStorage.setItem("gd_ui_v2", on ? "1" : "0");
    } catch {
      /* private mode — session-only toggle is fine */
    }
    setV2(on);
  };

  if (v2) return <GraphicsStudioV2 {...props} onExitV2={() => flip(false)} />;
  return (
    <div className="gd2-classic-host">
      <button className="gd2-try" onClick={() => flip(true)}>✨ Try the new Studio</button>
      <GraphicsStudio {...props} />
    </div>
  );
}
