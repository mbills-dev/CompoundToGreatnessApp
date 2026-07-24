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

    const { recipientUserId, title, body, data } = await req.json();
    if (!recipientUserId || !title || !body) {
      return jsonRes(
        { error: "recipientUserId, title, and body are required" },
        400,
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: tokens, error: tokensError } = await admin
      .from("push_tokens")
      .select("token")
      .eq("user_id", recipientUserId);

    if (tokensError) throw tokensError;

    if (!tokens || tokens.length === 0) {
      return jsonRes({ sent: 0 });
    }

    const messages = tokens.map((row: { token: string }) => ({
      to: row.token,
      title,
      body,
      data: data ?? {},
      sound: "default",
    }));

    const expoRes = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(messages),
    });

    const expoStatus = expoRes.status;
    let expoBody: unknown = null;
    try {
      expoBody = await expoRes.json();
    } catch {
      expoBody = await expoRes.text();
    }

    return jsonRes({ sent: messages.length, expoStatus, expoBody });
  } catch (err) {
    console.error("send-push error:", err);
    return jsonRes(
      { error: err instanceof Error ? err.message : "Failed" },
      500,
    );
  }
});
