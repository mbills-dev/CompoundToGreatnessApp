import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

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
    const providedSecret = req.headers.get("x-webhook-secret");
    const expectedSecret = Deno.env.get("FOUNDING_MEMBER_WEBHOOK_SECRET");
    if (!expectedSecret || providedSecret !== expectedSecret) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { email, stripe_customer_id, stripe_subscription_id, purchased_at } = await req.json();
    if (!email) {
      return json({ error: "email is required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { error } = await admin
      .from("founding_members")
      .upsert(
        {
          email,
          stripe_customer_id: stripe_customer_id ?? null,
          stripe_subscription_id: stripe_subscription_id ?? null,
          purchased_at: purchased_at ?? new Date().toISOString(),
        },
        { onConflict: "email" }
      );
    if (error) throw error;

    return json({ success: true });
  } catch (err) {
    console.error("register-founding-member error:", err);
    return json({ error: err instanceof Error ? err.message : "Failed" }, 500);
  }
});
