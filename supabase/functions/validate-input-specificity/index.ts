import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SYSTEM_PROMPT = `You are a specificity judge for a habit-building app. Given a single daily-input string (the action a user commits to doing daily), you judge whether it is specific enough to be unambiguously "done" or "not done" at the end of a day.

A daily input is SPECIFIC if it contains at least one of:
- A number or measurable quantity (e.g. "30 push-ups", "read 20 pages", "drink 3 liters of water")
- A clear frequency or count (e.g. "meditate once", "write 2 paragraphs")
- A clear binary done/not-done criterion (e.g. "no sugar", "cold shower", "make my bed")

A daily input is NOT SPECIFIC if it is vague and has no clear completion line (e.g. "drink more water", "be more active", "eat better", "practice guitar").

Rules — follow every one:
1. Output ONLY a JSON object matching the required shape. No prose, no markdown fences, no preamble.
2. If specific is true, set nudge to null and examples to null.
3. If specific is false, write a short encouraging nudge (one sentence, under 100 chars, no quotes, no emojis) that gently explains what's missing. Then provide 1-2 rewritten versions of the USER'S OWN input that make it specific — do not invent an unrelated example. Keep each example under 80 chars. No quotation marks, no emojis, no exclamation points.

Output shape (exactly):
{
  "specific": true | false,
  "nudge": "string | null",
  "examples": ["string", "string"] | null
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

    const { input } = await req.json();

    if (!input || typeof input !== "string" || input.trim().length === 0) {
      return json({ error: "input is required" }, 400);
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return json({ error: "ANTHROPIC_API_KEY not configured" }, 500);
    }

    const cleanedInput = input.trim().slice(0, 300);

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: `Daily input: ${cleanedInput}` }],
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
    const specific = obj.specific === true;

    const nudge =
      typeof obj.nudge === "string" && obj.nudge.trim().length > 0
        ? obj.nudge.trim()
        : null;

    const examples =
      Array.isArray(obj.examples)
        ? obj.examples
            .filter((e): e is string => typeof e === "string" && e.trim().length > 0)
            .map((e) => e.trim())
            .slice(0, 2)
        : specific
          ? null
          : null;

    return json({
      specific,
      nudge: specific ? null : nudge,
      examples: specific ? null : examples,
    });
  } catch (e) {
    console.error("handler_error", String(e).slice(0, 400));
    return json({ error: "bad_request" }, 400);
  }
});
