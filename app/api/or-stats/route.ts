import { NextResponse } from "next/server";

/**
 * Server-side proxy for OpenRouter account stats. The API key stays in
 * OPENROUTER_API_KEY (.env.local) and never reaches the browser.
 *
 * - /api/v1/credits  → lifetime credits purchased + used (USD)
 * - /api/v1/activity → last-30-day rollups (tokens + spend per day/model)
 */

interface ActivityRow {
  usage?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  reasoning_tokens?: number;
}

export async function GET() {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    return NextResponse.json({ configured: false });
  }

  const headers = { Authorization: `Bearer ${key}` };
  try {
    const [creditsRes, activityRes] = await Promise.all([
      fetch("https://openrouter.ai/api/v1/credits", { headers, next: { revalidate: 60 } }),
      fetch("https://openrouter.ai/api/v1/activity", { headers, next: { revalidate: 300 } }),
    ]);

    let totalCredits: number | null = null;
    let totalUsage: number | null = null;
    if (creditsRes.ok) {
      const { data } = await creditsRes.json();
      totalCredits = data?.total_credits ?? null;
      totalUsage = data?.total_usage ?? null;
    }

    let tokens30d: number | null = null;
    let spend30d: number | null = null;
    if (activityRes.ok) {
      const { data } = (await activityRes.json()) as { data?: ActivityRow[] };
      const rows = Array.isArray(data) ? data : [];
      tokens30d = rows.reduce(
        (s, r) => s + (r.prompt_tokens ?? 0) + (r.completion_tokens ?? 0) + (r.reasoning_tokens ?? 0),
        0,
      );
      spend30d = rows.reduce((s, r) => s + (r.usage ?? 0), 0);
    }

    return NextResponse.json({ configured: true, totalCredits, totalUsage, tokens30d, spend30d });
  } catch {
    return NextResponse.json({ configured: true, error: true });
  }
}
