import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Verify caller's identity and make sure they are not a waiter
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    
    const clientSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false }
    });

    const { data: { user }, error: userError } = await clientSupabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const callerRole = user.user_metadata?.role;
    if (callerRole === "waiter") {
      return new Response(
        JSON.stringify({ error: "Forbidden: Waiters cannot create staff accounts" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Parse request payload
    const body = await req.json();
    const { name, email, pin, assigned_tables } = body;

    if (!name || !email || !pin) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: name, email, and pin are required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (pin.length !== 4 || isNaN(Number(pin))) {
      return new Response(
        JSON.stringify({ error: "Invalid PIN: PIN must be a 4-digit number." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Initialize Admin Client with service_role key to manage users
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // 4. Create user in Supabase Auth
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email,
      password: pin, // PIN acts as password
      email_confirm: true,
      user_metadata: {
        role: "waiter",
        name,
        assigned_tables: assigned_tables || []
      }
    });

    if (authError || !authData.user) {
      return new Response(
        JSON.stringify({ error: authError?.message || "Failed to create Auth user" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const waiterId = authData.user.id;

    // 5. Insert waiter details into the public.waiters table
    const { error: dbError } = await adminSupabase
      .from("waiters")
      .insert([
        {
          id: waiterId,
          name,
          email,
          assigned_tables: assigned_tables || [],
          is_active: true,
          last_seen: new Date().toISOString()
        }
      ]);

    if (dbError) {
      // Rollback Auth user creation if DB insert fails to maintain consistency
      await adminSupabase.auth.admin.deleteUser(waiterId);
      return new Response(
        JSON.stringify({ error: `Database Error: ${dbError.message}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, waiter_id: waiterId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || "Internal Server Error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
