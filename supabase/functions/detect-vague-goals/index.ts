import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

function logInvocation(functionName: string, summary: string) {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return;
    const client = createClient(url, key);
    EdgeRuntime.waitUntil(
      client.from("edge_function_invocations").insert({
        function_name: functionName,
        request_summary: summary.slice(0, 100),
      }),
    );
  } catch {
    // logging must never break the function
  }
}

const SYSTEM_PROMPT = `You are a goal-clarity checker for a habit-building app. You are given a list of personal goals (each with a 0-based index). Your job is to identify goals that are too vague to confidently act on — broad aspirations without a clear target or scope.

Examples of vague goals that SHOULD be flagged:
- "learn French" — no target level or context (suggestion: "become conversationally fluent in French")
- "get in shape" — no concrete outcome (suggestion: "lose 15 lbs and run a 5K")
- "be a better father" — no specific behavior or metric (suggestion: "spend 30 quality minutes with my kids daily")

Examples of goals that should NOT be flagged (already reasonably specific, even without a number):
- "walk 10,000 steps a day" — has a clear target and frequency
- "earn $100k a month" — has a concrete numeric target
- "run a marathon" — has a concrete outcome
- "read 20 pages daily" — has a frequency and quantity

Rules:
1. Only flag goals that are genuinely vague — broad aspirations where the person could succeed in many conflicting ways.
2. Do NOT flag goals that are already reasonably specific, even if they lack a number. If a goal has a concrete outcome, target, or action, leave it alone.
3. For each flagged goal, provide a short "reason" (under 100 characters) explaining why it's vague, and a "suggestion" — a tightened, more specific rewrite of that SAME goal (not a different goal). Keep suggestions under 80 characters.
4. Suggestions should be realistic and moderate, not maximal or extreme. Prefer behavioral or consistency-based rewrites over clinical precision. For example, "get a six-pack" → "define my abs through consistent training" is better than "reach 10% body fat." Do NOT add body-fat percentages, exact numeric health targets, or other clinical metrics unless the original goal already implied that level of precision.
5. If no goals are vague, return an empty flags array.
6. Each goal index may appear in at most one flag.

Output ONLY a JSON object matching this shape — no preamble, no markdown fences:
{
  "flags": [
    { "index": 0, "reason": "No target level or timeframe specified", "suggestion": "become conversationally fluent in French" }
  ]
}`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const { goals } = await req.json();

    if (!Array.isArray(goals) || goals.length === 0) {
      return json({ flags: [] });
    }

    const cleanedGoals = goals
      .filter((g): g is string => typeof g === "string" && g.trim().length > 0)
      .map((g) => g.trim().slice(0, 300));

    if (cleanedGoals.length === 0) {
      return json({ flags: [] });
    }

    logInvocation("detect-vague-goals", cleanedGoals.join(", "));

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return json({ error: "ANTHROPIC_API_KEY not configured" }, 500);
    }

    const goalList = cleanedGoals
      .map((g, i) => `${i}. ${g}`)
      .join("\n");

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: `Goals:\n${goalList}` }],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("anthropic_error", resp.status, errText.slice(0, 400));
      return json({ flags: [] });
    }

    const data = await resp.json();
    console.log("usage", JSON.stringify(data.usage ?? {}));

    const raw = (data.content?.[0]?.text ?? "")
      .replace(/```json|```/g, "")
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error("parse_failure", raw.slice(0, 400));
      return json({ flags: [] });
    }

    if (typeof parsed !== "object" || parsed === null) {
      return json({ flags: [] });
    }

    const obj = parsed as Record<string, unknown>;
    const rawFlags = Array.isArray(obj.flags) ? obj.flags : [];

    const validIndices = new Set(cleanedGoals.map((_, i) => i));
    const usedIndices = new Set<number>();

    const flags: { index: number; reason: string; suggestion: string }[] = [];

    for (const flag of rawFlags) {
      if (typeof flag !== "object" || flag === null) continue;
      const f = flag as Record<string, unknown>;

      const idx =
        typeof f.index === "number" && Number.isInteger(f.index) && validIndices.has(f.index) && !usedIndices.has(f.index)
          ? f.index
          : null;

      if (idx === null) continue;

      const reason =
        typeof f.reason === "string" && f.reason.trim().length > 0
          ? f.reason.trim().slice(0, 200)
          : "This goal could be more specific";

      const suggestion =
        typeof f.suggestion === "string" && f.suggestion.trim().length > 0
          ? f.suggestion.trim().slice(0, 200)
          : null;

      if (suggestion === null) continue;

      usedIndices.add(idx);
      flags.push({ index: idx, reason, suggestion });
    }

    return json({ flags });
  } catch (e) {
    console.error("handler_error", String(e).slice(0, 400));
    return json({ flags: [] });
  }
});
