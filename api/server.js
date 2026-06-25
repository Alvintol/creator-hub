import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import express from "express";
import cors from "cors";
import crypto from "crypto";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.join(__dirname, ".env"),
});

const app = express();

const PORT = Number(process.env.PORT || 8787);
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || "";
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET || "";

const TWITCH_REDIRECT_URI = process.env.TWITCH_REDIRECT_URI || "";
const APP_ORIGIN = process.env.APP_ORIGIN || "http://localhost:5173";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const OAUTH_STATE_SECRET = process.env.OAUTH_STATE_SECRET || "";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const STRIPE_CONNECT_RETURN_URL =
  process.env.STRIPE_CONNECT_RETURN_URL ||
  `${APP_ORIGIN}/settings/profile?stripe=return`;
const STRIPE_CONNECT_REFRESH_URL =
  process.env.STRIPE_CONNECT_REFRESH_URL ||
  `${APP_ORIGIN}/settings/profile?stripe=refresh`;
const STRIPE_CONNECT_SETUP_URL =
  process.env.STRIPE_CONNECT_SETUP_URL || "https://dashboard.stripe.com/connect";
const STRIPE_CHECKOUT_RETURN_PATH =
  process.env.STRIPE_CHECKOUT_RETURN_PATH || "/payments/return";

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

// Allow local dev
app.use(
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    let event;
    let webhookEventId = null;

    try {
      const stripeClient = requireStripe();
      const webhookSecret = requireStripeWebhookSecret();
      const signature = req.headers["stripe-signature"];

      event = stripeClient.webhooks.constructEvent(
        req.body,
        signature,
        webhookSecret,
      );

      const recordedEvent = await recordStripeWebhookEventStart(event);

      if (recordedEvent.duplicate) {
        return res.json({ received: true, duplicate: true });
      }

      webhookEventId = recordedEvent.id;

      const processingStatus = await processStripeWebhookEvent(event);

      await markStripeWebhookEventProcessed(webhookEventId, processingStatus);

      return res.json({ received: true, status: processingStatus });
    } catch (err) {
      const message = String(err?.message || err);

      await markStripeWebhookEventFailed(webhookEventId, message);

      return res.status(400).json({
        error: message,
      });
    }
  },
);

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

let cachedToken = null;
let cachedTokenExpMs = 0;

// Cache config
const STREAMS_CACHE_TTL_MS = 15_000;
const STREAMS_CACHE_MAX = 250;

const USERS_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const USERS_CACHE_MAX = 500;

const CACHE_CLEANUP_INTERVAL_MS = 60_000; // 1 minute

// Caches
const streamsCache = new Map(); // key -> { expMs, value }
const streamsInflight = new Map(); // key -> Promise<value>

const usersCache = new Map();
const usersInflight = new Map();

const nowMs = () => Date.now();

const normalizeLogins = (loginsParam) => {
  return String(loginsParam || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort()
    .slice(0, 100);
};

const pruneOldest = (cache, maxEntries) => {
  while (cache.size > maxEntries) {
    const oldestKey = cache.keys().next().value;
    if (!oldestKey) break;
    cache.delete(oldestKey);
  }
};

const cleanupExpired = (cache) => {
  const now = nowMs();
  for (const [key, entry] of cache.entries()) {
    if (!entry || typeof entry.expMs !== "number" || now > entry.expMs) {
      cache.delete(key);
    }
  }
};

// Touch-on-hit: moves the entry to the end of the Map so hot keys are kept longer
const getCached = (cache, key) => {
  const hit = cache.get(key);
  if (!hit) return null;

  if (nowMs() > hit.expMs) {
    cache.delete(key);
    return null;
  }

  // LRU-ish behavior: reinsert to refresh insertion order
  cache.delete(key);
  cache.set(key, hit);

  return hit.value;
};

const setCached = (cache, key, value, ttlMs, maxEntries) => {
  cache.set(key, { expMs: nowMs() + ttlMs, value });
  pruneOldest(cache, maxEntries);
};

const getOrSetInflight = async (cache, inflight, key, ttlMs, maxEntries, fetcher) => {
  const cached = getCached(cache, key);
  if (cached) return cached;

  const existing = inflight.get(key);
  if (existing) return existing;

  const p = (async () => {
    const value = await fetcher();
    setCached(cache, key, value, ttlMs, maxEntries);
    return value;
  })();

  inflight.set(key, p);

  try {
    return await p;
  } finally {
    inflight.delete(key);
  }
};

const getBearerToken = (req) => {
  const h = String(req.headers.authorization || "");
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
};

const requireSupabaseUserId = async (req) => {
  if (!supabaseAdmin) throw new Error("Supabase admin not configured");

  const token = getBearerToken(req);
  if (!token) throw new Error("Missing Authorization bearer token");

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user?.id) throw new Error("Invalid session");

  return data.user.id;
};

const requireStripe = () => {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  return stripe;
};

const normalizeCountryCode = (value) => {
  const country = String(value || "")
    .trim()
    .toUpperCase();

  if (!/^[A-Z]{2}$/.test(country)) {
    throw new Error("A valid two-letter country code is required.");
  }

  return country;
};

const normalizeCurrencyCode = (value, fallback = "usd") => {
  const currency = String(value || fallback)
    .trim()
    .toLowerCase();

  if (!/^[a-z]{3}$/.test(currency)) {
    throw new Error("A valid three-letter currency code is required.");
  }

  return currency;
};

const requireApprovedCreator = async (userId) => {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin not configured");
  }

  const { data, error } = await supabaseAdmin
    .from("seller_applications")
    .select("id")
    .eq("profile_user_id", userId)
    .eq("status", "approved")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.id) {
    throw new Error("Only approved creators can connect Stripe payouts.");
  }
};

const getExistingCreatorPaymentAccount = async (userId) => {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin not configured");
  }

  const { data, error } = await supabaseAdmin
    .from("creator_payment_accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "stripe")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
};

const upsertCreatorPaymentAccount = async ({
  userId,
  stripeAccount,
  fallbackCurrency,
  onboardingStartedAt,
}) => {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin not configured");
  }

  const now = new Date().toISOString();

  const patch = {
    user_id: userId,
    provider: "stripe",
    stripe_account_id: stripeAccount.id,
    charges_enabled: Boolean(stripeAccount.charges_enabled),
    payouts_enabled: Boolean(stripeAccount.payouts_enabled),
    details_submitted: Boolean(stripeAccount.details_submitted),
    country: normalizeCountryCode(stripeAccount.country),
    default_currency: normalizeCurrencyCode(
      stripeAccount.default_currency,
      fallbackCurrency,
    ),
    onboarding_started_at: onboardingStartedAt,
    onboarding_completed_at: stripeAccount.details_submitted ? now : null,
    last_synced_at: now,
    updated_at: now,
  };

  const { data, error } = await supabaseAdmin
    .from("creator_payment_accounts")
    .upsert(patch, {
      onConflict: "user_id,provider",
    })
    .select(
      "id, user_id, provider, stripe_account_id, charges_enabled, payouts_enabled, details_submitted, country, default_currency, onboarding_started_at, onboarding_completed_at, last_synced_at",
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
};

const createStripeConnectAccount = async ({
  stripeClient,
  userId,
  country,
  defaultCurrency,
}) =>
  stripeClient.accounts.create({
    type: "express",
    country,
    capabilities: {
      card_payments: {
        requested: true,
      },
      transfers: {
        requested: true,
      },
    },
    metadata: {
      creatorhub_user_id: userId,
    },
    settings: {
      payouts: {
        schedule: {
          interval: "manual",
        },
      },
    },
    default_currency: defaultCurrency,
  });

const getStripeConnectAccountLink = async ({ stripeClient, accountId }) =>
  stripeClient.accountLinks.create({
    account: accountId,
    refresh_url: STRIPE_CONNECT_REFRESH_URL,
    return_url: STRIPE_CONNECT_RETURN_URL,
    type: "account_onboarding",
  });

const getStripeConnectSetupRequiredResponse = (message) => {
  if (!/signed up for Connect|dashboard\.stripe\.com\/connect/i.test(message)) {
    return null;
  }

  return {
    status: 424,
    body: {
      code: "stripe_connect_platform_setup_required",
      error:
        "CreatorHub's Stripe platform account needs Connect setup before creator payout onboarding can start.",
      actionUrl: STRIPE_CONNECT_SETUP_URL,
    },
  };
};

const CHECKOUT_OPENABLE_PAYMENT_STATUSES = new Set([
  "requires_checkout",
  "checkout_opened",
  "failed",
]);

const getCheckoutReturnUrl = (paymentId) =>
  `${APP_ORIGIN}${STRIPE_CHECKOUT_RETURN_PATH}?payment_id=${encodeURIComponent(
    paymentId,
  )}&session_id={CHECKOUT_SESSION_ID}`;

const getListingRequestPaymentForCheckout = async (paymentId) => {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin not configured");
  }

  const { data, error } = await supabaseAdmin
    .from("listing_request_payments")
    .select(
      `
      id,
      listing_request_id,
      related_entity_type,
      related_entity_id,
      payment_type,
      status,
      currency,
      base_amount_cents,
      creator_tip_cents,
      buyer_service_fee_cents,
      creator_platform_fee_cents,
      platform_support_cents,
      application_fee_cents,
      total_checkout_cents,
      buyer_service_fee_bps,
      creator_platform_fee_bps,
      buyer_service_fee_minimum_cents,
      creator_platform_fee_minimum_cents,
      payer_user_id,
      creator_user_id,
      stripe_connected_account_id,
      stripe_checkout_session_id,
      metadata,
      created_at,
      updated_at
    `,
    )
    .eq("id", paymentId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.id) {
    throw new Error("Payment record was not found.");
  }

  return data;
};

const getReadyCreatorPaymentAccount = async (creatorUserId) => {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin not configured");
  }

  const { data, error } = await supabaseAdmin
    .from("creator_payment_accounts")
    .select(
      "stripe_account_id, charges_enabled, payouts_enabled, details_submitted, default_currency",
    )
    .eq("user_id", creatorUserId)
    .eq("provider", "stripe")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.stripe_account_id) {
    throw new Error("Creator has not connected Stripe payouts.");
  }

  if (!data.details_submitted || !data.charges_enabled || !data.payouts_enabled) {
    throw new Error("Creator Stripe account is not ready for payments.");
  }

  return data;
};

const assertCheckoutPaymentCanBeOpened = ({ payment, userId }) => {
  if (payment.payer_user_id !== userId) {
    throw new Error("Only the buyer for this payment can open checkout.");
  }

  if (!CHECKOUT_OPENABLE_PAYMENT_STATUSES.has(payment.status)) {
    throw new Error("This payment is not available for checkout.");
  }

  if (payment.base_amount_cents <= 0 || payment.total_checkout_cents <= 0) {
    throw new Error("This payment amount is invalid.");
  }

  if (payment.application_fee_cents >= payment.total_checkout_cents) {
    throw new Error("This payment fee setup is invalid.");
  }
};

const getPaymentCheckoutTitle = (payment) => {
  const labelByType = {
    one_time: "CreatorHub one-time payment",
    starting_payment: "CreatorHub starting payment",
    milestone_payment: "CreatorHub milestone payment",
    change_order_payment: "CreatorHub change-order payment",
    final_balance: "CreatorHub final balance",
  };

  return labelByType[payment.payment_type] || "CreatorHub project payment";
};

const getStripePaymentMetadata = (payment) => ({
  creatorhub_payment_id: payment.id,
  listing_request_id: payment.listing_request_id,
  payment_type: payment.payment_type,
  related_entity_type: payment.related_entity_type || "",
  related_entity_id: payment.related_entity_id || "",
});

const signState = (payload) => {
  if (!OAUTH_STATE_SECRET) throw new Error("OAUTH_STATE_SECRET missing");

  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", OAUTH_STATE_SECRET)
    .update(data)
    .digest("base64url");

  return `${data}.${sig}`;
};

const verifyState = (state) => {
  if (!OAUTH_STATE_SECRET) throw new Error("OAUTH_STATE_SECRET missing");

  const [data, sig] = String(state || "").split(".");
  if (!data || !sig) throw new Error("Bad state");

  const expected = crypto
    .createHmac("sha256", OAUTH_STATE_SECRET)
    .update(data)
    .digest("base64url");

  if (sig !== expected) throw new Error("State signature mismatch");

  const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
  if (!payload?.uid || !payload?.exp) throw new Error("Bad state payload");
  if (Date.now() > payload.exp) throw new Error("State expired");

  return payload;
};

const isAtLeastOneYearOld = (createdAtIso) => {
  const createdMs = Date.parse(String(createdAtIso || ""));
  if (!Number.isFinite(createdMs)) return false;

  const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
  return Date.now() - createdMs >= ONE_YEAR_MS;
};

const getTwitchAuthorizeUrl = (state) => {
  if (!TWITCH_CLIENT_ID || !TWITCH_REDIRECT_URI) {
    throw new Error("Missing TWITCH_CLIENT_ID or TWITCH_REDIRECT_URI");
  }

  const url = new URL("https://id.twitch.tv/oauth2/authorize");
  url.searchParams.set("client_id", TWITCH_CLIENT_ID);
  url.searchParams.set("redirect_uri", TWITCH_REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "user:read:email");
  url.searchParams.set("state", state);

  return url.toString();
};

const exchangeCodeForToken = async (code) => {
  if (!TWITCH_CLIENT_SECRET) throw new Error("Missing TWITCH_CLIENT_SECRET");

  const url = new URL("https://id.twitch.tv/oauth2/token");
  url.searchParams.set("client_id", TWITCH_CLIENT_ID);
  url.searchParams.set("client_secret", TWITCH_CLIENT_SECRET);
  url.searchParams.set("code", String(code || ""));
  url.searchParams.set("grant_type", "authorization_code");
  url.searchParams.set("redirect_uri", TWITCH_REDIRECT_URI);

  const r = await fetch(url.toString(), { method: "POST" });
  const text = await r.text();

  if (!r.ok) throw new Error(`Token exchange failed (${r.status}): ${text}`);

  const json = JSON.parse(text);
  if (!json?.access_token) throw new Error("No access_token from Twitch");

  return json.access_token;
};

const fetchTwitchMe = async (userAccessToken) => {
  const r = await fetch("https://api.twitch.tv/helix/users", {
    headers: {
      "Client-ID": TWITCH_CLIENT_ID,
      Authorization: `Bearer ${userAccessToken}`,
    },
  });

  const text = await r.text();
  if (!r.ok) throw new Error(`Twitch users failed (${r.status}): ${text}`);

  const json = JSON.parse(text);
  const u = (json.data || [])[0];
  if (!u?.id || !u?.login) throw new Error("No Twitch user returned");

  return u;
};

const getAppAccessToken = async () => {
  const now = Date.now();
  if (cachedToken && now < cachedTokenExpMs - 30_000) return cachedToken; // 30s buffer

  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
    throw new Error("Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET");
  }

  const url = new URL("https://id.twitch.tv/oauth2/token");
  url.searchParams.set("client_id", TWITCH_CLIENT_ID);
  url.searchParams.set("client_secret", TWITCH_CLIENT_SECRET);
  url.searchParams.set("grant_type", "client_credentials");

  const r = await fetch(url.toString(), { method: "POST" });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Token request failed (${r.status}): ${text}`);
  }

  const json = await r.json();
  cachedToken = json.access_token;
  cachedTokenExpMs = now + json.expires_in * 1000;
  return cachedToken;
};

// Periodic cleanup + size enforcement
const cleanupTick = () => {
  cleanupExpired(streamsCache);
  cleanupExpired(usersCache);

  // Safety: enforce hard caps even if lots of non-expired keys exist
  pruneOldest(streamsCache, STREAMS_CACHE_MAX);
  pruneOldest(usersCache, USERS_CACHE_MAX);
};

// run once on boot
cleanupTick();

// run periodically (won’t keep Node alive if nothing else is running)
const cleanupInterval = setInterval(cleanupTick, CACHE_CLEANUP_INTERVAL_MS);
if (typeof cleanupInterval.unref === "function") cleanupInterval.unref();

// GET /api/twitch/streams?logins=a,b,c
app.get("/api/twitch/streams", async (req, res) => {
  try {
    const logins = normalizeLogins(req.query.logins);
    if (logins.length === 0) return res.json({ data: [] });

    const cacheKey = `streams:${logins.join(",")}`;

    const data = await getOrSetInflight(
      streamsCache,
      streamsInflight,
      cacheKey,
      STREAMS_CACHE_TTL_MS,
      STREAMS_CACHE_MAX,
      async () => {
        const token = await getAppAccessToken();

        const url = new URL("https://api.twitch.tv/helix/streams");
        logins.forEach((login) => url.searchParams.append("user_login", login));

        const r = await fetch(url.toString(), {
          headers: {
            "Client-ID": TWITCH_CLIENT_ID,
            Authorization: `Bearer ${token}`,
          },
        });

        if (!r.ok) {
          const text = await r.text();
          throw new Error(`Twitch streams failed (${r.status}): ${text}`);
        }

        const json = await r.json();

        return (json.data || []).map((s) => ({
          login: s.user_login,
          displayName: s.user_name,
          isLive: true,
          title: s.title,
          gameName: s.game_name,
          viewerCount: s.viewer_count,
          startedAt: s.started_at,
          thumbnailUrl: s.thumbnail_url,
        }));
      }
    );

    res.setHeader("Cache-Control", "public, max-age=15");
    return res.json({ data });
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err) });
  }
});

// GET /api/twitch/users?logins=a,b,c
app.get("/api/twitch/users", async (req, res) => {
  try {
    const logins = normalizeLogins(req.query.logins);
    if (logins.length === 0) return res.json({ data: [] });

    const cacheKey = `users:${logins.join(",")}`;

    const data = await getOrSetInflight(
      usersCache,
      usersInflight,
      cacheKey,
      USERS_CACHE_TTL_MS,
      USERS_CACHE_MAX,
      async () => {
        const token = await getAppAccessToken();

        const url = new URL("https://api.twitch.tv/helix/users");
        logins.forEach((login) => url.searchParams.append("login", login));

        const r = await fetch(url.toString(), {
          headers: {
            "Client-ID": TWITCH_CLIENT_ID,
            Authorization: `Bearer ${token}`,
          },
        });

        if (!r.ok) {
          const text = await r.text();
          throw new Error(`Twitch users failed (${r.status}): ${text}`);
        }

        const json = await r.json();

        return (json.data || []).map((u) => ({
          id: u.id,
          login: u.login,
          displayName: u.display_name,
          profileImageUrl: u.profile_image_url,
        }));
      }
    );

    // short browser cache; server cache is the main benefit
    res.setHeader("Cache-Control", "public, max-age=300");
    return res.json({ data });
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err) });
  }
});

// POST /api/twitch/connect/start
app.post("/api/twitch/connect/start", async (req, res) => {
  try {
    const uid = await requireSupabaseUserId(req);

    const state = signState({
      uid,
      exp: Date.now() + 10 * 60 * 1000, // 10 min
    });

    const url = getTwitchAuthorizeUrl(state);
    return res.json({ url });
  } catch (err) {
    return res.status(401).json({ error: String(err?.message || err) });
  }
});

// GET /api/twitch/connect/callback
app.get("/api/twitch/connect/callback", async (req, res) => {
  try {
    if (!supabaseAdmin) throw new Error("Supabase admin not configured");

    const code = String(req.query.code || "");
    const state = String(req.query.state || "");
    if (!code) throw new Error("Missing code");

    const { uid } = verifyState(state);

    const token = await exchangeCodeForToken(code);
    const me = await fetchTwitchMe(token);

    const ageOk = isAtLeastOneYearOld(me.created_at);

    const patch = {
      profile_user_id: uid,
      platform: "twitch",
      platform_user_id: me.id,
      platform_login: me.login,
      platform_display_name: me.display_name ?? me.login,
      profile_url: `https://twitch.tv/${me.login}`,
      account_created_at: me.created_at,
      connected_at: new Date().toISOString(),
      metadata: {
        age_ok: ageOk,
        email: me.email ?? null,
        profile_image_url: me.profile_image_url ?? null,
      },
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabaseAdmin
      .from("profile_platform_accounts")
      .upsert(patch, {
        onConflict: "profile_user_id,platform",
      });

    if (error) throw new Error(error.message);

    const twitchAvatarUrl =
      typeof me.profile_image_url === "string" && me.profile_image_url.trim()
        ? me.profile_image_url
        : null;

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        avatar_url: twitchAvatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", uid);

    if (profileError) throw new Error(profileError.message);

    const next = new URL("/settings/profile", APP_ORIGIN);
    next.searchParams.set("twitch", "connected");
    return res.redirect(next.toString());
  } catch (err) {
    const next = new URL("/settings/profile", APP_ORIGIN);
    next.searchParams.set("twitch", "error");
    next.searchParams.set("msg", String(err?.message || err));
    return res.redirect(next.toString());
  }
});

app.post("/api/stripe/connect/start", async (req, res) => {
  try {
    const stripeClient = requireStripe();
    const userId = await requireSupabaseUserId(req);

    await requireApprovedCreator(userId);

    const country = normalizeCountryCode(req.body?.country);
    const defaultCurrency = normalizeCurrencyCode(
      req.body?.defaultCurrency,
      "usd",
    );

    const existingAccount = await getExistingCreatorPaymentAccount(userId);

    const stripeAccount = existingAccount?.stripe_account_id
      ? await stripeClient.accounts.retrieve(existingAccount.stripe_account_id)
      : await createStripeConnectAccount({
        stripeClient,
        userId,
        country,
        defaultCurrency,
      });

    const onboardingStartedAt =
      existingAccount?.onboarding_started_at || new Date().toISOString();

    const account = await upsertCreatorPaymentAccount({
      userId,
      stripeAccount,
      fallbackCurrency: defaultCurrency,
      onboardingStartedAt,
    });

    const accountLink = await getStripeConnectAccountLink({
      stripeClient,
      accountId: stripeAccount.id,
    });

    return res.json({
      url: accountLink.url,
      account: {
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
        country: account.country,
        defaultCurrency: account.default_currency,
      },
    });
  } catch (err) {
    const message = String(err?.message || err);
    const connectSetupResponse =
      getStripeConnectSetupRequiredResponse(message);

    if (connectSetupResponse) {
      return res
        .status(connectSetupResponse.status)
        .json(connectSetupResponse.body);
    }

    const status = /session|authorization|approved creator/i.test(message)
      ? 401
      : 400;

    return res.status(status).json({ error: message });
  }
});

app.post("/api/stripe/connect/sync", async (req, res) => {
  try {
    const stripeClient = requireStripe();
    const userId = await requireSupabaseUserId(req);

    const existingAccount = await getExistingCreatorPaymentAccount(userId);

    if (!existingAccount?.stripe_account_id) {
      return res.status(404).json({
        error: "No Stripe payout account found for this creator.",
      });
    }

    const stripeAccount = await stripeClient.accounts.retrieve(
      existingAccount.stripe_account_id,
    );

    const account = await upsertCreatorPaymentAccount({
      userId,
      stripeAccount,
      fallbackCurrency: existingAccount.default_currency,
      onboardingStartedAt: existingAccount.onboarding_started_at,
    });

    return res.json({
      account: {
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
        country: account.country,
        defaultCurrency: account.default_currency,
      },
    });
  } catch (err) {
    const message = String(err?.message || err);
    const status = /session|authorization/i.test(message) ? 401 : 400;

    return res.status(status).json({ error: message });
  }
});

app.post("/api/stripe/checkout/session", async (req, res) => {
  try {
    const stripeClient = requireStripe();
    const userId = await requireSupabaseUserId(req);
    const paymentId = String(req.body?.paymentId || "").trim();

    if (!paymentId) {
      return res.status(400).json({ error: "paymentId is required." });
    }

    const payment = await getListingRequestPaymentForCheckout(paymentId);

    assertCheckoutPaymentCanBeOpened({ payment, userId });

    const creatorPaymentAccount = await getReadyCreatorPaymentAccount(
      payment.creator_user_id,
    );

    if (
      payment.stripe_connected_account_id &&
      payment.stripe_connected_account_id !==
      creatorPaymentAccount.stripe_account_id
    ) {
      throw new Error("This payment is linked to a different Stripe account.");
    }

    const metadata = getStripePaymentMetadata(payment);

    const session = await stripeClient.checkout.sessions.create(
      {
        mode: "payment",
        ui_mode: "embedded_page",
        client_reference_id: payment.id,
        return_url: getCheckoutReturnUrl(payment.id),
        line_items: [
          {
            price_data: {
              currency: payment.currency,
              unit_amount: payment.total_checkout_cents,
              product_data: {
                name: getPaymentCheckoutTitle(payment),
                metadata,
              },
            },
            quantity: 1,
          },
        ],
        payment_intent_data: {
          application_fee_amount: payment.application_fee_cents,
          metadata,
        },
        metadata,
      },
      {
        stripeAccount: creatorPaymentAccount.stripe_account_id,
      },
    );

    const { data, error } = await supabaseAdmin
      .from("listing_request_payments")
      .update({
        status: "checkout_opened",
        stripe_connected_account_id: creatorPaymentAccount.stripe_account_id,
        stripe_checkout_session_id: session.id,
        checkout_opened_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id)
      .eq("payer_user_id", userId)
      .select(
        "id, status, stripe_connected_account_id, stripe_checkout_session_id",
      )
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return res.json({
      payment: data,
      checkout: {
        sessionId: session.id,
        clientSecret: session.client_secret,
      },
    });
  } catch (err) {
    const message = String(err?.message || err);
    const status = /session|authorization/i.test(message) ? 401 : 400;

    return res.status(status).json({ error: message });
  }
});

app.get("/api/stripe/checkout/session-status", async (req, res) => {
  try {
    const stripeClient = requireStripe();
    const userId = await requireSupabaseUserId(req);

    const paymentId = String(
      req.query.paymentId || req.query.payment_id || "",
    ).trim();
    const sessionId = String(
      req.query.sessionId || req.query.session_id || "",
    ).trim();

    if (!paymentId) {
      return res.status(400).json({ error: "paymentId is required." });
    }

    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required." });
    }

    const { data: payment, error } = await supabaseAdmin
      .from("listing_request_payments")
      .select(
        `
        id,
        status,
        payment_type,
        currency,
        base_amount_cents,
        creator_tip_cents,
        buyer_service_fee_cents,
        creator_platform_fee_cents,
        platform_support_cents,
        application_fee_cents,
        total_checkout_cents,
        payer_user_id,
        creator_user_id,
        stripe_connected_account_id,
        stripe_checkout_session_id,
        paid_at,
        updated_at
      `,
      )
      .eq("id", paymentId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!payment?.id) {
      return res.status(404).json({ error: "Payment record was not found." });
    }

    if (
      payment.payer_user_id !== userId &&
      payment.creator_user_id !== userId
    ) {
      return res.status(403).json({
        error: "You do not have access to this payment.",
      });
    }

    if (!payment.stripe_connected_account_id) {
      return res.status(400).json({
        error: "Payment is missing a Stripe connected account.",
      });
    }

    if (
      payment.stripe_checkout_session_id &&
      payment.stripe_checkout_session_id !== sessionId
    ) {
      return res.status(400).json({
        error: "Checkout session does not match this payment.",
      });
    }

    const session = await stripeClient.checkout.sessions.retrieve(
      sessionId,
      {},
      {
        stripeAccount: payment.stripe_connected_account_id,
      },
    );

    return res.json({
      payment,
      checkout: {
        sessionId: session.id,
        status: session.status,
        paymentStatus: session.payment_status,
        customerEmail: session.customer_details?.email ?? null,
      },
    });
  } catch (err) {
    const message = String(err?.message || err);
    const status = /session|authorization/i.test(message) ? 401 : 400;

    return res.status(status).json({ error: message });
  }
});

app.listen(PORT, () => {
  console.log(`[api] listening on http://localhost:${PORT}`);
});