import { createClient } from "@supabase/supabase-js";
import { clientEnv } from "./env";

export const supabase = createClient(
  clientEnv.supabaseUrl,
  clientEnv.supabaseAnonKey,
  {
    auth: {
      // Avoid noisy auth timers / persistence in Vitest.
      persistSession: !clientEnv.isTest,
      autoRefreshToken: !clientEnv.isTest,
    },
  },
);