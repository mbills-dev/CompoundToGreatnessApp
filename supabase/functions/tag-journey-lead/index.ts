import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const KIT_TAG_NAME = "c2g-watcher-lead";

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
    const { email, name } = await req.json();
    if (!email) {
      return json({ error: "email is required" }, 400);
    }

    const kitApiKey = Deno.env.get("KIT_API_KEY");
    if (!kitApiKey) {
      console.error("tag-journey-lead: KIT_API_KEY secret is not set");
      return json({ error: "Kit not configured" }, 500);
    }

    const firstName = (name || "").trim().split(" ")[0] || null;

    await fetch("https://api.kit.com/v4/subscribers", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Kit-Api-Key": kitApiKey },
      body: JSON.stringify({ email_address: email, first_name: firstName }),
    });

    const tagsRes = await fetch("https://api.kit.com/v4/tags", {
      headers: { "X-Kit-Api-Key": kitApiKey },
    });
    const tagsData = await tagsRes.json();
    const tag = (tagsData.tags || []).find(
      (t: { id: number; name: string }) => t.name === KIT_TAG_NAME
    );
    if (!tag) {
      console.error(`tag-journey-lead: tag "${KIT_TAG_NAME}" not found in Kit account`);
      return json({ error: "Tag not found" }, 500);
    }

    const tagRes = await fetch(`https://api.kit.com/v4/tags/${tag.id}/subscribers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Kit-Api-Key": kitApiKey },
      body: JSON.stringify({ email_address: email }),
    });
    if (!tagRes.ok) {
      const errBody = await tagRes.text();
      throw new Error(`Kit tag request failed: ${errBody}`);
    }

    return json({ success: true });
  } catch (err) {
    console.error("tag-journey-lead error:", err);
    return json({ error: err instanceof Error ? err.message : "Failed" }, 500);
  }
});
