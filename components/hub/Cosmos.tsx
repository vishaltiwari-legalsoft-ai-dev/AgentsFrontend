"use client";

/** The hero cosmos: AI at the centre, the staff in orbit around it.
 *
 *  Three hairline orbits on the dotted paper, two specialists to a ring,
 *  each revolving at its own unhurried pace — 40 to 76 seconds a lap — with
 *  a single marigold signal running the middle ring the other way. The
 *  centre is the one solid thing on the page: a marigold core that breathes.
 *
 *  It is drawn fresh for the revamp (no component of the old console), and
 *  it is not only decoration: every satellite is a real button — picking a
 *  planet opens that specialist's manual below. Under prefers-reduced-motion
 *  nothing revolves; the system rests in its settled positions.
 *
 *  The counter-rotation trick: each orbit spins +360° per lap while the
 *  satellite inside spins −360° on the same clock, so labels stay upright
 *  the whole way round.
 */

import type { CSSProperties } from "react";
import type { HubAgent } from "./model";
import { Ic } from "./Sprite";

/** ring diameter (px) · seconds per lap · the two phase angles on it */
const RINGS = [
  { size: 150, dur: 42, angles: [15, 195] },
  { size: 262, dur: 58, angles: [130, 310] },
  { size: 372, dur: 76, angles: [250, 70] },
];

export default function Cosmos({
  agents, onPick,
}: {
  agents: HubAgent[];
  onPick: (id: string) => void;
}) {
  return (
    <div className="cosmos">
      <span className="cosmos__ring cosmos__ring--1" aria-hidden="true" />
      <span className="cosmos__ring cosmos__ring--2" aria-hidden="true" />
      <span className="cosmos__ring cosmos__ring--3" aria-hidden="true" />

      <span className="cosmos__core" aria-hidden="true">
        <b>AI</b>
        <em>AgentHub</em>
      </span>

      {/* the signal: one marigold point running the middle ring, retrograde */}
      <span className="cosmos__orbit cosmos__orbit--spark" aria-hidden="true">
        <i className="cosmos__spark" />
      </span>

      {agents.slice(0, 6).map((a, i) => {
        const ring = RINGS[i % 3];
        const angle = ring.angles[Math.floor(i / 3) % 2];
        const style = {
          width: ring.size,
          height: ring.size,
          "--a": `${angle}deg`,
          "--d": `${ring.dur}s`,
        } as CSSProperties;
        return (
          <span className="cosmos__orbit" style={style} key={a.id}>
            <button
              type="button"
              className="cosmos__sat"
              data-a={a.id}
              style={{ "--delay": `${450 + i * 110}ms` } as CSSProperties}
              title={a.role}
              aria-label={`${a.name} — open its manual`}
              onClick={() => onPick(a.id)}
            >
              <i aria-hidden="true"><Ic name={a.id} /></i>
              {a.name}
            </button>
          </span>
        );
      })}
    </div>
  );
}
