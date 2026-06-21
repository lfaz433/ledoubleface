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

    // 1. Verify caller's identity and make sure they are an admin
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
    if (callerRole === "waiter" || callerRole === "driver") {
      return new Response(
        JSON.stringify({ error: "Forbidden: Only admins can manage staff accounts" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Parse request payload and action dispatch
    const body = await req.json();
    const { action = "create", driver_id, name, email, pin, is_active } = body;

    // 3. Initialize Admin Client with service_role key to manage users
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    if (action === "create") {
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

      // Create user in Supabase Auth
      const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
        email,
        password: pin,
        email_confirm: true,
        user_metadata: {
          role: "driver",
          name
        }
      });

      if (authError || !authData.user) {
        return new Response(
          JSON.stringify({ error: authError?.message || "Failed to create Auth user" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const newDriverId = authData.user.id;

      // Insert driver details into the public.drivers table
      const { error: dbError } = await adminSupabase
        .from("drivers")
        .insert([
          {
            id: newDriverId,
            name,
            email,
            is_active: true,
            last_seen: new Date().toISOString()
          }
        ]);

      if (dbError) {
        // Rollback Auth user creation if DB insert fails
        await adminSupabase.auth.admin.deleteUser(newDriverId);
        return new Response(
          JSON.stringify({ error: `Database Error: ${dbError.message}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, driver_id: newDriverId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (action === "update") {
      if (!driver_id || !name || !email) {
        return new Response(
          JSON.stringify({ error: "Missing required fields for update: driver_id, name, email are required." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update user in Supabase Auth
      const authUpdates: any = {
        email,
        user_metadata: {
          role: "driver",
          name
        }
      };

      if (pin) {
        if (pin.length !== 4 || isNaN(Number(pin))) {
          return new Response(
            JSON.stringify({ error: "Invalid PIN: PIN must be a 4-digit number." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        authUpdates.password = pin;
      }

      const { error: authError } = await adminSupabase.auth.admin.updateUserById(driver_id, authUpdates);
      if (authError) {
        return new Response(
          JSON.stringify({ error: authError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update in public.drivers table
      const { error: dbError } = await adminSupabase
        .from("drivers")
        .update({
          name,
          email,
          is_active: is_active !== false
        })
        .eq("id", driver_id);

      if (dbError) {
        return new Response(
          JSON.stringify({ error: `Database Error: ${dbError.message}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (action === "delete") {
      if (!driver_id) {
        return new Response(
          JSON.stringify({ error: "Missing driver_id for deletion." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Delete user from Auth (automatically deletes driver record due to CASCADE delete trigger)
      const { error: authError } = await adminSupabase.auth.admin.deleteUser(driver_id);
      if (authError) {
        return new Response(
          JSON.stringify({ error: authError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else {
      return new Response(
        JSON.stringify({ error: `Unsupported action: ${action}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || "Internal Server Error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
