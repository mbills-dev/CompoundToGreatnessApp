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

const SYSTEM_PROMPT = `You classify personal goals into one of three approaches for a habit-building app.

Paths:
- "numbers": a goal reached through volume or measurable output — income, revenue, deals, clients, sales, referrals, subscribers, followers, downloads, leads, etc.
- "practice": a goal built through skill or time invested — crafts, languages, instruments, technical skills, creative mastery, etc.
- "starting": a goal built through daily habits, character, or health — or anything that doesn't clearly fit "numbers" or "practice".

Rules:
1. Choose exactly one path.
2. If the goal mentions earning, making, saving, or hitting a specific financial or count-based target, classify as "numbers".
3. If the goal is about building a skill through deliberate practice over time, classify as "practice".
4. When in doubt, choose "starting" — it is the safe default for habit-based goals.
5. If path is "numbers" AND the goal text confidently states a specific numeric target (e.g. "$100k a month", "300,000 subscribers", "$1,000,000 this year", "50 clients"), extract just the plain number as a string — strip dollar signs, commas, and suffixes like k/m (expand them: 100k → 100000). Return it as "extractedTarget".
6. If path is not "numbers", or if no specific number is confidently stated in the goal text, return null for "extractedTarget". Do NOT guess or invent a number that isn't explicitly in the goal.
7. If path is "starting", check whether the goal text is ALREADY a complete, specific, measurable daily action — it must contain a number or an explicit frequency or a clear done/not-done criterion (e.g. "walk 10,000 steps a day", "read 20 pages daily", "drink a gallon of water", "no phone before noon", "meditate 10 minutes every morning"). If it IS already such an action, return it verbatim (trimmed) as "standardAction". If the goal is vague or needs breaking down (e.g. "walk more", "learn French", "be a better father", "get fit"), return null for "standardAction".
8. If path is "practice", estimate "estimatedMasteryHours" — a rough, honest estimate of the TOTAL hours of deliberate practice needed to reach solid proficiency at this specific skill (not world-class mastery, just genuinely capable). Examples: learning a new language to conversational fluency ≈ 600; a technical skill like coding or design ≈ 300; a craft like woodworking or painting ≈ 300-600; an instrument to competent amateur ≈ 600; a complex skill like chess or Go ≈ 1000. Always return a number for practice-path goals — if genuinely uncertain, default to 300. Never return null for practice path.

Output shape (exactly):
{
  "path": "numbers" | "practice" | "starting",
  "extractedTarget": "string | null",
  "standardAction": "string | null",
  "estimatedMasteryHours": "number | null"
}

No preamble, no commentary, no markdown fences. Output ONLY the JSON object.`;

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

    const { goal } = await req.json();

    if (!goal || typeof goal !== "string" || goal.trim().length === 0) {
      return json({ error: "goal is required" }, 400);
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return json({ error: "ANTHROPIC_API_KEY not configured" }, 500);
    }

    const cleanedGoal = goal.trim().slice(0, 300);

    logInvocation("classify-goal-path", cleanedGoal);

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 200,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: `Goal: ${cleanedGoal}` }],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("anthropic_error", resp.status, errText.slice(0, 400));
      return json({ error: "upstream_error" }, 502);
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
      return json({ error: "parse_failure" }, 502);
    }

    if (typeof parsed !== "object" || parsed === null) {
      return json({ error: "shape_mismatch" }, 502);
    }

    const obj = parsed as Record<string, unknown>;
    const path = obj.path;
    if (path !== "numbers" && path !== "practice" && path !== "starting") {
      return json({ error: "shape_mismatch" }, 502);
    }

    let extractedTarget: string | null = null;
    if (path === "numbers" && typeof obj.extractedTarget === "string") {
      const t = obj.extractedTarget.trim();
      if (t.length > 0 && t !== "null") {
        extractedTarget = t;
      }
    }

    let standardAction: string | null = null;
    if (path === "starting" && typeof obj.standardAction === "string") {
      const a = obj.standardAction.trim();
      if (a.length > 0 && a !== "null") {
        standardAction = a;
      }
    }

    let estimatedMasteryHours: number | null = null;
    if (path === "practice" && typeof obj.estimatedMasteryHours === "number" && !isNaN(obj.estimatedMasteryHours) && obj.estimatedMasteryHours > 0) {
      estimatedMasteryHours = Math.round(obj.estimatedMasteryHours);
    } else if (path === "practice") {
      estimatedMasteryHours = 300;
    }

    return json({ path, extractedTarget, standardAction, estimatedMasteryHours });
  } catch (e) {
    console.error("handler_error", String(e).slice(0, 400));
    return json({ error: "bad_request" }, 400);
  }
});
