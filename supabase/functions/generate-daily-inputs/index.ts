import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SYSTEM_PROMPT = `You are a daily-input generator for a habit-building app. Given a personal goal, you propose specific, measurable daily inputs that, if done consistently, would lead to achieving that goal.

Rules — follow every one:
1. Propose 2-3 inputs per goal. Each input MUST be specific and measurable — it must contain a number, a duration, or a clear done/not-done criterion. Never use vague phrasing like "drink more water," "be more active," or "eat better." Instead: "drink 3 liters of water," "walk 10,000 steps," "eat 5 servings of vegetables."
2. EVERY suggestion must be a true daily action — something the user can do in a single day. Never propose a weekly cadence, and never use the word "today" in any suggestion. Phrase daily actions as a per-day habit. If an action is inherently weekly-sounding, reword it into a daily equivalent. For example, "complete 3 resistance sessions weekly" becomes "do a resistance training session a day" or "spend 20 minutes on resistance training a day." "Run 15 miles per week" becomes "run 2 miles a day."
3. If the goal is too broad to generate a confident, specific input (e.g. "get my finances in order," "be a better father," "improve my relationship"), set specificity to "low" and provide exactly ONE clarifying_question that targets a concrete value needed to define a measurable daily unit — such as time available per day, a page/word/rep/dollar count, or a frequency constraint. Never ask open-ended exploratory questions about the nature, genre, type, or style of the goal. Good: "How many pages or minutes per day can you commit to writing?" — bad: "Is it science fiction or nonfiction?" Good: "How many minutes per day can you dedicate to this?" — bad: "What kind of relationship do you want to improve?" Good: "How many dollars per day can you set aside?" — bad: "What are your financial goals?" Still return your best-guess suggestions — never leave the suggestions array empty.
4. If the goal is already specific enough to generate confident inputs, set specificity to "high" and set clarifying_question to null.
5. If clarification history is provided (prior Q&A pairs for this goal), treat each answer as additional context appended to the goal and generate higher-confidence suggestions. If you STILL cannot generate confident inputs even with the history, force specificity to "high" anyway and return the best available guess with clarifying_question set to null — do not ask another follow-up. If context from the user's other goals in this session is provided, reuse relevant facts (e.g. an existing business, income source, or schedule constraint) without re-asking.
6. Each suggestion has a "frequency" field which is ALWAYS "daily".
7. Keep each input string under 80 characters. No quotation marks, no emojis, no exclamation points.
8. Include an "identityLine" field: a single natural, present-tense, first-person "I..." sentence describing the goal as already true. It must start with "I " and end with a period. Write it as though the person has already achieved the goal. Examples: "drive a Tesla Model X" → "I drive a Tesla Model X."; "be debt free" → "I am debt free."; "have over 300,000 YouTube subscribers" → "I have over 300,000 YouTube subscribers."
9. No preamble, no commentary, no markdown fences. Output ONLY a JSON object matching the required shape.

Output shape (exactly):
{
  "goal": "<the original goal string>",
  "identityLine": "<first-person present-tense I... sentence>",
  "specificity": "high" | "low",
  "clarifying_question": "string | null",
  "suggestions": [
    { "input": "<specific measurable daily action>", "frequency": "daily" }
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

    const { goal, history, otherGoalsContext } = await req.json();

    if (!goal || typeof goal !== "string" || goal.trim().length === 0) {
      return json({ error: "goal is required" }, 400);
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return json({ error: "ANTHROPIC_API_KEY not configured" }, 500);
    }

    const cleanedGoal = goal.trim().slice(0, 300);
    let userContent = `Goal: ${cleanedGoal}`;

    if (Array.isArray(history)) {
      for (const entry of history) {
        if (
          entry && typeof entry === "object" &&
          typeof (entry as Record<string, unknown>).question === "string" &&
          typeof (entry as Record<string, unknown>).answer === "string"
        ) {
          const e = entry as { question: string; answer: string };
          userContent += `\nQ: ${e.question.trim().slice(0, 300)}\nA: ${e.answer.trim().slice(0, 300)}`;
        }
      }
    }

    if (Array.isArray(otherGoalsContext) && otherGoalsContext.length > 0) {
      const contextLines = otherGoalsContext
        .filter(
          (g): g is { goal: string; context: string } =>
            g !== null && typeof g === "object" &&
            typeof (g as Record<string, unknown>).goal === "string" &&
            typeof (g as Record<string, unknown>).context === "string",
        )
        .map((g) => `- Goal: "${g.goal.trim().slice(0, 200)}" — Context: ${g.context.trim().slice(0, 300)}`);
      if (contextLines.length > 0) {
        userContent += `\n\nContext from the user's other goals in this session:\n${contextLines.join("\n")}`;
      }
    }

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
        messages: [{ role: "user", content: userContent }],
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
    const specificity = obj.specificity;
    if (specificity !== "high" && specificity !== "low") {
      return json({ error: "shape_mismatch" }, 502);
    }

    const clarifyingQuestion =
      typeof obj.clarifying_question === "string" && obj.clarifying_question.trim().length > 0
        ? obj.clarifying_question.trim()
        : null;

    const isSecondRound = Array.isArray(history) && history.length >= 1;
    const finalSpecificity: "high" | "low" = isSecondRound ? "high" : (specificity === "high" || specificity === "low" ? specificity : "low");
    const finalClarifyingQuestion = isSecondRound ? null : clarifyingQuestion;

    const suggestions = Array.isArray(obj.suggestions)
      ? obj.suggestions
          .filter((s): s is Record<string, unknown> => typeof s === "object" && s !== null)
          .map((s) => ({
            input: typeof s.input === "string" ? s.input.trim() : "",
            frequency: "daily",
          }))
          .filter((s) => s.input.length > 0)
      : [];

    if (suggestions.length === 0) {
      return json({ error: "shape_mismatch" }, 502);
    }

    const identityLine =
      typeof obj.identityLine === "string" && obj.identityLine.trim().length > 0
        ? obj.identityLine.trim()
        : null;

    return json({
      goal: cleanedGoal,
      identityLine,
      specificity: finalSpecificity,
      clarifying_question: finalClarifyingQuestion,
      suggestions,
    });
  } catch (e) {
    console.error("handler_error", String(e).slice(0, 400));
    return json({ error: "bad_request" }, 400);
  }
});
