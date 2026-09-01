type ClientEnvKey =
  | "MODE"
  | "PROD"
  | "VITE_API_BASE"
  | "VITE_SUPABASE_URL"
  | "VITE_SUPABASE_ANON_KEY"
  | "VITE_BETA_MODE"
  | "VITE_STRIPE_PAYMENTS_ENABLED"
  | "VITE_ADSENSE_ENABLED"
  | "VITE_ADSENSE_CLIENT_ID"
  | "VITE_STRIPE_KEY_MODE"
  | "VITE_STRIPE_PUBLISHABLE_KEY_DEV"
  | "VITE_STRIPE_PUBLISHABLE_KEY_PROD";

export type ClientEnvSource = Partial<
  Record<ClientEnvKey, string | boolean | undefined>
>;

export type StripeKeyMode = "dev" | "prod";

export type StripeClientKeyConfig = {
  mode: StripeKeyMode;
  publishableKey: string;
};

export type ClientEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  isBetaMode: boolean;
  stripePaymentsEnabled: boolean;
  adsenseEnabled: boolean;
  adsenseClientId: string;
  isTest: boolean;
  apiBase: string;
  stripeKeyMode: StripeKeyMode;
  stripePublishableKey: string;
};

const TEST_SUPABASE_URL = "http://127.0.0.1:54321";
const TEST_SUPABASE_ANON_KEY = "test-anon-key";
const TEST_STRIPE_PUBLISHABLE_KEY =
  "pk_test_51TlZGtRzT1WqoVrZSQkeUPqsU3smy6JBe1xb7yQVSw2tp6SkDhC5EUyspBle7v5EuwmoUe2KQcDtpiRpWDHhOPM700uDxAN9cR";

const REQUIRED_CLIENT_ENV_KEYS = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
] as const;

const getCurrentNodeEnv = (): string | undefined => {
  if (typeof process === "undefined") {
    return undefined;
  }

  return process.env.NODE_ENV;
};

const getOptionalString = (
  value: string | boolean | undefined,
): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
};

const getBooleanEnvValue = (value: string | boolean | undefined): boolean => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return false;
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
};

const normalizeStripeKeyMode = ({
  value,
  isProd,
}: {
  value: string | boolean | undefined;
  isProd: boolean;
}): StripeKeyMode => {
  if (typeof value === "string") {
    const normalizedValue = value.trim().toLowerCase();

    if (
      normalizedValue === "prod" ||
      normalizedValue === "production" ||
      normalizedValue === "live"
    ) {
      return "prod";
    }

    if (
      normalizedValue === "dev" ||
      normalizedValue === "development" ||
      normalizedValue === "test"
    ) {
      return "dev";
    }
  }

  return isProd ? "prod" : "dev";
};

const getStripePublishableKeyMode = (key: string): StripeKeyMode | null => {
  if (key.startsWith("pk_live_")) {
    return "prod";
  }

  if (key.startsWith("pk_test_")) {
    return "dev";
  }

  return null;
};

const getStripeClientKeyConfig = ({
  env,
  isProd,
  isTest,
}: {
  env: ClientEnvSource;
  isProd: boolean;
  isTest: boolean;
}): StripeClientKeyConfig => {
  const mode = normalizeStripeKeyMode({
    value: env.VITE_STRIPE_KEY_MODE,
    isProd,
  });

  const devKey =
    getOptionalString(env.VITE_STRIPE_PUBLISHABLE_KEY_DEV) ??
    (isTest ? TEST_STRIPE_PUBLISHABLE_KEY : "");

  const prodKey = getOptionalString(env.VITE_STRIPE_PUBLISHABLE_KEY_PROD) ?? "";
  const publishableKey = mode === "prod" ? prodKey : devKey;
  const keyMode = getStripePublishableKeyMode(publishableKey);

  if (publishableKey && keyMode && keyMode !== mode) {
    throw new Error(
      `Stripe publishable key mode mismatch. VITE_STRIPE_KEY_MODE is "${mode}" but the selected key is "${keyMode}".`,
    );
  }

  return {
    mode,
    publishableKey,
  };
};

export const getMissingRequiredClientEnvKeys = (
  env: ClientEnvSource,
): string[] =>
  REQUIRED_CLIENT_ENV_KEYS.filter((key) => !getOptionalString(env[key]));

export const resolveClientEnv = (
  env: ClientEnvSource,
  nodeEnv = getCurrentNodeEnv(),
): ClientEnv => {
  const isTest = env.MODE === "test" || nodeEnv === "test";
  const isProd = getBooleanEnvValue(env.PROD);

  const supabaseUrl =
    getOptionalString(env.VITE_SUPABASE_URL) ||
    (isTest ? TEST_SUPABASE_URL : undefined);

  const supabaseAnonKey =
    getOptionalString(env.VITE_SUPABASE_ANON_KEY) ||
    (isTest ? TEST_SUPABASE_ANON_KEY : undefined);

  if (!supabaseUrl || !supabaseAnonKey) {
    const missingKeys = getMissingRequiredClientEnvKeys(env).join(", ");

    throw new Error(
      `Missing required client environment variables: ${missingKeys}. Set them in .env.local or your hosting provider.`,
    );
  }

  const stripeClientKeyConfig = getStripeClientKeyConfig({
    env,
    isProd,
    isTest,
  });
  const adsenseClientId = getOptionalString(env.VITE_ADSENSE_CLIENT_ID) ?? "";

  return {
    supabaseUrl,
    supabaseAnonKey,
    isBetaMode: getBooleanEnvValue(env.VITE_BETA_MODE),
    stripePaymentsEnabled: getBooleanEnvValue(
      env.VITE_STRIPE_PAYMENTS_ENABLED,
    ),
    stripeKeyMode: stripeClientKeyConfig.mode,
    stripePublishableKey: stripeClientKeyConfig.publishableKey,
    adsenseEnabled:
      getBooleanEnvValue(env.VITE_ADSENSE_ENABLED) &&
      adsenseClientId.length > 0,
    adsenseClientId,
    isTest,
    apiBase: getOptionalString(env.VITE_API_BASE) ?? "",
  };
};

export const clientEnv = resolveClientEnv(import.meta.env);