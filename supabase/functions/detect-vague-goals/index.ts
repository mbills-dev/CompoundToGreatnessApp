import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SYSTEM_PROMPT = `You are a goal-clarity checker for a habit-building app called CTG (Commit to Greatness). CTG ultimately translates goals into daily controllable inputs. You are given a list of personal goals (each with a 0-based index). Your job is to identify goals that are too vague to confidently act on — broad aspirations without a clear target or scope.

THIS SCREEN DEFINES THE DESTINATION. THE DOWNSTREAM PATH DETERMINES HOW TO GET THERE.
Your job is only to make the desired outcome/intention sufficiently clear for the next stage to reverse engineer it.

Examples of goals that should NOT be flagged (already reasonably specific, even without a number):
- "walk 10,000 steps a day" — has a clear target and frequency
- "earn $100k a month" — has a concrete numeric target
- "run a marathon" — has a concrete outcome
- "read 20 pages daily" — has a frequency and quantity
- "run a 5K" — concrete outcome, even though it's not a daily action
- "speak conversational French" — clear target proficiency level
- "read 12 books" — clear cumulative numeric target
- "pay off $20K debt" — clear numeric target

Examples of vague goals that SHOULD be flagged:
- "learn French" — no target level or context
- "get in shape" — no concrete outcome
- "be a better father" — no specific behavior or metric
- "grow closer to God" — could mean many different things
- "pay off debt" — missing the amount
- "save money" — missing the target amount
- "lose weight" — missing the amount

There are TWO types of unclear goals. Classify each flagged goal as one of them:

TYPE A — "ambiguous": The intention is meaningful but there are multiple reasonable ways to define what the user means. For these, provide 1-3 alternative clarified rewrites of the SAME goal. These are ALTERNATIVES — the user selects ONE. They are NOT three inputs to add together. Only provide multiple suggestions when they represent genuinely useful, meaningfully different interpretations. Do NOT generate filler merely to reach 3.

TYPE B — "missing_information": The meaning is clear but an essential parameter is missing (e.g. dollar amount, weight, quantity). For these, do NOT invent the missing value. Instead, identify what information is missing and ask the user for it via missingFields.

CRITICAL RULES:
1. NEVER invent user-specific facts. Do NOT fabricate dollar amounts, weights, quantities, dates, deadlines, timeframes, debt types, income levels, book counts, distances, target metrics, frequencies, or personal circumstances when the user did not provide them. If a missing value is necessary to make the goal sufficiently specific, ask the user for it via missingFields — do not guess.
2. Do NOT refine a goal into a weekly-only, weekdays-only, 5-days-per-week, occasional, or other non-daily execution prescription. However, do NOT generate the eventual daily Success Stack or prescribe the user's daily actions during clarification. Your job is only to make the desired outcome/intention sufficiently clear for the next stage to reverse engineer it.
3. Do NOT output daily inputs or Success Stack items such as "walk 10,000 steps/day", "make 3 offers/day", "eat 145g protein/day", "read 21 pages/day", or "practice French for 30 minutes/day" UNLESS that behavior is genuinely the user's clarified GOAL itself. Those are downstream inputs produced by the decode paths.
4. Do NOT add a timeframe if the user did not provide one. The downstream path handles timeframe selection separately.
5. Suggestions should be realistic and moderate, not maximal or extreme.
6. For "ambiguous" goals, suggestions should be under 80 characters each.
7. For "missing_information" goals, set suggestions to an empty array and use missingFields instead.
8. If no goals are vague, return an empty flags array.
9. Each goal index may appear in at most one flag.

missingFields format:
Each missingField has: "key" (snake_case identifier), "label" (human-readable question), "type" ("text" or "choice"), and for type "choice" an "options" array of strings. Only include a field if it is genuinely required to define the goal sufficiently for routing. Do not collect information merely because it might be useful later.

Output ONLY a JSON object matching this shape — no preamble, no markdown fences:
{
  "flags": [
    {
      "index": 0,
      "clarificationType": "ambiguous",
      "reason": "This could mean several different things",
      "suggestions": ["Deepen my relationship with God through daily prayer", "Build a consistent daily Bible-reading practice"],
      "missingFields": []
    },
    {
      "index": 1,
      "clarificationType": "missing_information",
      "reason": "Amount is needed to define this goal",
      "suggestions": [],
      "missingFields": [
        { "key": "amount", "label": "How much debt do you want to pay off?", "type": "text" },
        { "key": "debt_type", "label": "What kind of debt?", "type": "choice", "options": ["Credit cards", "Student loans", "Car", "Other"] }
      ]
    }
  ]
}`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const jsonRes = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    if (req.method !== "POST") {
      return jsonRes({ error: "Method not allowed" }, 405);
    }

    const { goals } = await req.json();

    if (!Array.isArray(goals) || goals.length === 0) {
      return jsonRes({ flags: [] });
    }

    const cleanedGoals = goals
      .filter((g): g is string => typeof g === "string" && g.trim().length > 0)
      .map((g) => g.trim().slice(0, 300));

    if (cleanedGoals.length === 0) {
      return jsonRes({ flags: [] });
    }

    console.log(`[INVOKED] detect-vague-goals at ${new Date().toISOString()} - goals: ${cleanedGoals.join(", ").slice(0, 80)}`);

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return jsonRes({ error: "ANTHROPIC_API_KEY not configured" }, 500);
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
        max_tokens: 1200,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: `Goals:\n${goalList}` }],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("anthropic_error", resp.status, errText.slice(0, 400));
      return jsonRes({ flags: [] });
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
      return jsonRes({ flags: [] });
    }

    if (typeof parsed !== "object" || parsed === null) {
      return jsonRes({ flags: [] });
    }

    const obj = parsed as Record<string, unknown>;
    const rawFlags = Array.isArray(obj.flags) ? obj.flags : [];

    const validIndices = new Set(cleanedGoals.map((_, i) => i));
    const usedIndices = new Set<number>();

    interface MissingField {
      key: string;
      label: string;
      type: "text" | "choice";
      options?: string[];
    }

    const flags: {
      index: number;
      clarificationType: "ambiguous" | "missing_information";
      reason: string;
      suggestions: string[];
      missingFields: MissingField[];
    }[] = [];

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

      const rawType = typeof f.clarificationType === "string" ? f.clarificationType : "";
      const clarificationType: "ambiguous" | "missing_information" =
        rawType === "missing_information" ? "missing_information" : "ambiguous";

      let suggestions: string[] = [];

      if (Array.isArray(f.suggestions)) {
        suggestions = f.suggestions
          .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
          .map((s) => s.trim().slice(0, 200));
      } else if (typeof f.suggestion === "string" && f.suggestion.trim().length > 0) {
        suggestions = [f.suggestion.trim().slice(0, 200)];
      }

      let missingFields: MissingField[] = [];
      if (Array.isArray(f.missingFields)) {
        missingFields = (f.missingFields as unknown[])
          .filter((mf): mf is Record<string, unknown> => typeof mf === "object" && mf !== null)
          .map((mf) => {
            const key = typeof mf.key === "string" ? mf.key : "";
            const label = typeof mf.label === "string" ? mf.label : "";
            const type = mf.type === "choice" ? "choice" : "text";
            const options = Array.isArray(mf.options)
              ? mf.options.filter((o): o is string => typeof o === "string")
              : undefined;
            return { key, label, type, options };
          })
          .filter((mf) => mf.key.length > 0 && mf.label.length > 0)
          .slice(0, 5);
      }

      if (clarificationType === "missing_information" && missingFields.length === 0 && suggestions.length === 0) {
        continue;
      }

      if (clarificationType === "ambiguous" && suggestions.length === 0) {
        continue;
      }

      usedIndices.add(idx);
      flags.push({ index: idx, clarificationType, reason, suggestions, missingFields });
    }

    return jsonRes({ flags });
  } catch (e) {
    console.error("handler_error", String(e).slice(0, 400));
    return jsonRes({ flags: [] });
  }
});
