import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_GOALS = 10;
const MAX_GOAL_LEN = 200;
const MAX_STATEMENT_WORDS = 14;

const SYSTEM_PROMPT = `You convert personal goals into identity statements for a habit app. The user must read each statement as who they ARE — not what they did or will do.

Rules — follow every one:
1. First person, present tense, stated as already true. Never future tense, never "I will", never "I want", never past tense.
2. Prefer a natural identity noun when one exists: "I am an author.", "I am a runner.", "I am a non-smoker.", "I am an early riser." Only use a noun that a person would genuinely call themselves — never force awkward ones ("I am a walker" is forced; skip it).
3. Ongoing daily practices keep their action form with frequency — the action IS the identity: "I walk 10,000 steps a day.", "I drink a gallon of water a day.", "I read 10 pages a day."
4. Skills and states use "I am ...": "I am fluent in French.", "I am 20 lbs lighter."
5. 10 words or fewer per statement.
6. No quotation marks, no emojis, no exclamation points, no preamble.
7. Preserve the user's numbers, units, and timeframes when the statement keeps its action form — expand bare shorthand for readability (10k → 10,000). Currency stays as written.
8. End each statement with a period.
9. If a goal is unintelligible, offensive, or not a real goal, return null for that entry.

Output: ONLY a JSON array of strings (or null), same length and order as the input array. No markdown fences, no commentary.

Examples:
Input: ["self publish a book","walk 10k steps a day","fluent in French","lose 20 lbs","run a marathon","read 10 books","quit smoking"]
Output: ["I am a published author.","I walk 10,000 steps a day.","I am fluent in French.","I am 20 lbs lighter.","I am a marathoner.","I am a reader.","I am a non-smoker."]`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  try {
    const { goals } = await req.json();

    if (
      !Array.isArray(goals) ||
      goals.length === 0 ||
      goals.length > MAX_GOALS ||
      !goals.every((g) => typeof g === "string" && g.trim().length > 0)
    ) {
      return json({ error: "goals must be a non-empty array of strings" }, 400);
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return json({ error: "ANTHROPIC_API_KEY not configured" }, 500);
    }

    const cleaned = goals.map((g: string) => g.trim().slice(0, MAX_GOAL_LEN));

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
        messages: [{ role: "user", content: JSON.stringify(cleaned) }],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("anthropic_error", resp.status, errText.slice(0, 300));
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
      console.error("parse_failure", raw.slice(0, 300));
      return json({ error: "parse_failure" }, 502);
    }

    if (!Array.isArray(parsed) || parsed.length !== cleaned.length) {
      return json({ error: "shape_mismatch" }, 502);
    }

    const statements = parsed.map((s) => {
      if (typeof s !== "string") return null;
      const t = s.trim();
      if (t.length === 0) return null;
      if (t.split(/\s+/).length > MAX_STATEMENT_WORDS) return null;
      return t;
    });

    return json({ statements });
  } catch (e) {
    console.error("handler_error", String(e).slice(0, 300));
    return json({ error: "bad_request" }, 400);
  }
});
