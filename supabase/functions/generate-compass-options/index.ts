import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SYSTEM_PROMPT = `You are a compass-question generator for a habit-building app. Given a personal goal (the "big domino"), you generate 2-3 short, specific phrases that complete the sentence: "[goal] literally cannot happen unless I ___".

The phrases should describe the core mechanism — the single core lever that MUST happen for the goal to be possible. Think about what makes the goal inevitable, not just what helps it.

Rules — follow every one:
1. Return 2-3 options. Each must be a SHORT verb phrase — ideally 3-6 words, and under 35 characters. Do not write full sentences or strategy descriptions; write the shortest phrase that still makes sense as "Will it help me ___?"
2. Name the single core lever driving the goal, not a full strategy or method. Strip away anything that isn't the core action itself.
3. Each phrase reads naturally after "unless I " — so use bare verb phrases with no prefix like "I will" or "I need to".
4. No quotation marks, no emojis, no exclamation points, no trailing periods.
5. Do not repeat the goal or restate it; just give the completing phrase.
6. No preamble, no commentary, no markdown fences. Output ONLY the JSON object.

Style reference (these show the SHAPE, not answers to reuse — always generate options tailored to the actual goal you receive, never copy these examples verbatim regardless of what the input goal is):
  Goal "make $100k/month selling land deals" → "sell more deals"
  Goal "lose 20 lbs" → "lose weight"
  Goal "learn French" → "speak French daily"
Notice how each option is the shortest phrase that captures the one thing that makes the goal inevitable.

Output shape (exactly):
{ "options": ["short phrase 1", "short phrase 2", "short phrase 3"] }`;

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

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 300,
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
    if (!Array.isArray(obj.options)) {
      return json({ error: "shape_mismatch" }, 502);
    }

    const options = obj.options
      .filter((o): o is string => typeof o === "string" && o.trim().length > 0)
      .map((o) => o.trim().slice(0, 80))
      .slice(0, 3);

    if (options.length === 0) {
      return json({ error: "shape_mismatch" }, 502);
    }

    return json({ options });
  } catch (e) {
    console.error("handler_error", String(e).slice(0, 400));
    return json({ error: "bad_request" }, 400);
  }
});
