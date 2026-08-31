import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

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
9. If path is "numbers", also determine "numbersSubtype":
   - "funnel": the goal is reached through sales/outreach volume where a conversion ratio matters — revenue, income, deals, clients, sales calls, referrals, subscribers gained through outreach, leads, etc. The progress mechanism is: attempts × conversion-rate = wins, and wins have a value.
   - "direct": the goal's progress is a simple cumulative output with NO sales or conversion mechanism. Each unit of effort directly produces a unit of output — words written, pages read, vocabulary words learned, square feet painted, dollars saved, books read, lines of code written, drawings completed, etc. The progress mechanism is: daily_output × days = total_output.
   Be conservative: if the goal could plausibly involve a sales/conversion process, choose "funnel". Only choose "direct" when it's clearly a cumulative-output goal with no intermediary conversion step.
10. If numbersSubtype is "direct", also provide:
    - "unit": a short, human-readable string naming the daily-countable unit (e.g. "words", "vocabulary words", "sq ft", "pages", "dollars", "books", "drawings"). Keep it to 1-3 words, lowercase, plural.
    - "targetResolution": always return {"type": "ask", "question": <string>, "unit": <string>, "suggestions": [<3-4 strings>]} when there is no explicit extractedTarget. Use your judgment to pick the right suggestion strategy:
      (a) When the target is a genuine, estimable domain fact — e.g. a typical novel is ~80,000 words, a mural might be ~300 sq ft, a college-level vocabulary is ~3,000 words — generate 3-4 suggestions as DESCRIPTIVE, CALIBRATED TIERS with approximate values baked into each label. Use real domain knowledge so the tiers are meaningfully different and genuinely useful. Examples: for a book: ["Novella (~35,000 words)", "Standard novel (~80,000 words)", "Epic-length (~120,000 words)"]; for a mural: ["Small wall (~100 sq ft)", "Standard wall (~300 sq ft)", "Large facade (~600 sq ft)"]. The question should fit the domain (e.g. "How long do you want this book to be?").
      (b) When the target is inherently a personal choice with no objectively correct number — e.g. income goals, savings amounts, personal quantities to produce — keep the current behavior: natural question (e.g. "How much do you want to make per month?" for income, "How much do you want to save?" for savings) and 3-4 short preset amount suggestions.
      Generate the question and suggestions dynamically per-goal based on its context — do not use hardcoded category templates.
11. If numbersSubtype is "funnel", return null for "unit" and "targetResolution".

Output shape (exactly):
{
  "path": "numbers" | "practice" | "starting",
  "extractedTarget": "string | null",
  "standardAction": "string | null",
  "estimatedMasteryHours": "number | null",
  "numbersSubtype": "funnel" | "direct" | null,
  "unit": "string | null",
  "targetResolution": {
    "type": "ask",
    "question": "How much do you want to save?",
    "unit": "dollars",
    "suggestions": ["$5,000", "$10,000", "$25,000"]
  } | null
}

No preamble, no commentary, no markdown fences. Output ONLY the JSON object.`;

interface TargetResolution {
  type: "ask";
  question: string;
  unit: string;
  suggestions: string[];
}

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

    const { goal } = await req.json();

    if (!goal || typeof goal !== "string" || goal.trim().length === 0) {
      return jsonRes({ error: "goal is required" }, 400);
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return jsonRes({ error: "ANTHROPIC_API_KEY not configured" }, 500);
    }

    const cleanedGoal = goal.trim().slice(0, 300);

    console.log(`[INVOKED] classify-goal-path at ${new Date().toISOString()} - goal: ${cleanedGoal.slice(0, 80)}`);

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 250,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: `Goal: ${cleanedGoal}` }],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("anthropic_error", resp.status, errText.slice(0, 400));
      return jsonRes({ error: "upstream_error" }, 502);
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
      return jsonRes({ error: "parse_failure" }, 502);
    }

    if (typeof parsed !== "object" || parsed === null) {
      return jsonRes({ error: "shape_mismatch" }, 502);
    }

    const obj = parsed as Record<string, unknown>;
    const path = obj.path;
    if (path !== "numbers" && path !== "practice" && path !== "starting") {
      return jsonRes({ error: "shape_mismatch" }, 502);
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

    let numbersSubtype: "funnel" | "direct" | null = null;
    let unit: string | null = null;
    let targetResolution: TargetResolution | null = null;

    if (path === "numbers" && obj.numbersSubtype === "direct") {
      numbersSubtype = "direct";

      if (typeof obj.unit === "string" && obj.unit.trim().length > 0) {
        unit = obj.unit.trim();
      }

      const tr = obj.targetResolution;
      if (typeof tr === "object" && tr !== null) {
        const trObj = tr as Record<string, unknown>;
        if (trObj.type === "ask" && typeof trObj.question === "string" && trObj.question.trim().length > 0) {
          const suggestions = Array.isArray(trObj.suggestions)
            ? trObj.suggestions.filter((s): s is string => typeof s === "string" && s.trim().length > 0).map((s) => s.trim().slice(0, 100))
            : [];
          targetResolution = {
            type: "ask",
            question: trObj.question.trim().slice(0, 300),
            unit: typeof trObj.unit === "string" ? trObj.unit.trim() : unit ?? "units",
            suggestions: suggestions.length >= 2 ? suggestions : [],
          };
        }
      }
    } else if (path === "numbers") {
      numbersSubtype = "funnel";
    }

    return jsonRes({ path, extractedTarget, standardAction, estimatedMasteryHours, numbersSubtype, unit, targetResolution });
  } catch (e) {
    console.error("handler_error", String(e).slice(0, 400));
    return jsonRes({ error: "bad_request" }, 400);
  }
});
