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

const SYSTEM_PROMPT = `You are a goal-extraction assistant for a habit-building app. The user uploads a photo that may contain handwritten or typed text listing their personal goals.

Your job:
1. Read all the text in the image (handwritten or typed).
2. Extract the items that are personal goals — things the person wants to achieve, become, or improve.
3. Return each goal as a clean, concise string (e.g. "lose 20 lbs", "earn $10k/month", "read 10 books", "be a better dad").
4. Normalize obvious typos and shorthand into readable goal phrases. Preserve numbers, units, and currency.
5. Ignore non-goal text (labels, doodles, headers, random notes) — only return actual goals.

If the image contains nothing resembling personal goals (e.g. it's a landscape, a receipt, a random document, or blank), return an empty array.

Output format: ONLY a JSON array of strings. No markdown fences, no commentary, no preamble.
Example output: ["lose 20 lbs", "earn $10k/month", "read 10 books"]
If no goals found: []`;

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

    const { imageUrl } = await req.json();

    if (!imageUrl || typeof imageUrl !== "string") {
      return json({ error: "imageUrl is required" }, 400);
    }

    logInvocation("extract-goals-from-photo", imageUrl.slice(0, 100));

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return json({ error: "ANTHROPIC_API_KEY not configured" }, 500);
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
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "url",
                  url: imageUrl,
                },
              },
              {
                type: "text",
                text: "Extract the personal goals from this image. Return only a JSON array of goal strings, or an empty array if none are found.",
              },
            ],
          },
        ],
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

    if (!Array.isArray(parsed)) {
      return json({ error: "shape_mismatch" }, 502);
    }

    const goals = parsed
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (goals.length === 0) {
      return json({ success: false, reason: "not_goals" });
    }

    return json({ success: true, goals });
  } catch (e) {
    console.error("handler_error", String(e).slice(0, 400));
    return json({ error: "bad_request" }, 400);
  }
});
