import { describe, expect, it } from "vitest";
import { resolveClientEnv } from "../env";

describe("resolveClientEnv", () => {
  it("throws a helpful error when required Supabase env vars are missing outside tests", () => {
    expect(() => resolveClientEnv({ MODE: "production" }, "production")).toThrow(
      /VITE_SUPABASE_URL/,
    );

    expect(() => resolveClientEnv({ MODE: "production" }, "production")).toThrow(
      /VITE_SUPABASE_ANON_KEY/,
    );
  });

  it("uses safe Supabase fallback values in test mode", () => {
    const env = resolveClientEnv({ MODE: "test" }, "test");

    expect(env.supabaseUrl).toBe("http://127.0.0.1:54321");
    expect(env.supabaseAnonKey).toBe("test-anon-key");
    expect(env.isTest).toBe(true);
  });

  it("trims required values and parses launch flags", () => {
    const env = resolveClientEnv(
      {
        MODE: "production",
        VITE_API_BASE: " http://localhost:8787 ",
        VITE_SUPABASE_URL: " https://example.supabase.co ",
        VITE_SUPABASE_ANON_KEY: " test-anon-key ",
        VITE_BETA_MODE: "true",
        VITE_STRIPE_PAYMENTS_ENABLED: "1",
        VITE_ADSENSE_ENABLED: "yes",
        VITE_ADSENSE_CLIENT_ID: " ca-pub-test ",
      },
      "production",
    );

    expect(env.apiBase).toBe("http://localhost:8787");
    expect(env.supabaseAnonKey).toBe("test-anon-key");
    expect(env.isBetaMode).toBe(true);
    expect(env.stripePaymentsEnabled).toBe(true);
    expect(env.adsenseEnabled).toBe(true);
    expect(env.adsenseClientId).toBe("ca-pub-test");
    expect(env.isTest).toBe(false);
  });

  it("does not enable AdSense without a client id", () => {
    const env = resolveClientEnv(
      {
        MODE: "production",
        VITE_SUPABASE_URL: "https://example.supabase.co",
        VITE_SUPABASE_ANON_KEY: "test-anon-key",
        VITE_ADSENSE_ENABLED: "true",
        VITE_ADSENSE_CLIENT_ID: "",
      },
      "production",
    );

    expect(env.adsenseEnabled).toBe(false);
  });
});