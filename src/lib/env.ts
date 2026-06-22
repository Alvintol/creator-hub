type ClientEnvKey =
  | "MODE"
  | "VITE_API_BASE"
  | "VITE_SUPABASE_URL"
  | "VITE_SUPABASE_ANON_KEY"
  | "VITE_BETA_MODE"
  | "VITE_STRIPE_PAYMENTS_ENABLED"
  | "VITE_ADSENSE_ENABLED"
  | "VITE_ADSENSE_CLIENT_ID";

export type ClientEnvSource = Partial<
  Record<ClientEnvKey, string | boolean | undefined>
>;

export type ClientEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  isBetaMode: boolean;
  stripePaymentsEnabled: boolean;
  adsenseEnabled: boolean;
  adsenseClientId: string;
  isTest: boolean;
  apiBase: string;
};

const TEST_SUPABASE_URL = "http://127.0.0.1:54321";
const TEST_SUPABASE_ANON_KEY = "test-anon-key";

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

export const getMissingRequiredClientEnvKeys = (
  env: ClientEnvSource,
): string[] =>
  REQUIRED_CLIENT_ENV_KEYS.filter((key) => !getOptionalString(env[key]));

export const resolveClientEnv = (
  env: ClientEnvSource,
  nodeEnv = getCurrentNodeEnv(),
): ClientEnv => {
  const isTest = env.MODE === "test" || nodeEnv === "test";

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

  const adsenseClientId = getOptionalString(env.VITE_ADSENSE_CLIENT_ID) ?? "";

  return {
    supabaseUrl,
    supabaseAnonKey,
    isBetaMode: getBooleanEnvValue(env.VITE_BETA_MODE),
    stripePaymentsEnabled: getBooleanEnvValue(
      env.VITE_STRIPE_PAYMENTS_ENABLED,
    ),
    adsenseEnabled:
      getBooleanEnvValue(env.VITE_ADSENSE_ENABLED) &&
      adsenseClientId.length > 0,
    adsenseClientId,
    isTest,
    apiBase: getOptionalString(env.VITE_API_BASE) ?? "",
  };
};

export const clientEnv = resolveClientEnv(import.meta.env);