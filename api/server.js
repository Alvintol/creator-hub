import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import express from "express";
import cors from "cors";
import crypto from "crypto";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

import { CHECKOUT_POLICY_VERSIONS } from "./policyVersions.js";
import { getMissingCheckoutPolicyTypes } from "./policyAcceptanceGuard.js";

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

const normalizeStripeKeyMode = (value) => {
  const normalizedValue = String(value || "")
    .trim()
    .toLowerCase();

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

  return process.env.NODE_ENV === "production" ? "prod" : "dev";
};

const getStripeSecretKeyMode = (key) => {
  if (key.startsWith("sk_live_")) {
    return "prod";
  }

  if (key.startsWith("sk_test_")) {
    return "dev";
  }

  return null;
};

const getStripeKeyConfig = () => {
  const mode = normalizeStripeKeyMode(process.env.STRIPE_KEY_MODE);

  const secretKey =
    mode === "prod"
      ? process.env.STRIPE_SECRET_KEY_PROD || ""
      : process.env.STRIPE_SECRET_KEY_DEV || "";

  const webhookSecret =
    mode === "prod"
      ? process.env.STRIPE_WEBHOOK_SECRET_PROD || ""
      : process.env.STRIPE_WEBHOOK_SECRET_DEV || "";

  const detectedSecretKeyMode = getStripeSecretKeyMode(secretKey);

  if (
    secretKey &&
    detectedSecretKeyMode &&
    detectedSecretKeyMode !== mode
  ) {
    throw new Error(
      `Stripe secret key mode mismatch. STRIPE_KEY_MODE is "${mode}" but the selected key is "${detectedSecretKeyMode}".`,
    );
  }

  return {
    mode,
    secretKey,
    webhookSecret,
  };
};

const STRIPE_KEY_CONFIG = getStripeKeyConfig();

const STRIPE_KEY_MODE = STRIPE_KEY_CONFIG.mode;
const STRIPE_SECRET_KEY = STRIPE_KEY_CONFIG.secretKey;
const STRIPE_WEBHOOK_SECRET = STRIPE_KEY_CONFIG.webhookSecret;
const STRIPE_CONNECT_SETUP_URL =
  process.env.STRIPE_CONNECT_SETUP_URL || "https://dashboard.stripe.com/connect";
const STRIPE_CHECKOUT_RETURN_PATH =
  process.env.STRIPE_CHECKOUT_RETURN_PATH || "/payments/return";

const LOCAL_DEV_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const ALLOWED_ORIGINS = Array.from(
  new Set([APP_ORIGIN, ...LOCAL_DEV_ORIGINS].filter(Boolean)),
);

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

// Allow local dev
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS.`));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: false,
  }),
);

app.options("*", cors());

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

      const recordedEvent =
        await recordStripeWebhookEventStart(event);

      if (!recordedEvent.shouldProcess) {
        return res.json({
          received: true,
          duplicate: true,
          status: "already_processed",
        });
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
  res.json({
    ok: true,
    service: "made-for-stream-api",
  });
});

app.get("/api/stripe/config", (_req, res) => {
  res.json({
    mode: STRIPE_KEY_MODE,
    hasSecretKey: Boolean(STRIPE_SECRET_KEY),
    hasWebhookSecret: Boolean(STRIPE_WEBHOOK_SECRET),
  });
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
    throw new Error(
      `Stripe ${STRIPE_KEY_MODE} secret key is not configured.`,
    );
  }

  return stripe;
};

const requireStripeWebhookSecret = () => {
  if (!STRIPE_WEBHOOK_SECRET) {
    throw new Error(
      `Stripe ${STRIPE_KEY_MODE} webhook secret is not configured.`,
    );
  }

  return STRIPE_WEBHOOK_SECRET;
};

// Returns the connected Stripe account that emitted a Connect event.
const getStripeEventAccountId = (event) =>
  typeof event?.account === "string" && event.account.trim()
    ? event.account.trim()
    : null;

// Use Stripe's event timestamp for payment lifecycle timestamps.
const getStripeEventTimestamp = (event) =>
  new Date(
    (event?.created || Math.floor(Date.now() / 1000)) * 1000,
  ).toISOString();

// Payment ids are stored in Stripe metadata.
// Checkout Sessions also use client_reference_id as a fallback.
const getPaymentIdFromStripeObject = (stripeObject) =>
  String(
    stripeObject?.metadata?.creatorhub_payment_id ||
    stripeObject?.client_reference_id ||
    "",
  ).trim();

const getPaymentIntentIdFromCheckoutSession = (session) => {
  if (typeof session?.payment_intent === "string") {
    return session.payment_intent;
  }

  return session?.payment_intent?.id || null;
};

const getNextStripeEventIds = (payment, eventId) =>
  Array.from(
    new Set([
      ...(payment?.stripe_event_ids || []),
      eventId,
    ]),
  );

// The Checkout Session and PaymentIntent webhook payloads carry a payment
// intent id but not the charge or application fee ids -- those live on the
// Charge, which has to be fetched separately. Retrieved once per paid event,
// on the connected account the charge actually belongs to.
const getChargeDetailsFromPaymentIntent = async ({
  stripeClient,
  paymentIntentId,
  stripeAccountId,
}) => {
  if (!paymentIntentId) {
    return { chargeId: null, applicationFeeId: null };
  }

  const paymentIntent = await stripeClient.paymentIntents.retrieve(
    paymentIntentId,
    { expand: ["latest_charge"] },
    stripeAccountId ? { stripeAccount: stripeAccountId } : undefined,
  );

  const charge = paymentIntent.latest_charge;

  const chargeId =
    typeof charge === "string" ? charge : charge?.id || null;

  const applicationFeeId =
    charge && typeof charge === "object"
      ? typeof charge.application_fee === "string"
        ? charge.application_fee
        : charge.application_fee?.id || null
      : null;

  return { chargeId, applicationFeeId };
};

// Record every webhook before applying any business logic.
// Failed events remain retryable if Stripe sends them again.
const recordStripeWebhookEventStart = async (event) => {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin not configured");
  }

  const { data, error } = await supabaseAdmin
    .from("stripe_webhook_events")
    .insert({
      stripe_event_id: event.id,
      stripe_account_id: getStripeEventAccountId(event),
      event_type: event.type,
      processing_status: "processing",
      payload: event,
    })
    .select("id, processing_status")
    .single();

  if (!error) {
    return {
      duplicate: false,
      shouldProcess: true,
      id: data.id,
    };
  }

  // 23505 = unique violation.
  // This means Stripe retried an event we already recorded.
  if (error.code !== "23505") {
    throw new Error(error.message);
  }

  const {
    data: existingEvent,
    error: existingEventError,
  } = await supabaseAdmin
    .from("stripe_webhook_events")
    .select("id, processing_status")
    .eq("stripe_event_id", event.id)
    .maybeSingle();

  if (existingEventError) {
    throw new Error(existingEventError.message);
  }

  if (!existingEvent?.id) {
    throw new Error(
      "Existing Stripe webhook event could not be found.",
    );
  }

  // Successfully handled events should remain idempotent.
  if (
    existingEvent.processing_status === "processed" ||
    existingEvent.processing_status === "ignored"
  ) {
    return {
      duplicate: true,
      shouldProcess: false,
      id: existingEvent.id,
    };
  }

  // A previous attempt failed or stopped part-way through.
  // Allow Stripe's retry to run the workflow again.
  const { error: retryUpdateError } = await supabaseAdmin
    .from("stripe_webhook_events")
    .update({
      processing_status: "processing",
      error_message: null,
      processed_at: null,
    })
    .eq("id", existingEvent.id);

  if (retryUpdateError) {
    throw new Error(retryUpdateError.message);
  }

  return {
    duplicate: true,
    shouldProcess: true,
    id: existingEvent.id,
  };
};

const markStripeWebhookEventProcessed = async (
  eventId,
  processingStatus = "processed",
) => {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin not configured");
  }

  const { error } = await supabaseAdmin
    .from("stripe_webhook_events")
    .update({
      processing_status: processingStatus,
      error_message: null,
      processed_at: new Date().toISOString(),
    })
    .eq("id", eventId);

  if (error) {
    throw new Error(error.message);
  }
};

// Do not let an error while recording the failure hide the
// original webhook processing error.
const markStripeWebhookEventFailed = async (
  eventId,
  errorMessage,
) => {
  if (!supabaseAdmin || !eventId) {
    return;
  }

  const { error } = await supabaseAdmin
    .from("stripe_webhook_events")
    .update({
      processing_status: "failed",
      error_message: errorMessage,
      processed_at: new Date().toISOString(),
    })
    .eq("id", eventId);

  if (error) {
    console.error(
      "[stripe] failed to record webhook error:",
      error.message,
    );
  }
};

// Load the internal payment row used by webhook processing.
const getPaymentWithStripeEventIds = async (paymentId) => {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin not configured");
  }

  const { data, error } = await supabaseAdmin
    .from("listing_request_payments")
    .select(
      `
      id,
      payment_type,
      status,
      currency,
      total_checkout_cents,
      stripe_event_ids,
      stripe_connected_account_id,
      stripe_checkout_session_id,
      stripe_payment_intent_id,
      stripe_charge_id,
      stripe_application_fee_id,
      paid_at
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

// Apply project-workflow side effects only after Stripe has
// confirmed that the ledger payment is paid.
const applyPaidListingRequestPaymentWorkflow = async ({
  paymentId,
  paymentType,
}) => {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin not configured");
  }

  const workflowRpcByPaymentType = {
    starting_payment: "apply_paid_listing_request_starting_payment",
    milestone_payment: "apply_paid_listing_request_milestone_payment",
    change_order_payment:
      "apply_paid_listing_request_change_order_payment",
    final_balance: "apply_paid_listing_request_final_balance_payment",
  };

  const rpcName = workflowRpcByPaymentType[paymentType];

  if (!rpcName) {
    // one_time payments have no downstream project workflow to apply yet.
    return;
  }

  const { error } = await supabaseAdmin.rpc(rpcName, {
    p_listing_request_payment_id: paymentId,
  });

  if (error) {
    throw new Error(error.message);
  }
};

const markListingRequestPaymentProcessingFromCheckoutSession =
  async ({ session, event }) => {
    const paymentId = getPaymentIdFromStripeObject(session);

    if (!paymentId) {
      throw new Error(
        "Stripe checkout session is missing Made for Stream payment metadata.",
      );
    }

    const payment =
      await getPaymentWithStripeEventIds(paymentId);

    // Never downgrade an already-paid payment.
    if (payment.status === "paid") {
      return;
    }

    const { error } = await supabaseAdmin
      .from("listing_request_payments")
      .update({
        status: "processing",

        stripe_connected_account_id:
          payment.stripe_connected_account_id ||
          getStripeEventAccountId(event),

        stripe_checkout_session_id:
          payment.stripe_checkout_session_id ||
          session.id,

        stripe_payment_intent_id:
          payment.stripe_payment_intent_id ||
          getPaymentIntentIdFromCheckoutSession(session),

        stripe_event_ids: getNextStripeEventIds(
          payment,
          event.id,
        ),

        processing_at: getStripeEventTimestamp(event),
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id);

    if (error) {
      throw new Error(error.message);
    }
  };

const markListingRequestPaymentPaidFromCheckoutSession =
  async ({ session, event }) => {
    const paymentId = getPaymentIdFromStripeObject(session);

    if (!paymentId) {
      throw new Error(
        "Stripe checkout session is missing Made for Stream payment metadata.",
      );
    }

    const payment =
      await getPaymentWithStripeEventIds(paymentId);

    const connectedAccountId =
      getStripeEventAccountId(event);

    const paymentIntentId =
      getPaymentIntentIdFromCheckoutSession(session);

    if (
      payment.stripe_checkout_session_id &&
      payment.stripe_checkout_session_id !== session.id
    ) {
      throw new Error(
        "Stripe checkout session does not match this payment.",
      );
    }

    if (
      payment.stripe_connected_account_id &&
      connectedAccountId &&
      payment.stripe_connected_account_id !==
      connectedAccountId
    ) {
      throw new Error(
        "Stripe connected account does not match this payment.",
      );
    }

    if (
      typeof session.amount_total === "number" &&
      typeof payment.total_checkout_cents === "number" &&
      session.amount_total !== payment.total_checkout_cents
    ) {
      throw new Error(
        "Stripe checkout session amount does not match this payment.",
      );
    }

    if (
      session.currency &&
      payment.currency &&
      String(session.currency).toLowerCase() !==
      String(payment.currency).toLowerCase()
    ) {
      throw new Error(
        "Stripe checkout session currency does not match this payment.",
      );
    }

    // The payment may already have been saved as paid while a
    // downstream workflow RPC failed. Retry that workflow, and backfill
    // the charge handle if an earlier attempt landed before it was added.
    if (payment.status === "paid") {
      if (!payment.stripe_charge_id) {
        await backfillChargeDetailsForPayment({
          payment,
          connectedAccountId,
          paymentIntentId,
        });
      }

      await applyPaidListingRequestPaymentWorkflow({
        paymentId: payment.id,
        paymentType: payment.payment_type,
      });

      return;
    }

    const stripeAccountId =
      payment.stripe_connected_account_id || connectedAccountId;

    const { chargeId, applicationFeeId } =
      await getChargeDetailsFromPaymentIntent({
        stripeClient: requireStripe(),
        paymentIntentId,
        stripeAccountId,
      });

    const { error } = await supabaseAdmin
      .from("listing_request_payments")
      .update({
        status: "paid",

        stripe_connected_account_id: stripeAccountId,

        stripe_checkout_session_id: session.id,

        stripe_payment_intent_id:
          payment.stripe_payment_intent_id ||
          paymentIntentId,

        stripe_charge_id:
          payment.stripe_charge_id || chargeId,

        stripe_application_fee_id:
          payment.stripe_application_fee_id || applicationFeeId,

        stripe_event_ids: getNextStripeEventIds(
          payment,
          event.id,
        ),

        paid_at:
          payment.paid_at ||
          getStripeEventTimestamp(event),

        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id);

    if (error) {
      throw new Error(error.message);
    }

    await applyPaidListingRequestPaymentWorkflow({
      paymentId: payment.id,
      paymentType: payment.payment_type,
    });
  };

// A paid payment whose charge handle never got recorded -- an earlier
// webhook attempt that landed before this column was populated, or one
// that raced with a failure between the two writes. Never regresses
// paid_at, status or any other column; only fills the two Stripe ids.
const backfillChargeDetailsForPayment = async ({
  payment,
  connectedAccountId,
  paymentIntentId,
}) => {
  const stripeAccountId =
    payment.stripe_connected_account_id || connectedAccountId;

  const effectivePaymentIntentId =
    payment.stripe_payment_intent_id || paymentIntentId;

  const { chargeId, applicationFeeId } =
    await getChargeDetailsFromPaymentIntent({
      stripeClient: requireStripe(),
      paymentIntentId: effectivePaymentIntentId,
      stripeAccountId,
    });

  if (!chargeId) {
    return;
  }

  const { error } = await supabaseAdmin
    .from("listing_request_payments")
    .update({
      stripe_charge_id: chargeId,
      stripe_application_fee_id: applicationFeeId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payment.id)
    .is("stripe_charge_id", null);

  if (error) {
    throw new Error(error.message);
  }
};

const markListingRequestPaymentCancelledFromCheckoutSession =
  async ({ session, event }) => {
    const paymentId = getPaymentIdFromStripeObject(session);

    if (!paymentId) {
      throw new Error(
        "Stripe checkout session is missing Made for Stream payment metadata.",
      );
    }

    const payment =
      await getPaymentWithStripeEventIds(paymentId);

    if (payment.status === "paid") {
      return;
    }

    const { error } = await supabaseAdmin
      .from("listing_request_payments")
      .update({
        status: "cancelled",

        stripe_connected_account_id:
          payment.stripe_connected_account_id ||
          getStripeEventAccountId(event),

        stripe_checkout_session_id:
          payment.stripe_checkout_session_id ||
          session.id,

        stripe_payment_intent_id:
          payment.stripe_payment_intent_id ||
          getPaymentIntentIdFromCheckoutSession(session),

        stripe_event_ids: getNextStripeEventIds(
          payment,
          event.id,
        ),

        cancelled_at: getStripeEventTimestamp(event),
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id);

    if (error) {
      throw new Error(error.message);
    }
  };

const markListingRequestPaymentFailedFromPaymentIntent =
  async ({ paymentIntent, event }) => {
    const paymentId =
      getPaymentIdFromStripeObject(paymentIntent);

    // Stripe may send PaymentIntent events unrelated to
    // Made for Stream's payment ledger.
    if (!paymentId) {
      return;
    }

    const payment =
      await getPaymentWithStripeEventIds(paymentId);

    if (payment.status === "paid") {
      return;
    }

    const { error } = await supabaseAdmin
      .from("listing_request_payments")
      .update({
        status: "failed",

        stripe_connected_account_id:
          payment.stripe_connected_account_id ||
          getStripeEventAccountId(event),

        stripe_payment_intent_id:
          payment.stripe_payment_intent_id ||
          paymentIntent.id,

        stripe_event_ids: getNextStripeEventIds(
          payment,
          event.id,
        ),

        failed_at: getStripeEventTimestamp(event),
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id);

    if (error) {
      throw new Error(error.message);
    }
  };

// Look up the internal payment row a Charge or Dispute webhook event is
// about. Charges created from a PaymentIntent inherit its metadata, so the
// same creatorhub_payment_id lookup used everywhere else usually works --
// but a charge.refunded can arrive before checkout.session.completed has
// had a chance to record stripe_charge_id on our row (Stripe does not
// guarantee event order), so this also matches on the charge id itself for
// any row that already has it.
const getPaymentForStripeChargeEvent = async (chargeObjectOrId) => {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin not configured");
  }

  const chargeId =
    typeof chargeObjectOrId === "string"
      ? chargeObjectOrId
      : chargeObjectOrId?.id || null;

  const selectColumns = `
    id,
    payment_type,
    status,
    stripe_event_ids,
    stripe_refund_id,
    stripe_dispute_id,
    refunded_at,
    disputed_at
  `;

  if (chargeId) {
    const { data, error } = await supabaseAdmin
      .from("listing_request_payments")
      .select(selectColumns)
      .eq("stripe_charge_id", chargeId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (data) {
      return data;
    }
  }

  const paymentId =
    typeof chargeObjectOrId === "object"
      ? getPaymentIdFromStripeObject(chargeObjectOrId)
      : "";

  if (!paymentId) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("listing_request_payments")
    .select(selectColumns)
    .eq("id", paymentId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
};

// Recording only -- no status write. Refunds and disputes get a real,
// derived status once the refund ledger lands (launch-scope.md section 6);
// until then this just makes the fact visible on the payment row instead of
// falling through processStripeWebhookEvent as "ignored" the way it does
// today, which is the launch-blocking gap section 6 opens with.
const recordChargeRefundedFromWebhook = async ({ charge, event }) => {
  const payment = await getPaymentForStripeChargeEvent(charge);

  if (!payment) {
    return;
  }

  if ((payment.stripe_event_ids || []).includes(event.id)) {
    return;
  }

  const latestRefundId =
    charge.refunds?.data?.[0]?.id || payment.stripe_refund_id || null;

  const { error } = await supabaseAdmin
    .from("listing_request_payments")
    .update({
      stripe_refund_id: latestRefundId,
      refunded_at: payment.refunded_at || getStripeEventTimestamp(event),
      stripe_event_ids: getNextStripeEventIds(payment, event.id),
      updated_at: new Date().toISOString(),
    })
    .eq("id", payment.id);

  if (error) {
    throw new Error(error.message);
  }
};

const recordChargeDisputeCreatedFromWebhook = async ({ dispute, event }) => {
  const payment = await getPaymentForStripeChargeEvent(dispute.charge);

  if (!payment) {
    return;
  }

  if ((payment.stripe_event_ids || []).includes(event.id)) {
    return;
  }

  const { error } = await supabaseAdmin
    .from("listing_request_payments")
    .update({
      stripe_dispute_id: dispute.id,
      disputed_at: payment.disputed_at || getStripeEventTimestamp(event),
      stripe_event_ids: getNextStripeEventIds(payment, event.id),
      updated_at: new Date().toISOString(),
    })
    .eq("id", payment.id);

  if (error) {
    throw new Error(error.message);
  }
};

// Closed just records that the event was seen -- launch-scope.md section 6.1
// scopes automated dispute response as out, and the outcome (won/lost, any
// refund already issued) is read live from Stripe on the admin surface
// rather than mirrored into a column here, so there is nothing derived to
// get out of step in the meantime.
const recordChargeDisputeClosedFromWebhook = async ({ dispute, event }) => {
  const payment = await getPaymentForStripeChargeEvent(dispute.charge);

  if (!payment) {
    return;
  }

  if ((payment.stripe_event_ids || []).includes(event.id)) {
    return;
  }

  const { error } = await supabaseAdmin
    .from("listing_request_payments")
    .update({
      stripe_event_ids: getNextStripeEventIds(payment, event.id),
      updated_at: new Date().toISOString(),
    })
    .eq("id", payment.id);

  if (error) {
    throw new Error(error.message);
  }
};

const processStripeWebhookEvent = async (event) => {
  const stripeObject = event.data.object;

  if (event.type === "checkout.session.completed") {
    if (stripeObject.payment_status === "paid") {
      await markListingRequestPaymentPaidFromCheckoutSession({
        session: stripeObject,
        event,
      });
    } else {
      await markListingRequestPaymentProcessingFromCheckoutSession(
        {
          session: stripeObject,
          event,
        },
      );
    }

    return "processed";
  }

  if (
    event.type ===
    "checkout.session.async_payment_succeeded"
  ) {
    await markListingRequestPaymentPaidFromCheckoutSession({
      session: stripeObject,
      event,
    });

    return "processed";
  }

  if (event.type === "checkout.session.expired") {
    await markListingRequestPaymentCancelledFromCheckoutSession(
      {
        session: stripeObject,
        event,
      },
    );

    return "processed";
  }

  if (event.type === "payment_intent.payment_failed") {
    await markListingRequestPaymentFailedFromPaymentIntent({
      paymentIntent: stripeObject,
      event,
    });

    return "processed";
  }

  if (event.type === "charge.refunded") {
    await recordChargeRefundedFromWebhook({
      charge: stripeObject,
      event,
    });

    return "processed";
  }

  if (event.type === "charge.dispute.created") {
    await recordChargeDisputeCreatedFromWebhook({
      dispute: stripeObject,
      event,
    });

    return "processed";
  }

  if (event.type === "charge.dispute.closed") {
    await recordChargeDisputeClosedFromWebhook({
      dispute: stripeObject,
      event,
    });

    return "processed";
  }

  return "ignored";
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

// Reads the v2 core Account shape (configuration.merchant / .recipient
// capability statuses, requirements) into the three flat booleans the rest
// of the app -- and enforce_listing_payment_account_readiness's DB trigger
// -- already understand. Kept as a pure function, separate from the upsert,
// so the v1-to-v2 account migration (2026-09-22) touches exactly one place.
//
// card_payments / payouts status values observed live: "active" once
// requirements clear, "restricted" while they don't. details_submitted is
// derived from whether any requirement entries remain rather than from a
// specific status string, since Stripe support and the docs never named one
// meaning "fully clear" -- an empty entries list is unambiguous either way.
const deriveCreatorPaymentAccountReadinessFromV2Account = (stripeAccount) => {
  const cardPaymentsStatus =
    stripeAccount?.configuration?.merchant?.capabilities?.card_payments
      ?.status;

  const payoutsStatus =
    stripeAccount?.configuration?.recipient?.capabilities?.stripe_balance
      ?.payouts?.status;

  const requirementEntries = stripeAccount?.requirements?.entries;

  const detailsSubmitted =
    Array.isArray(requirementEntries) && requirementEntries.length === 0;

  return {
    chargesEnabled: cardPaymentsStatus === "active",
    payoutsEnabled: payoutsStatus === "active",
    detailsSubmitted,
  };
};

const upsertCreatorPaymentAccount = async ({
  userId,
  stripeAccount,
  country,
  defaultCurrency,
  onboardingStartedAt,
}) => {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin not configured");
  }

  const now = new Date().toISOString();

  const { chargesEnabled, payoutsEnabled, detailsSubmitted } =
    deriveCreatorPaymentAccountReadinessFromV2Account(stripeAccount);

  const patch = {
    user_id: userId,
    provider: "stripe",
    stripe_account_id: stripeAccount.id,
    charges_enabled: chargesEnabled,
    payouts_enabled: payoutsEnabled,
    details_submitted: detailsSubmitted,
    country: normalizeCountryCode(country),
    default_currency: normalizeCurrencyCode(defaultCurrency),
    onboarding_started_at: onboardingStartedAt,
    onboarding_completed_at: detailsSubmitted ? now : null,
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

// The account already has an email on file as a Supabase auth user; v2
// accounts require contact_email whenever a recipient configuration
// (payouts) is requested, so this has to be resolved before account
// creation rather than left blank.
const getSupabaseUserEmail = async (userId) => {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin not configured");
  }

  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);

  if (error) {
    throw new Error(error.message);
  }

  const email = data?.user?.email;

  if (!email) {
    throw new Error("This account has no email on file to connect Stripe payouts.");
  }

  return email;
};

// Payout timing (launch-scope.md section 6.3). Balance Settings is a
// separate v2-era endpoint from account creation, addressed with the
// account's own Stripe-Account header. Only interval is set: overriding
// settlement_timing.delay_days_override is restricted to platforms that own
// fraud/dispute liability, and this platform's defaults.responsibilities
// deliberately leave losses_collector as "stripe" (2026-09-22 decision) --
// confirmed live that delay_days_override is rejected under that
// configuration ("You cannot change ... via API once an account has been
// activated"), so the actual delay is whatever Stripe assigns for the
// account's country rather than a guaranteed 14 days.
const setStripeConnectDailyPayoutSchedule = async ({
  stripeClient,
  accountId,
}) => {
  await stripeClient.balanceSettings.update(
    {
      payments: {
        payouts: {
          schedule: {
            interval: "daily",
          },
        },
      },
    },
    { stripeAccount: accountId },
  );
};

const getStripeConnectSetupRequiredResponse = (message) => {
  if (!/signed up for Connect|dashboard\.stripe\.com\/connect/i.test(message)) {
    return null;
  }

  return {
    status: 424,
    body: {
      code: "stripe_connect_platform_setup_required",
      error:
        "Made for Stream's Stripe platform account needs Connect setup before creator payout onboarding can start.",
      actionUrl: STRIPE_CONNECT_SETUP_URL,
    },
  };
};

const CHECKOUT_OPENABLE_PAYMENT_STATUSES = new Set([
  "requires_checkout",
  "checkout_opened",
  "failed",
  "cancelled",
]);

const getCheckoutReturnUrl = (paymentId) =>
  `${APP_ORIGIN}${STRIPE_CHECKOUT_RETURN_PATH}?payment_id=${encodeURIComponent(
    paymentId,
  )}&session_id={CHECKOUT_SESSION_ID}`;

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

// The checkout page gates on the buyer having accepted the current refund,
// payment-terms and early-service-request policies for this listing request
// (CheckoutPolicyAcceptance.tsx). That gate is client-side only -- nothing on
// the API re-checked it before this, so it was not a real boundary
// (launch-scope.md section 11). Re-checked on every call, including a reused
// session, because an acceptance of an older version does not count once a
// policy has changed.
const assertCheckoutPoliciesAccepted = async ({ payment, userId }) => {
  const requiredPolicyTypes = Object.keys(CHECKOUT_POLICY_VERSIONS);

  const { data, error } = await supabaseAdmin
    .from("policy_acceptances")
    .select("policy_type, policy_version")
    .eq("user_id", userId)
    .eq("related_listing_request_id", payment.listing_request_id)
    .in("policy_type", requiredPolicyTypes);

  if (error) {
    throw new Error(error.message);
  }

  const missingPolicyTypes = getMissingCheckoutPolicyTypes(
    CHECKOUT_POLICY_VERSIONS,
    data || [],
  );

  if (missingPolicyTypes.length > 0) {
    throw new Error(
      `You must accept the current ${missingPolicyTypes.join(", ")} policy before checkout can open.`,
    );
  }
};

const getPaymentCheckoutTitle = (payment) => {
  const labelByType = {
    one_time: "Made for Stream one-time payment",
    starting_payment: "Made for Stream starting payment",
    milestone_payment: "Made for Stream milestone payment",
    change_order_payment: "Made for Stream change-order payment",
    final_balance: "Made for Stream final balance",
  };

  return labelByType[payment.payment_type] || "Made for Stream project payment";
};

const getStripePaymentMetadata = (payment) => ({
  creatorhub_payment_id: payment.id,
  listing_request_id: payment.listing_request_id,
  payment_type: payment.payment_type,
  related_entity_type: payment.related_entity_type || "",
  related_entity_id: payment.related_entity_id || "",
});

// Stripe checkout sessions are single-use and cannot be recreated, so
// reopening checkout for the same payment (a page refresh, a second
// browser tab, the buyer navigating back) should reuse the still-open
// session instead of minting a new one for every request.
const getReusableCheckoutSession = async ({
  stripeClient,
  payment,
  stripeAccountId,
}) => {
  if (!payment.stripe_checkout_session_id) {
    return null;
  }

  let existingSession;

  try {
    existingSession = await stripeClient.checkout.sessions.retrieve(
      payment.stripe_checkout_session_id,
      { stripeAccount: stripeAccountId },
    );
  } catch {
    // The session may be gone, expired past retrieval, or tied to a
    // stale connected account. Fall through and create a fresh one.
    return null;
  }

  if (existingSession.status === "complete") {
    throw new Error(
      "This payment has already been completed with Stripe. Refresh the page to see its latest status.",
    );
  }

  if (existingSession.status !== "open") {
    return null;
  }

  return existingSession;
};

const getEmbeddedConnectAccountSessionComponents = () => ({
  account_onboarding: {
    enabled: true,
    features: {
      external_account_collection: true,
    },
  },
});

const getStripeAccountIdFromCreatorPaymentAccount = (account) =>
  typeof account?.stripe_account_id === "string" &&
    account.stripe_account_id.trim().length > 0
    ? account.stripe_account_id.trim()
    : null;

const getStripeConnectAccountSummary = ({ account, existingAccount }) => ({
  stripeAccountId: account.id,
  chargesEnabled: Boolean(
    "charges_enabled" in account
      ? account.charges_enabled
      : existingAccount?.charges_enabled,
  ),
  payoutsEnabled: Boolean(
    "payouts_enabled" in account
      ? account.payouts_enabled
      : existingAccount?.payouts_enabled,
  ),
  detailsSubmitted: Boolean(
    "details_submitted" in account
      ? account.details_submitted
      : existingAccount?.details_submitted,
  ),
  country: account.country || existingAccount?.country || null,
  defaultCurrency:
    account.default_currency || existingAccount?.default_currency || null,
});

const getOrCreateStripeAccountForEmbeddedConnect = async ({
  stripeClient,
  userId,
  country,
  defaultCurrency,
}) => {
  const existingAccount = await getExistingCreatorPaymentAccount(userId);
  const existingStripeAccountId =
    getStripeAccountIdFromCreatorPaymentAccount(existingAccount);

  if (existingStripeAccountId) {
    return {
      account: {
        id: existingStripeAccountId,
        country: existingAccount.country,
        default_currency: existingAccount.default_currency,
        charges_enabled: existingAccount.charges_enabled,
        payouts_enabled: existingAccount.payouts_enabled,
        details_submitted: existingAccount.details_submitted,
      },
      existingAccount,
      wasCreated: false,
    };
  }

  // Accounts v2, not v1 type: "express" -- this platform's own Connect
  // settings (Dashboard: Settings > Connect > Platform setup) are already
  // configured for v2: fees_collector "stripe" (the connected account bears
  // Stripe's 2.9%+0.30, not the platform) and losses_collector "stripe"
  // (Stripe, not the platform, owns fraud/dispute/negative-balance
  // liability). dashboard: "none" matches what's already built here --
  // onboarding and account management happen entirely through the embedded
  // components below, never a Stripe-hosted dashboard. See launch-scope.md
  // section 3.2 for the full 2026-09-22 correction and how this was verified
  // live against Stripe's API before being written here.
  const contactEmail = await getSupabaseUserEmail(userId);

  const account = await stripeClient.v2.core.accounts.create({
    contact_email: contactEmail,
    identity: {
      country: country.toLowerCase(),
    },
    dashboard: "none",
    defaults: {
      currency: defaultCurrency,
      responsibilities: {
        fees_collector: "stripe",
        losses_collector: "stripe",
      },
    },
    configuration: {
      merchant: {
        capabilities: {
          card_payments: {
            requested: true,
          },
        },
      },
      // "recipient" is what makes payouts to this account possible at all --
      // confirmed live that Stripe requires contact_email the moment this is
      // requested, which is why it's resolved above rather than left out.
      recipient: {
        capabilities: {
          stripe_balance: {
            stripe_transfers: {
              requested: true,
            },
          },
        },
      },
    },
    metadata: {
      creatorhub_user_id: userId,
    },
    include: [
      "configuration.merchant",
      "configuration.recipient",
      "requirements",
    ],
  });

  await setStripeConnectDailyPayoutSchedule({
    stripeClient,
    accountId: account.id,
  });

  const upsertedAccount = await upsertCreatorPaymentAccount({
    userId,
    stripeAccount: account,
    country,
    defaultCurrency,
  });

  return {
    account: {
      id: upsertedAccount.stripe_account_id,
      country: upsertedAccount.country,
      default_currency: upsertedAccount.default_currency,
      charges_enabled: upsertedAccount.charges_enabled,
      payouts_enabled: upsertedAccount.payouts_enabled,
      details_submitted: upsertedAccount.details_submitted,
    },
    existingAccount: null,
    wasCreated: true,
  };
};

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

// The old /api/stripe/connect/start (Stripe-hosted Account Link onboarding,
// v1 accounts.create) was removed 2026-09-22 as part of the v1-to-v2 account
// migration. It had no caller anywhere in src/ -- confirmed by grep, and by
// useStripeConnectOnboarding.ts defining request/response types for a
// "start" mutation that was never wired up. The live onboarding path is
// POST /api/stripe/connect/account-session (embedded components), below.

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

    const stripeAccount = await stripeClient.v2.core.accounts.retrieve(
      existingAccount.stripe_account_id,
      {
        include: [
          "configuration.merchant",
          "configuration.recipient",
          "requirements",
        ],
      },
    );

    const account = await upsertCreatorPaymentAccount({
      userId,
      stripeAccount,
      country: existingAccount.country,
      defaultCurrency: existingAccount.default_currency,
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

    // Re-derive base, fees and total from the schedule item and agreement
    // this payment was created from, rather than trusting whatever the row
    // currently says. Self-heals drift when found; raises if the recipient
    // does not match the agreement (launch-scope.md section 11). Also doubles
    // as the existence check for paymentId.
    const { data: payment, error: recomputeError } = await supabaseAdmin.rpc(
      "recompute_listing_request_payment_amounts",
      { p_payment_id: paymentId },
    );

    if (recomputeError) {
      throw new Error(recomputeError.message);
    }

    assertCheckoutPaymentCanBeOpened({ payment, userId });
    await assertCheckoutPoliciesAccepted({ payment, userId });

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

    const reusableSession = await getReusableCheckoutSession({
      stripeClient,
      payment,
      stripeAccountId: creatorPaymentAccount.stripe_account_id,
    });

    if (reusableSession) {
      return res.json({
        payment: {
          id: payment.id,
          status: payment.status,
          stripe_connected_account_id: creatorPaymentAccount.stripe_account_id,
          stripe_checkout_session_id: reusableSession.id,
        },
        checkout: {
          sessionId: reusableSession.id,
          clientSecret: reusableSession.client_secret,
        },
      });
    }

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
        idempotencyKey: `checkout_session_${payment.id}_${payment.updated_at}`,
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

app.post("/api/stripe/connect/account-session", async (req, res) => {
  try {
    const stripeClient = requireStripe();
    const userId = await requireSupabaseUserId(req);

    if (!stripeClient?.v2?.core?.accounts?.create) {
      return res.status(500).json({
        error:
          "Stripe Accounts v2 API is unavailable. Check the API Stripe package version and STRIPE_SECRET_KEY.",
      });
    }

    if (!stripeClient?.accountSessions?.create) {
      return res.status(500).json({
        error:
          "Stripe account sessions API is unavailable. Run `cd api && npm install stripe@latest`.",
      });
    }

    await requireApprovedCreator(userId);

    const country = normalizeCountryCode(req.body?.country || "CA");
    const defaultCurrency = normalizeCurrencyCode(
      req.body?.defaultCurrency || "cad",
    );

    const { account, existingAccount, wasCreated } =
      await getOrCreateStripeAccountForEmbeddedConnect({
        stripeClient,
        userId,
        country,
        defaultCurrency,
      });

    const accountSession = await stripeClient.accountSessions.create({
      account: account.id,
      components: getEmbeddedConnectAccountSessionComponents(),
    });

    return res.json({
      account: getStripeConnectAccountSummary({
        account,
        existingAccount,
      }),
      accountSession: {
        clientSecret: accountSession.client_secret,
        expiresAt: accountSession.expires_at,
      },
      meta: {
        wasCreated,
      },
    });
  } catch (err) {
    const message = String(err?.message || err);
    const connectSetupResponse = getStripeConnectSetupRequiredResponse(message);

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

app.use((err, _req, res, _next) => {
  console.error(err);

  res.status(500).json({
    error: err?.message || "Unexpected API error.",
  });
});

app.listen(PORT, () => {
  console.log(`[api] listening on http://localhost:${PORT}`);
  console.log(
    `[stripe] mode=${STRIPE_KEY_MODE} secret=${STRIPE_SECRET_KEY ? "configured" : "missing"} webhook=${STRIPE_WEBHOOK_SECRET ? "configured" : "missing"}`,
  );
});