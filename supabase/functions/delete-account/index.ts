import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing authorization header" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();

    if (userError || !userData?.user) {
      return json({ error: "Invalid or expired session" }, 401);
    }

    const userId = userData.user.id;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { error: goalsError } = await admin.from("goals").delete().eq("user_id", userId);
    if (goalsError) throw goalsError;

    const { error: leadsError } = await admin.from("journey_leads").delete().eq("watched_user_id", userId);
    if (leadsError) throw leadsError;

    const { error: settingsError } = await admin.from("user_settings").delete().eq("user_id", userId);
    if (settingsError) throw settingsError;

    const { data: files } = await admin.storage.from("profile-photos").list(userId);
    if (files && files.length > 0) {
      const paths = files.map((f: { name: string }) => `${userId}/${f.name}`);
      await admin.storage.from("profile-photos").remove(paths);
    }

    const { error: profileError } = await admin.from("profiles").delete().eq("id", userId);
    if (profileError) throw profileError;

    const { error: authDeleteError } = await admin.auth.admin.deleteUser(userId);
    if (authDeleteError) throw authDeleteError;

    return json({ success: true });
  } catch (err) {
    console.error("delete-account error:", err);
    return json({ error: err instanceof Error ? err.message : "Deletion failed" }, 500);
  }
});
