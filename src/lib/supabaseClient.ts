import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const isTest =
  import.meta.env.MODE === "test" ||
  (typeof process !== "undefined" && process.env.NODE_ENV === "test");

const resolvedSupabaseUrl =
  supabaseUrl || (isTest ? "http://127.0.0.1:54321" : undefined);

const resolvedSupabaseAnonKey =
  supabaseAnonKey || (isTest ? "test-anon-key" : undefined);

if (!resolvedSupabaseUrl || !resolvedSupabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
  );
}

export const supabase = createClient(
  resolvedSupabaseUrl,
  resolvedSupabaseAnonKey,
  {
    auth: {
      // Avoid noisy auth timers / persistence in Vitest
      persistSession: !isTest,
      autoRefreshToken: !isTest,
    },
  }
);