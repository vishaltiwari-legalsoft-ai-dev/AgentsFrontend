import { describe, expect, it } from "vitest";
import { until } from "./format";
import {
  GEO_AGENT_ID, LIVE_AGENTS, PANELS,
  agentsFor, canOpen, canOpenAgent, canOpenWorkspace, panelsFor, routeFromHash,
  type PanelId, type Viewer,
} from "./model";

/* `until` mirrors `ago`, and like it takes an explicit `now` so a test never
 * depends on the machine's clock. */

const NOW = new Date("2026-09-01T10:00:00Z");
const plus = (ms: number) => new Date(NOW.getTime() + ms).toISOString();

describe("until", () => {
  it("counts minutes", () => {
    expect(until(plus(3 * 60_000), NOW)).toBe("in 3 minutes");
    expect(until(plus(60_000), NOW)).toBe("in 1 minute");
  });

  it("counts hours", () => {
    expect(until(plus(6 * 3_600_000), NOW)).toBe("in 6 hours");
    expect(until(plus(3_600_000), NOW)).toBe("in 1 hour");
  });

  it("counts days", () => {
    expect(until(plus(2 * 86_400_000), NOW)).toBe("in 2 days");
    expect(until(plus(86_400_000), NOW)).toBe("in 1 day");
  });

  it("says a past or present time is due, not broken", () => {
    expect(until(plus(0), NOW)).toBe("any moment now");
    expect(until(plus(-3_600_000), NOW)).toBe("any moment now");
    expect(until(plus(30_000), NOW)).toBe("any moment now");
  });

  it("names the date once it is too far away to count", () => {
    expect(until(plus(45 * 86_400_000), NOW)).toBe("on October 16");
  });

  it("says nothing about a timestamp it cannot parse", () => {
    expect(until("not a date", NOW)).toBe("");
  });
});

/* ----------------------------------------------------------- scope wall -- */

/* The backend serves a GEO-only account sign-in, the shell's four reads, the
 * SEO/GEO overview and all 25 `/api/geo/*` routes, and refuses the other 143
 * with a 403. These are the console's half of that contract: every rail entry,
 * workspace and hash it will still offer such a reader, and — just as
 * load-bearing — that nobody else's view moved a pixel.
 *
 * `panelIds(viewer)` is the whole rail, so a panel added without deciding its
 * `inGeoScope` shows up here as a failure rather than as a 403 in production.
 */

const MEMBER: Viewer = {};
const ADMIN: Viewer = { is_admin: true };
const CREATOR: Viewer = { is_admin: true, is_creator: true };
const SCOPED: Viewer = { is_geo_only: true };
/* A session stored before the wall shipped carries no field at all. */
const STORED_BEFORE: Viewer = { is_admin: false, is_creator: false };

const panelIds = (v: Viewer): PanelId[] => panelsFor(v).map((p) => p.id);
const panel = (id: PanelId) => PANELS.find((p) => p.id === id)!;

describe("the rail a GEO-only account is offered", () => {
  it("is exactly the panels whose every read the backend still answers", () => {
    expect(panelIds(SCOPED)).toEqual(["home", "issues", "agents", "runs", "settings"]);
  });

  it("keeps Agents, because it is the only way into the GEO workspace", () => {
    expect(canOpen(panel("agents"), SCOPED)).toBe(true);
  });

  it("drops Library, whose brand-kit read is an /api/gd route", () => {
    expect(canOpen(panel("library"), SCOPED)).toBe(false);
  });

  it("drops Integrations, whose connector read is an /api/mr route", () => {
    expect(canOpen(panel("integrations"), SCOPED)).toBe(false);
  });

  it("drops Models, Schedule and Admin", () => {
    expect(canOpen(panel("models"), SCOPED)).toBe(false);
    expect(canOpen(panel("schedule"), SCOPED)).toBe(false);
    expect(canOpen(panel("admin"), SCOPED)).toBe(false);
  });

  it("keeps Settings, which reads nothing from the backend at all", () => {
    expect(canOpen(panel("settings"), SCOPED)).toBe(true);
  });

  it("refuses a scoped account even when it also carries a role", () => {
    // The wall is the backend's decision; a role cannot argue with a 403.
    expect(canOpen(panel("admin"), { is_geo_only: true, is_admin: true })).toBe(false);
    expect(canOpen(panel("models"), { is_geo_only: true, is_creator: true })).toBe(false);
  });
});

describe("what the scope wall leaves untouched", () => {
  it("shows a member the same eight entries as before", () => {
    expect(panelIds(MEMBER)).toEqual([
      "home", "issues", "agents", "runs", "library", "integrations", "settings",
    ]);
  });

  it("shows an admin and a creator what they saw before", () => {
    expect(panelIds(ADMIN)).toEqual([
      "home", "issues", "agents", "runs", "library", "integrations", "settings", "admin",
    ]);
    expect(panelIds(CREATOR)).toEqual([
      "home", "issues", "agents", "runs", "library", "models", "integrations",
      "schedule", "settings", "admin",
    ]);
  });

  it("treats a session stored before the wall exactly as a member", () => {
    expect(panelIds(STORED_BEFORE)).toEqual(panelIds(MEMBER));
    expect(agentsFor(STORED_BEFORE)).toEqual(LIVE_AGENTS);
  });

  it("leaves every specialist open to everyone who is not scoped", () => {
    for (const v of [MEMBER, ADMIN, CREATOR, STORED_BEFORE]) {
      expect(agentsFor(v)).toEqual(LIVE_AGENTS);
      expect(canOpenWorkspace("mr", v)).toBe(true);
      expect(canOpenWorkspace("art", v)).toBe(true);
    }
  });
});

describe("the specialists a GEO-only account is offered", () => {
  it("is GEO and nothing else", () => {
    expect(agentsFor(SCOPED).map((a) => a.id)).toEqual([GEO_AGENT_ID]);
  });

  it("refuses the four workspaces whose first read 403s", () => {
    expect(canOpenWorkspace("seo", SCOPED)).toBe(false);
    expect(canOpenWorkspace("mr", SCOPED)).toBe(false);
    expect(canOpenWorkspace("blog", SCOPED)).toBe(false);
    expect(canOpenWorkspace("art", SCOPED)).toBe(false);
  });

  it("allows the GEO workspace", () => {
    expect(canOpenWorkspace("geo", SCOPED)).toBe(true);
    expect(canOpenAgent(GEO_AGENT_ID, SCOPED)).toBe(true);
  });

  it("refuses a slug that names no specialist, for anybody", () => {
    expect(canOpenWorkspace("nope", SCOPED)).toBe(false);
    expect(canOpenWorkspace("nope", CREATOR)).toBe(false);
  });
});

describe("routeFromHash under the scope wall", () => {
  it("sends a bookmarked MR workspace home rather than into a 403", () => {
    expect(routeFromHash("#/w/mr/workspace/desk", SCOPED)).toEqual({ panel: "home", work: null });
  });

  it("still opens that same bookmark for a member", () => {
    expect(routeFromHash("#/w/mr/workspace/desk", MEMBER)).toEqual({
      panel: "agents",
      work: { slug: "mr", subject: "workspace", section: "desk" },
    });
  });

  it("keeps a GEO deep link working for a scoped reader", () => {
    expect(routeFromHash("#/w/geo/b1/answers", SCOPED)).toEqual({
      panel: "agents",
      work: { slug: "geo", subject: "b1", section: "answers" },
    });
  });

  it("sends a bookmarked Library or Integrations panel home", () => {
    expect(routeFromHash("#/library", SCOPED)).toEqual({ panel: "home", work: null });
    expect(routeFromHash("#/integrations", SCOPED)).toEqual({ panel: "home", work: null });
  });

  it("still opens Runs and Issues, which the backend answers", () => {
    expect(routeFromHash("#/runs", SCOPED)).toEqual({ panel: "runs", work: null });
    expect(routeFromHash("#/issues", SCOPED)).toEqual({ panel: "issues", work: null });
  });
});
