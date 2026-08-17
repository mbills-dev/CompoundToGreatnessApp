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

const SYSTEM_PROMPT = `You are a goal-overlap detector for a habit-building app. You are given a list of personal goals (each with a 0-based index). Your job is to identify goals that are substantially the SAME underlying outcome — where achieving one would likely produce the other, or they describe the same end result in different terms.

Examples of genuine outcome overlap:
- "$100k a month" and "$1M this year" — one likely produces the other.
- "Lose 20 lbs" and "Get to 15% body fat" — same physical outcome for most people.
- "Run a marathon" and "Complete a 26.2 mile race" — literally the same thing.

NOT overlap (do NOT group these):
- Two different business goals that happen to both involve money (e.g. "grow my agency to $50k MRR" and "launch a SaaS to $10k MRR") — they are different ventures.
- "Eat healthier" and "Lose 20 lbs" — related category but different outcomes.
- "Read more books" and "Write a book" — same domain, opposite directions.

Rules:
1. Only group goals with genuine outcome overlap — where achieving one essentially achieves the other.
2. Never group goals merely because they share a topic, category, or domain.
3. If no goals genuinely overlap, return an empty groups array.
4. Each goal index may appear in at most one group.
5. Groups should contain at least 2 indices.
6. The "reason" field should be a short explanation (under 100 characters) of why these goals overlap.

Output ONLY a JSON object matching this shape — no preamble, no markdown fences:
{
  "groups": [
    { "indices": [0, 2], "reason": "Both describe reaching the same income target" }
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

    if (!Array.isArray(goals) || goals.length < 2) {
      return json({ groups: [] });
    }

    const cleanedGoals = goals
      .filter((g): g is string => typeof g === "string" && g.trim().length > 0)
      .map((g) => g.trim().slice(0, 300));

    if (cleanedGoals.length < 2) {
      return json({ groups: [] });
    }

    logInvocation("detect-overlapping-goals", cleanedGoals.join(", "));

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
      return json({ groups: [] });
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
      return json({ groups: [] });
    }

    if (typeof parsed !== "object" || parsed === null) {
      return json({ groups: [] });
    }

    const obj = parsed as Record<string, unknown>;
    const rawGroups = Array.isArray(obj.groups) ? obj.groups : [];

    const validIndices = new Set(cleanedGoals.map((_, i) => i));
    const usedIndices = new Set<number>();

    const groups: { indices: number[]; reason: string }[] = [];

    for (const group of rawGroups) {
      if (typeof group !== "object" || group === null) continue;
      const g = group as Record<string, unknown>;

      const indices = Array.isArray(g.indices)
        ? g.indices
            .filter(
              (n): n is number =>
                typeof n === "number" &&
                Number.isInteger(n) &&
                validIndices.has(n) &&
                !usedIndices.has(n),
            )
        : [];

      const reason =
        typeof g.reason === "string" && g.reason.trim().length > 0
          ? g.reason.trim().slice(0, 200)
          : "These goals may describe the same outcome";

      if (indices.length >= 2) {
        indices.forEach((n) => usedIndices.add(n));
        groups.push({ indices, reason });
      }
    }

    return json({ groups });
  } catch (e) {
    console.error("handler_error", String(e).slice(0, 400));
    return json({ groups: [] });
  }
});
