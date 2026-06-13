import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let client: any = null;

const isValidUrl = (url: string) => {
  try {
    new URL(url);
    return true;
  } catch (_) {
    return false;
  }
};

if (
  supabaseUrl && 
  supabaseAnonKey && 
  isValidUrl(supabaseUrl) &&
  !supabaseUrl.includes("your-project-id")
) {
  try {
    client = createClient(supabaseUrl, supabaseAnonKey);
  } catch (err) {
    console.error("Failed to initialize Supabase client:", err);
  }
}

// Fallback mock client to prevent rendering crashes on Vercel when environment variables are blank/default
if (!client) {
  console.warn("Supabase keys are missing, invalid, or left as defaults. Operating in local simulation mode.");
  
  // Create a mock client that matches the database methods we use
  client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [], error: null })
        }),
        order: () => Promise.resolve({ data: [], error: null })
      }),
      insert: () => Promise.resolve({ data: null, error: null }),
      update: () => ({
        eq: () => Promise.resolve({ data: null, error: null })
      }),
      delete: () => ({
        eq: () => Promise.resolve({ data: null, error: null })
      })
    }),
    channel: () => ({
      on: (event: string, filter: any, callback: Function) => {
        // Return same structure for chaining
        const sub = {
          on: () => sub,
          subscribe: () => ({})
        };
        return sub;
      },
      subscribe: () => ({})
    }),
    removeChannel: () => {}
  };
}

export const supabase = client;
