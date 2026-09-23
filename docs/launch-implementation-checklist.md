# Launch Implementation Checklist

The build order for [`launch-scope.md`](launch-scope.md). Ordered by dependency, not
by size: each sprint assumes the ones before it have landed. Sprint 7 is the
exception — its blocking item is external advice, so it starts in parallel.

Every item follows `AGENTS.md`: enforcement at the database and API rather than the
UI alone, the next free migration number taken from `supabase/migrations/`, and a
support playbook written or updated before the branch is ready.

**Baselines to hold** (measured 2026-09-22, end of Sprint 3): **861 tests
passing, eslint clean, tsc clean, `npx vite build` clean.** `AGENTS.md` still
records the older 740 / 21 errors / 19 lines — those were cleaned up since and
it is gitignored, so this file is the current reference.

---

## Sprint 0.5 — Stripe portal configuration

**Dashboard settings, not code.** Quick, free, and two of them decide numbers that
get published. Record each answer here as it is confirmed.

- [x] **Set the Connect pricing model to "Stripe handles pricing"** (§3.4). Stripe
      bills the connected account for processing; the platform incurs no account
      fee, no payout volume fee and no per-payout fee. This is the decision the fee
      structure now rests on — confirm it is actually applied, not just intended.
      *Confirmed 2026-09-22 directly with Stripe support (launch-scope.md §9.2):
      under Stripe-handles-pricing with Express + direct charges, the platform
      incurs none of the account/payout/tax-reporting fees. No live payments have
      run yet, so this was confirmed by asking support rather than reading an
      invoice that would show nothing either way.*
- [x] ~~Verify on a Stripe invoice that no CA$2 monthly active account line and no
      per-payout fees are being charged.~~ Superseded by the direct support
      confirmation above — there is no invoice data yet to read (no live traffic).
- [ ] Confirm the creator's connected account is being debited for the 2.9% +
      CA$0.30, which is what makes Fee Schedule §5 true as published.
- [ ] Check whether the platform qualifies for Stripe's **revenue share** under this
      model — it exists only here, and nothing in the plan has counted it.
- [ ] Record Stripe's minimum charge amount per currency we intend to enable, for
      the registry's `stripe_minimum_charge` column (Sprint 1).
- [ ] Confirm international card and currency conversion surcharges, and who bears
      them, before enabling a currency outside CAD/USD.
- [x] Register the Connect **webhook endpoint** against the production API origin
      once §11.1 is decided, and confirm the raw body reaches signature
      verification intact. *Done 2026-09-22 as part of §11.1 — see Sprint 3
      for what was built and verified live: classic `webhook_endpoints`
      (test mode, `connect: true`) pointed at the deployed Cloud Run origin,
      a real triggered event confirmed reaching it, and a manually-signed
      request confirming signature verification against the real secret.
      Live-mode registration is still open, deferred until `STRIPE_KEY_MODE`
      flips to `prod`.*

---

## Sprint 1 — The currency registry

Global availability rests entirely on this. Three places in the product assume a
currency has exactly 100 minor units, and until that assumption is gone, enabling a
new currency ships wrong money rather than a new market.

- [ ] Migration: `supported_currencies` table per `launch-scope.md` §1.1 — code,
      `minor_unit_exponent`, `amount_multiple`, `minimum_instalment`,
      `stripe_minimum_charge`, `enabled`. No fee-minimum columns (§3.1). Seeded
      with CAD and USD enabled, wave 2 rows present and disabled.
- [ ] Migration: `supported_countries`, seeded from Stripe's Connect availability
      list, recording which capabilities each supports.
- [ ] Rewrite `ensure_listing_request_payment_for_schedule_item` to take the
      exponent from the registry instead of `* 100`, and the rates from the
      resolver instead of `500`. In CAD and USD the result must be
      **byte-identical** to today for any base at or above 30.00 — below that the
      dropped minimums legitimately change it, and those cases get their own
      expectations.
- [ ] **Remove both fee minimums.** 5% flat on each side, no `max(...)` (§3.1).
      Model A removed the cost they offset. No `creator_fee_minimum_consumption`
      table, no monthly period, no first-of-month branch — this subsystem is gone
      before it is built.
- [ ] **Resolve both rates per user rather than as literals** (§3.5, §3.6). One
      shared resolver, returning 500 bps for everyone today, so a future buyer or
      creator subscription is a data change rather than a trigger rewrite.
- [ ] Record the **reason** each rate applied — standard, subscription,
      promotional, goodwill — on the payment alongside the rate. A `0` with no
      explanation is indistinguishable from a bug.
- [ ] **Lock the resolved rate at agreement acceptance as a ceiling**: a later
      waiver may lower it, nothing may raise it (§3.5). This is what stops a lapsed
      subscription silently repricing an accepted schedule, which Fee Schedule §8
      forbids.
- [ ] Tests: a waived buyer rate produces a zero fee and a recorded reason; a lapsed
      waiver does not raise an accepted schedule's rate; a mid-project waiver lowers
      later instalments only; refunds of a zero-fee payment return zero fee.
- [ ] Apply `amount_multiple` rounding for three-decimal currencies.
- [ ] Enforce the registry's `minimum_instalment` (5.00 in CAD/USD) before a
      payment row is created. Under Model A this protects the **creator** from
      Stripe's flat 0.30 rather than the platform from a loss (§3.1). Give it a
      clear message rather than `PAY-004`'s generic failure.
- [ ] Fix `formatPaymentCents` (`src/domain/payments/listingRequestPaymentDisplay.ts`)
      to divide by the registry exponent, not by 100. Extend
      `src/lib/formatMoney.ts` the same way.
- [ ] Tests: JPY (exponent 0), KWD (exponent 3, multiple of 10), and a CAD/USD
      regression set proving nothing moved.
- [ ] `POST /api/stripe/connect/start` validates country and currency against the
      registries before calling Stripe.
- [ ] Replace the free-text country and currency inputs in
      `CreatorPayoutSettings.tsx` with pickers driven by the registries.
- [ ] Migration: foreign keys from `creator_payment_accounts.country` /
      `.default_currency` and from the agreement, schedule item and payment currency
      columns to the registry.
- [ ] Audit existing rows for values outside the registry before the keys land.
- [ ] Playbook: update `payments/connect-onboarding.md` and `payments/checkout.md`.
      `PAY-004`'s "Note for non-USD work" becomes a description of the registry.
- [ ] First server-side tests for `api/server.js` start here — registry validation is
      a pure function and a good place to begin closing that gap.

**Done:**

- [x] Migration: exempt `is_free` listings from
      `enforce_listing_payment_account_readiness`, and make the trigger watch
      `is_free` so a free listing flipped to paid is still checked. Playbook and UI
      guard updated with it. *(#104)*

---

## Sprint 2 — Currency wave 2 and global onboarding

- [ ] Open creator onboarding to every country in the registry.
- [ ] Enable the wave 2 currencies (§1.3) one at a time, each with a real end-to-end
      run in test mode: agreement → payment → webhook → workflow advance.
- [ ] Per-currency fee minimums and instalment minimums reviewed for purchasing
      power, not set by spot conversion.
- [ ] Publish the enabled currency list and its minimums in the fee schedule — §1 of
      that schedule already requires this before a currency may be enabled.
- [ ] Creator-facing currency picker limited to what their account country can
      settle.
- [ ] Playbook: record the per-currency validation status somewhere durable, so
      "has this currency actually been run end to end" has an answer.

---

## Sprint 3 — Payment integrity, payout hold and the charge handle

**Integrity first (§11).** None of the rules in the scope document are safe until
these hold, and two of them were verified directly against the code.

- [x] `POST /api/stripe/checkout/session` verifies acceptance of the current policy
      versions before opening a session, on every call including a reused session.
      `api/policyVersions.js` mirrors `checkoutPolicyTypes` /
      `currentPolicyVersions` by hand — the two packages share no build step — with
      `src/domain/tests/checkoutPolicyVersionsSync.test.ts` failing loudly if they
      drift. `api/policyAcceptanceGuard.js` holds the pure missing-policy logic and
      is the first server-side test coverage in `api/`.
- [x] Recompute the base, fees and recipient server-side from authoritative rows,
      rather than trusting the stored ledger values.
      `recompute_listing_request_payment_amounts(payment_id)`
      (`supabase/migrations/20260922_120_recompute_payment_amounts_at_checkout.sql`)
      mirrors `ensure_listing_request_payment_for_schedule_item`'s arithmetic,
      called from `POST /api/stripe/checkout/session` before Checkout opens.
      Self-heals drift on a `requires_checkout`/`checkout_opened` payment
      (clearing a stale open session's id if one existed), raises on a
      recipient mismatch, no-ops for `one_time`/settled payments. Verified live
      via `apply_migration` + `begin; ... rollback;`: corrupted amounts healed
      back to the schedule item's true value, a stale `checkout_opened` session
      was cleared, a payer/creator mismatch raised. The currency-registry and
      monthly-minimum recomputation this item originally named doesn't apply
      yet — neither exists (Sprint 1/2); this closes the gap that exists today.
- [x] Restrict the `admin_confirm_*_payment` RPCs — kept, not removed (removing
      would delete a working, tested admin UI built for a real reconciliation
      need). All four now refuse if `listing_request_payments` already has a
      `paid`/`refunded`/`partially_refunded`/`disputed` row for the schedule item
      they'd confirm, closing the exact "leave a schedule satisfied against a
      refunded payment" danger this item names. Each now also posts a system
      message that explicitly says the confirmation was manual and bypassed
      Stripe — the "labelled as break-glass" half — instead of reading like an
      ordinary automated confirmation.
      (`supabase/migrations/20260922_121_restrict_admin_confirm_payment_rpcs.sql`)
      **Found and fixed in the same migration:** the milestone-payment RPC
      (`admin_confirm_listing_request_milestone_payment`, 20260618_101) called
      `public.is_admin()`, which has never existed in this database — confirmed
      via `pg_proc`/`pg_namespace`. Every call to it has failed with "function
      public.is_admin() does not exist" since it was created; it has never
      worked. Fixed to call the real function, `public.is_admin_user(uuid)`
      (20260429_032). Verified live in a `begin; ... rollback;` transaction:
      the new guard correctly refuses against a `paid` row, and a clean
      confirmation now runs end to end (it previously could not have, at all).
- [x] Handle out-of-order and duplicate webhook delivery explicitly.
      **Duplicate delivery** of the same Stripe event id was already handled
      (`recordStripeWebhookEventStart`'s `stripe_event_ids` dedup) and remains so.
      **Out-of-order delivery** across different event types: audited every
      status-writing handler — `markListingRequestPaymentProcessingFromCheckoutSession`,
      `markListingRequestPaymentPaidFromCheckoutSession`,
      `markListingRequestPaymentCancelledFromCheckoutSession`,
      `markListingRequestPaymentFailedFromPaymentIntent` — all already guard
      `if (payment.status === "paid") return` (or an equivalent check) before
      writing, so a late-arriving `checkout.session.expired` or
      `payment_intent.payment_failed` cannot regress an already-paid payment
      regardless of arrival order. The one real gap was `charge.refunded` /
      `charge.dispute.*`, previously not handled at all; the new handlers
      added for charge traceability (above) are themselves designed to be
      order-safe — charge-id-first lookup with a metadata fallback specifically
      so a refund event arriving *before* `checkout.session.completed` still
      finds the right payment, and neither ever writes `status`. Live re-fetch
      of the PaymentIntent for the charge/application-fee ids (rather than
      trusting the webhook payload) is the "reconcile against current Stripe
      object state" half for the one thing the payload doesn't carry; the
      `payment_status` field itself is not re-fetched, since Stripe's own
      guidance treats that field on `checkout.session.completed` as
      authoritative as delivered.
- [x] Decide where `api/server.js` runs in production (§11.1). **Decided
      2026-09-22: Docker, on Google Cloud Run.** Static hosting does not run
      Express, and the Connect webhook needs a real HTTPS origin preserving
      the **raw body** for signature verification.
      **Platform choice, re-verified this session against current terms
      rather than trusting an earlier draft's recommendation:** Fly.io's free
      tier is gone (credit card required, ~$2-15+/month per always-on
      machine); Railway disabled autoscaling entirely in May 2026, which
      rules it out against "must not go down under volume." Cloud Run has a
      real perpetual free tier (2M requests + 360K vCPU-seconds/month),
      deploys straight from a Dockerfile, and autoscales both up (under load)
      and to zero (idle) natively — confirmed with the user before treating
      this as decided.
      **Built:** `api/Dockerfile` (multi-stage, `node:24-alpine`, non-root
      `node` user, `npm ci --omit=dev`, container `HEALTHCHECK` against
      `GET /api/health`) and `api/.dockerignore` (excludes `.env` — production
      config comes entirely from Cloud Run's env vars / Secret Manager,
      `dotenv.config()` only fills values not already in `process.env`, so no
      code change was needed for that part).
      **CORS fixed in the same pass** (was a real limitation, not just a
      Docker concern): `api/server.js` now reads a comma-separated
      `APP_ORIGINS` env var, falling back to the single `APP_ORIGIN` value for
      backward compatibility — adding a new allowed frontend origin (www +
      apex, staging, a preview deploy) is now a platform env-var change, not a
      code deploy. Origin-validation logic is unchanged (still rejects
      anything not in the list).
      **Verified live, locally (not yet against the deployed Cloud Run
      origin — that step is the user's, see below):** ran `api/server.js`
      directly (Docker isn't available in this session) on a throwaway port
      with `APP_ORIGINS` set to two production-shaped origins — confirmed
      both are allowed, `localhost:5173` still works, and an arbitrary origin
      is rejected. Ran `stripe listen --forward-to` against the same running
      process and `stripe trigger checkout.session.completed` — confirmed
      Stripe's real signature verification and raw-body handling succeed
      end to end through this exact code path (several event types returned
      200; `checkout.session.completed` returned 400 only because the
      fixture event carries no real Made for Stream payment id, which is
      expected for a synthetic trigger, not a webhook/signature failure).
      `npx vitest run` (861 tests), `npx tsc --noEmit`, `npx eslint .`,
      `npx vite build` all still pass — confirmed after this change even
      though it's `api/`-only.
      **Deployed and verified live, same session, once the user had a
      working `gcloud` on their machine.** Service:
      `made-for-stream-api` on Cloud Run, region `us-central1`, URL
      `https://made-for-stream-api-422533033771.us-central1.run.app`.
      Verified directly (not "should work"): `GET /api/health` returns
      `{"ok":true,...}`; CORS allows the two configured `APP_ORIGINS` values
      and rejects an arbitrary origin; `/api/stripe/config` confirms the
      Stripe secret key and webhook secret loaded correctly from Secret
      Manager. **Webhook delivery proven two ways:** a real Stripe-triggered
      `checkout.session.completed` event on a live connected test account
      reached `/api/stripe/webhook` (confirmed via Cloud Run request logs —
      `pending_webhooks: 1` on the Stripe event, then a `POST 400` in the
      logs); and a manually HMAC-signed request against the real
      `STRIPE_WEBHOOK_SECRET_DEV` value returned the exact expected
      application error (`"Stripe checkout session is missing Made for
      Stream payment metadata."`) rather than a signature failure —
      proving raw-body preservation and signature verification both work
      correctly through Cloud Run, and that the 400s seen from Stripe's own
      triggered fixture events are the *correct* rejection of a synthetic
      event with no real payment id, not a delivery or verification defect.
      **The webhook endpoint that's actually live is a classic
      `webhook_endpoints` object** (`stripe webhook_endpoints create
      --connect=true`) — see `docs/support/payments/webhooks.md` for why:
      Stripe's newer "Event destinations" UI looked correctly configured but
      never routed a single event (`pending_webhooks: 0` on every trigger),
      a real platform quirk worth knowing about before anyone tries that UI
      again.
      **Sprint 0.5's "register the Connect webhook endpoint" item is
      satisfied by this** — see that line below.
      **Still open:** only a live-mode (`STRIPE_WEBHOOK_SECRET_PROD`)
      webhook endpoint, for whenever `STRIPE_KEY_MODE` flips to `prod` — the
      secret exists in Secret Manager as a placeholder, ready for that
      switch. The stale, non-functional "Event destinations" entry in the
      Stripe Dashboard was left in place rather than deleted (an account
      change outside this session's scope) — worth removing to avoid
      confusion later.
- [x] **Resolved, and it required a real code migration, not a config
      change.** `controller.fees.payer` on Express accounts (§3.2): confirmed
      live against Stripe's real API (2026-09-22) that Express accounts
      *require* `fees.payer: "application"` — no per-account override exists.
      Root cause found: `api/server.js` was still creating **Accounts v1**
      (`type: "express"`) accounts, while this platform's own Connect
      settings were already configured for **Accounts v2**
      (`fees_collector`/`losses_collector: "stripe"`, `dashboard: "none"`).
      Migrated `getOrCreateStripeAccountForEmbeddedConnect` to
      `stripeClient.v2.core.accounts.create()` matching those settings exactly,
      added `getSupabaseUserEmail` (v2 requires `contact_email` once a
      `recipient` configuration/payouts capability is requested),
      `deriveCreatorPaymentAccountReadinessFromV2Account` (maps v2 capability
      statuses onto the existing `charges_enabled`/`payouts_enabled`/
      `details_submitted` booleans so the DB, the readiness trigger and the
      frontend need zero changes), and updated `/api/stripe/connect/sync` to
      retrieve via v2. Removed the dead v1-only `/api/stripe/connect/start`
      route and its exclusively-used helpers (`createStripeConnectAccount`,
      `getStripeConnectAccountLink`, plus now-unused
      `STRIPE_CONNECT_RETURN_URL`/`STRIPE_CONNECT_REFRESH_URL`). Verified
      live end to end against Stripe's test API before trusting any of it:
      v2 account creation with the platform's exact config, capability-status
      reads, and — the one that mattered most — that a **direct charge with
      `application_fee_amount` still works unchanged** against a v2 account
      via the same `Stripe-Account` header pattern already used everywhere
      else. Also verified the existing embedded-components `accountSessions.create`
      call (what the onboarding UI actually uses) works unmodified against a
      v2 account, so **no frontend changes were needed**. 861 tests still
      passing, tsc/eslint clean. See §3.2, §9.1, §9.2 for the account.
      **One real cost, not free:** the 14-day payout hold (§6.3) does not
      survive this migration at the guaranteed figure originally decided —
      see that item below.
- [x] Idempotently reserve a schedule item against concurrent checkout attempts.
      Already satisfied, not newly built: `20260905_110` created
      `listing_request_payments_payment_schedule_item_idx`, a unique index on
      `payment_schedule_item_id` where not null, specifically so
      `ensure_listing_request_payment_for_schedule_item`'s `on conflict do
      nothing` + re-select has a real conflict target. Confirmed live via
      `pg_indexes` that the index still exists and is unique. No new migration
      needed for this item.

Two prerequisites for refunds. The hold keeps the money available so most refunds
never need platform funding; the charge handle is what a refund is issued against.

**Payout hold (§6.3)**

- [x] **Superseded by the v1→v2 migration above — the mechanism changed
      entirely, not just the account-creation path.** For v2 accounts, payout
      scheduling is not part of account creation; it's a separate Balance
      Settings resource (`stripeClient.balanceSettings.update(...)`, called
      per-account via the `Stripe-Account` header). New helper
      `setStripeConnectDailyPayoutSchedule` sets `interval: "daily"`
      immediately after account creation in
      `getOrCreateStripeAccountForEmbeddedConnect`. **`delay_days` is not set
      to 14 and cannot be** — confirmed live that
      `settlement_timing.delay_days_override` is rejected outright while
      `losses_collector` is `"stripe"` (the platform doesn't own liability),
      which is the configuration kept per the user's explicit 2026-09-22
      decision (lower platform risk over payout-timing control). The delay
      stays at whatever Stripe assigns — confirmed 7 days on a Canadian test
      account, unconfirmed in live mode or for other countries. §6.3 has the
      full account; §3.1/§3.3/§3.4's dollar figures are unaffected (this only
      changes payout *timing*, not fee economics).
- [ ] **Follow-up, still open:** confirm the real live-mode delay (Stripe's
      default may differ from the 7-day test-mode figure observed), and decide
      whether it's acceptable to publish in the fee schedule as-is or whether
      it needs monitoring per country as currency waves expand (§1.3).
- [ ] **Follow-up, still open:** one existing connected account
      (`creator_payment_accounts`, `charges_enabled = false`) predates this
      session's fixes entirely (created under the old v1 path with no
      schedule at all) and was not migrated to a v2 account or re-synced. It
      should be re-onboarded or explicitly retired once its Stripe mode
      (test/live) is confirmed — not mutated automatically here.

**Charge traceability**

- [x] Populate `stripe_charge_id` and `stripe_application_fee_id` on the paid path in
      `markListingRequestPaymentPaidFromCheckoutSession`, through the same
      cross-checks the webhook already runs. Fetched live from the PaymentIntent's
      expanded `latest_charge` (`getChargeDetailsFromPaymentIntent`) since neither
      id is present on the Checkout Session or PaymentIntent webhook payload
      itself. Self-heals via `backfillChargeDetailsForPayment` when a `paid`
      payment missing its charge id is retried through the "downstream workflow
      failed" branch.
- [ ] **Bulk-backfill both columns for existing `paid` rows from Stripe.** Not run
      in this session — there are zero `paid` rows as of 2026-09-22 (no live
      traffic), so there is nothing to backfill yet. Write and run this before the
      first real payment lands under the pre-fix code, not after
      (docs/support/payments/refunds-and-disputes.md Known gaps).
- [x] Handle `charge.refunded`, `charge.dispute.created` and `charge.dispute.closed`
      in `processStripeWebhookEvent` — recording them against the payment
      (`stripe_refund_id`/`refunded_at`, `stripe_dispute_id`/`disputed_at`) and
      reusing the `stripe_event_ids` idempotency pattern. No status writes, as
      specified — `status` still requires the Sprint 5 refund ledger to derive
      correctly. Lookup is charge-id-first with a metadata fallback specifically
      so a `charge.refunded` arriving before `checkout.session.completed` (Stripe
      does not guarantee order) still finds the right payment.
- [x] Admin surface listing disputes and out-of-band refunds, replacing the manual
      query in `REF-002`/`REF-003`. New page `/admin/payment-issues`
      (`src/pages/admin/AdminPaymentIssues.tsx`, hook
      `src/hooks/admin/useAdminPaymentIssues.ts`), linked from the admin
      dashboard and routed in `App.tsx` inside the existing
      `RequireAdminAccess` block — no new RLS needed, the existing "listing
      request payments participants read" policy already grants admins
      (`admin_roles` membership) `SELECT` on every row. Filters by
      disputed/refunded/all, and explicitly calls out per-row when `status`
      still reads `paid` despite a recorded refund or dispute, since that
      divergence is the actual thing this page exists to surface. Tests added
      (`src/pages/tests/AdminPaymentIssues.test.tsx`).
- [x] Playbook: rewrite `payments/refunds-and-disputes.md` — `REF-002` and `REF-003`
      lose their "no trace but an ignored row" framing; they now query the payment
      row's own new columns. A new gap replaces it: `status` still says `paid`
      after a recorded refund or dispute, and that divergence is what's now
      documented as the operational risk.

---

## Sprint 4 — Cancellation

- [ ] Migration: add `cancelled` to `listing_requests_status_check`, with
      `cancelled_at`, `cancelled_by_user_id` and `cancellation_reason`, plus the
      metadata check constraint matching the `completed` pattern in `20260611_093`.
- [ ] `security definer` RPC `cancel_listing_request_before_payment` — the
      unilateral pre-payment path (§5.1). Writes the `cancelled` status that already
      exists on agreements, schedule items, milestones, change orders and final
      deliveries.
- [ ] Expire any open Stripe checkout session for payments the cancellation moves to
      `cancelled`.
- [ ] Migration + RPCs for the post-payment cancellation proposal (§5.2): propose
      with a per-milestone earned-value statement, accept, dispute.
- [ ] The three-business-day itemised cancellation statement deadline is recorded and
      visible to both parties.
- [ ] Workspace UI: cancellation entry points, the proposal and response screens, and
      the "Next step" card understanding a cancelled request.
- [ ] Migration: add structured `usage_rights` to the agreement (§5.3), snapshotted
      at acceptance.
- [ ] Migration: make `included_revision_count` nullable and apply the two-round
      fallback when null (§5.4).
- [ ] Playbook: new `requests/cancellation.md`; update `requests/request-lifecycle.md`
      (`REQ-003` loses its "no cancellation workflow" gap) and `requests/agreements.md`.

---

## Sprint 5 — Refunds, tips and creator recovery balances

Depends on Sprint 3 for the payout hold and charge handle, and Sprint 4 for what a
refund does to the project.

Three things ship together here on purpose. The recovery mechanism is what makes a
platform-funded refund safe to offer. Tips ship **with** refunds rather than before
them, because a contribution we cannot refund correctly is worse than no
contribution at all.

**Refund execution**

- [ ] Migration: an **immutable refund ledger** — one row per Stripe refund with its
      amount, the buyer and creator fees reversed with it, actor, reason and
      timestamp. The existing columns are a single nullable `stripe_refund_id` and a
      single `refunded_at`, with **no amount and no history**, so two partial refunds
      against one payment have nowhere to go (§6.2). This lands *with* the refund
      feature, not after it.
- [ ] Derive `partially_refunded` and `refunded` from the sum of settled refunds
      rather than writing them directly, so the status cannot drift from Stripe.
- [ ] `security definer` RPC `apply_refunded_listing_request_payment`, following the
      `apply_paid_listing_request_*` shape, writing the ledger row and deriving
      status.
- [ ] Proportional cumulative fee arithmetic per §6.2, using registry exponents, with
      tests covering repeated partial refunds and the final rounding remainder.
- [ ] Admin-only refund route: `stripe.refunds.create` on the connected account with
      `refund_application_fee: true`.
- [ ] Cascade the request per §6.7.
- [ ] `charge.refunded` webhook branch now writes status, so a refund issued directly
      in Stripe reconciles instead of diverging.

**Tips and platform contributions (§4)**

- [ ] Tip and contribution controls on the checkout page, both defaulting to zero and
      requiring affirmative selection per Fee Schedule §4.
- [ ] API route recomputing `total_checkout_cents` and `application_fee_cents` and
      reissuing the Stripe session. Verify the `updated_at` idempotency key rotates
      as intended when the amount changes.
- [ ] Confirm the schema's existing check constraints hold: a tip raises the total
      but not the application fee; a contribution raises both.
- [ ] Tips and contributions must not consume or count toward the monthly fee
      minimum (§3.1).
- [ ] A tip falls under the payout hold as creator money; a contribution does not.
- [ ] Contribution refunds per Refund Policy §8 — returned in full on a full
      cancellation, **not** prorated on a partial refund, requestable within 14 days
      of the contribution or the cancellation whichever is later, and reviewable
      outside that window when mistaken, duplicate or unauthorised. This is a
      separate path with its own clock; give it its own tests.

**Platform-funded refunds (§6.5)**

- [ ] Migration: `creator_recovery_balances` and a `creator_recovery_entries` ledger
      — one debit when the platform funds a refund, one credit per recovery.
- [ ] Refund path takes from the held balance first (§6.3), and only funds a
      shortfall from the platform — opening a recovery balance — when the hold has
      already released.
- [ ] Add the outstanding-balance check to the `listing requests buyer insert` RLS
      policy on `public.listing_requests`. This is the enforcement boundary — the UI
      check is a courtesy on top of it.
- [ ] Listing and creator-profile UI explain why a request cannot be sent, without
      exposing the creator's financial detail to buyers.
- [ ] Recovery on subsequent payments: raise `application_fee_amount` by the recovery
      instalment, **capped at 50% of the base payment** (§6.6), respecting
      `application_fee_cents < total_checkout_cents`.
- [ ] Creator settings: balance visible, entry history, and a direct settlement path
      (a platform charge on their card, not on the connected account).
- [ ] Automatic release — the block lifts when the balance reaches zero, with no
      admin action.
- [ ] Admin write-off action for a balance that will never be recovered.
- [ ] Tests covering the recovery cap, the partial recovery across several payments,
      and the release.
- [ ] Creator Terms and Fee Schedule §5 disclose the recovery obligation **before** a
      creator can incur one.
- [ ] Playbook: `payments/refunds-and-disputes.md` stops being a gap document;
      `REF-001` and `REF-002` gain real resolutions, and recovery balances get their
      own issues.

---

## Sprint 6 — Non-response, closure and transactional email

Email ships here because the notices are its first real use, but the Supabase SMTP
item is a live production gap and can be pulled forward on its own at any point.

- [ ] Migration: notice records against a request — type (first / final), sender,
      what was requested, sent and expiry timestamps.
- [ ] RPCs to send a first notice and a final notice, enforcing the 7 + 7 day clock
      and refusing a final notice before the first has expired.
- [ ] Administrative closure RPC — admin only, on a request with an expired final
      notice, recording the reason and cascading per §5.
- [ ] Workspace UI: notice state, countdown, and the request-closure action for the
      waiting party.
**Transactional email (§7.1)**

- [ ] Enable Cloudflare Workers Paid and onboard `send.madeforstream.com` as the
      sending domain. Until a domain is onboarded, sending is limited to addresses
      verified on the account.
- [ ] Confirm Email Routing for `inbox@madeforstream.com` on the root domain, and
      that Cloudflare manages the SPF and DKIM records for both directions.
- [ ] Send from the Express API over the REST API or SMTP. **No Workers code
      required** — do not introduce a Workers deployment just to send mail.
- [ ] Templates: payment receipt, first notice, final notice, payout released. The
      last is not optional once the payout hold ships (§6.3).
- [ ] Point **Supabase custom SMTP** at the same provider and sending domain. Auth
      mail currently goes through Supabase's built-in service, which is rate-limited
      to a handful per hour and is not for production — this is a live gap
      independent of the rest of this sprint.
- [ ] Warm the sending domain before launch. New accounts start on a conservative
      daily quota that scales with sending behaviour; launch day is the wrong time
      to discover the ceiling.
- [ ] Record delivery outcomes against the notice records, so a disputed closure can
      show the notice was accepted for delivery.
- [ ] Suppression-list handling, so a hard bounce does not silently restart a notice
      clock that nobody received.
- [ ] Playbook: new `messaging/transactional-email.md` — bounced notice, unverified
      domain, quota exceeded, and what a failed notice means for the 7 + 7 clock.
- [ ] Staleness query surfaced in admin: requests not advanced in 14+ days with a
      pending action on one side.
- [ ] Playbook: `REQ-003` in `requests/request-lifecycle.md` is rewritten from "no
      policy exists" to the documented procedure; update
      `requests/final-delivery.md` and `requests/milestones.md`, whose gaps both
      point at it.

---

## Sprint 7 — Regional sales tax

Its own sprint because the blocking work is a professional opinion, not a migration,
and burying that inside an engineering sprint is how it gets skipped (§12).

**Do first, in parallel with everything above**

- [ ] Jurisdiction-specific advice on registration and remittance, at minimum for EU
      VAT and UK VAT. **EU VAT applies from the first euro** with no small-seller
      threshold for a non-established supplier, so this gates wave 2, not a later
      phase.
- [ ] Decide which jurisdictions to register in and in what order.
- [ ] Confirm whether our own fees — the buyer service fee and the platform
      contribution — are separately taxable in each. This is a different question
      from tax on the commission.

**Product work**

- [ ] Migration: `tax_cents` and jurisdiction on `listing_request_payments`, included
      in `total_checkout_cents`. The table has **no tax field at all** today, while
      Fee Schedule §6 already promises the payment record identifies tax separately.
- [ ] Integrate Stripe Tax for calculation at checkout.
- [ ] Capture and store buyer location evidence — EU VAT requires two
      non-contradictory pieces.
- [ ] Show tax separately before payment, as §6 already requires.
- [ ] Proportional tax adjustment on refunds, per Refund Policy §8.
- [ ] Store creator tax status and country from Connect onboarding, and apply reverse
      charge on qualifying B2B supplies within the EU.
- [ ] Rewrite Fee Schedule §6 (§10).
- [ ] Playbook: new `payments/tax.md`.

---

## Sprint 8 — Policy publication and launch gates

- [ ] Apply the §10 policy edits across `src/domain/legal/`: **Made for Stream** as
      the entity, `inbox@madeforstream.com` replacing all three email placeholders,
      currencies stated, both fee minimums removed and the 5.00 instalment floor
      added, the payout hold and the recovery obligation disclosed, tips and
      contributions described as the shipping feature they now are.
- [ ] Cut non-draft policy versions and remove every `// REVIEW DRAFT` marker.
      Version bumps re-trigger acceptance automatically, which is the intended
      behaviour.
- [ ] Express-consent-to-immediate-start capture at agreement acceptance (§1.5),
      recorded through `policy_acceptances`. **Required, not optional, now that EU
      and UK buyers are in scope.**
- [ ] Enforce the instalment floors at agreement send and schedule item creation,
      with the plain-language message, and quote the agreement's fee estimate as a
      maximum (§3.1).
- [ ] **Publish the Service Provider Register** (§7.2) — Supabase, Stripe,
      Cloudflare and Google Fonts, each with its function and processing locations,
      routed and styled like the other legal pages. The privacy policy references it
      three times and says the published version must include it; it does not exist.
- [ ] Name Cloudflare in Privacy Policy §4 alongside Supabase and Stripe.
- [ ] Register a DMCA designated agent with the US Copyright Office (§9.1).
- [ ] Full end-to-end rehearsal in test mode, in at least three currencies including
      one non-CAD/USD: request → agreement → starting payment → milestone → change
      order → final delivery → completion, then again down the cancellation, refund,
      payout-hold and recovery-balance paths — including a second payment in the same
      month, to prove the minimum is charged once.
- [ ] Verify `npx vitest run`, `npx tsc --noEmit`, `npx eslint .`, `npx vite build`
      against the recorded baselines.

---

## Carried, not launch-blocking

Real gaps the playbooks already record. None of them stops a buyer paying a creator,
so none of them is in the eight sprints above — but they should not be lost.

- [ ] `account.updated` webhook handling — the largest gap in
      `connect-onboarding.md`. Readiness is checked at publish time and never again.
      **Global scope raises this**: verification requirements and capability
      restrictions vary by country, so a stale mirror gets wrong more often.
- [ ] Scheduled resync of `creator_payment_accounts`.
- [ ] Alerting for the stuck-payment query in `PAY-005`, the mismatch query in
      `CHG-003`, and the staleness query from Sprint 6.
- [ ] Fix the `processing` state — buyer copy, creator SLA, reminders, reconciliation
      that understands a legitimately slow payment. This is the prerequisite for
      local payment methods (§1.6), which matter a lot in several European markets.
- [ ] Delivery links are never verified, so a dead link is indistinguishable from a
      good one at approval time (`final-delivery.md`).
- [ ] Change orders' effect on existing milestone schedules is undocumented and the
      `AGR-001` totals checks may not reconcile afterwards (`change-orders.md`).
- [ ] No versioned view of agreement terms over time, so which version applied when
      cannot be reconstructed for a dispute (`agreements.md`, `change-orders.md`).
- [ ] `api/server.js` still has close to no test coverage.
