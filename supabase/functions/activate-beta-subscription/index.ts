import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: cors });
  }

  const jsonRes = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonRes({ error: "Missing authorization header" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();

    if (userError || !userData?.user) {
      return jsonRes({ error: "Invalid or expired session" }, 401);
    }

    const userId = userData.user.id;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: existing } = await admin
      .from("subscriptions")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (!existing) {
      const { error: insertError } = await admin.from("subscriptions").insert({
        user_id: userId,
        status: "active",
        plan: "annual",
        provider: "beta_stub",
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(
          Date.now() + 365 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      });
      if (insertError) throw insertError;
    }

    return jsonRes({ success: true });
  } catch (err) {
    console.error("activate-beta-subscription error:", err);
    return jsonRes(
      { error: err instanceof Error ? err.message : "Failed" },
      500,
    );
  }
});
