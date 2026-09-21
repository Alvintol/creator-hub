# Launch Implementation Checklist

The build order for [`launch-scope.md`](launch-scope.md). Ordered by dependency, not
by size: each sprint assumes the ones before it have landed.

Every item follows `AGENTS.md`: enforcement at the database and API rather than the
UI alone, the next free migration number taken from `supabase/migrations/`, and a
support playbook written or updated before the branch is ready.

**Baselines to hold** (as of 2026-09-17): 740 tests passing, eslint 21 pre-existing
errors, tsc 19 lines. Do not let them grow.

---

## Sprint 1 — Close the currency and country hole

Nothing else is safe to build while a creator can onboard in an unvalidated
currency. Smallest sprint, highest urgency.

- [ ] Add a shared `SUPPORTED_CREATOR_COUNTRIES` / `SUPPORTED_CURRENCIES` module and
      use it on both sides of the wire.
- [ ] `POST /api/stripe/connect/start` — reject a country or currency outside the
      allowlist with a specific message, before any Stripe call.
- [ ] Replace the free-text country and currency inputs in
      `CreatorPayoutSettings.tsx` with `<select>`s driven by that module.
- [ ] Migration: check constraints on `creator_payment_accounts.country` and
      `.default_currency`.
- [ ] Migration: check constraint restricting `listing_request_agreements.currency`,
      `listing_request_payment_schedule_items.currency` and
      `listing_request_payments.currency` to the allowlist.
- [ ] Set `payment_method_types: ["card"]` on the checkout session.
- [ ] Audit existing rows for out-of-allowlist values before the constraints land.
- [ ] Playbook: update `payments/connect-onboarding.md` and `payments/checkout.md`
      (`PAY-004`'s non-USD note becomes a statement of the enforced allowlist).
- [ ] First server-side tests for `api/server.js` start here — the allowlist is a
      pure function and a good place to begin closing that gap.

**Also in this sprint, because it is two lines and blocks free-listing creators:**

- [ ] Migration: exempt `is_free` listings from
      `enforce_listing_payment_account_readiness`.
- [ ] Playbook: update `listings/listings.md`.

---

## Sprint 2 — Make the charge traceable

Everything about refunds depends on holding the charge handle. Build this before the
refund engine, not with it.

- [ ] Populate `stripe_charge_id` and `stripe_application_fee_id` on the paid path in
      `markListingRequestPaymentPaidFromCheckoutSession`, through the same
      cross-checks the webhook already runs.
- [ ] Backfill both columns for existing `paid` rows from Stripe.
- [ ] Handle `charge.refunded`, `charge.dispute.created` and `charge.dispute.closed`
      in `processStripeWebhookEvent` — at this stage recording them against the
      payment and surfacing them, reusing the `stripe_event_ids` idempotency
      pattern. No status writes yet.
- [ ] Admin surface listing disputes and out-of-band refunds, replacing the manual
      `ignored`-events query in `REF-002`.
- [ ] Playbook: rewrite `payments/refunds-and-disputes.md` — `REF-002` and `REF-003`
      lose their "no trace but an ignored row" framing.

---

## Sprint 3 — Cancellation

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
- [ ] Migration: add structured `usage_rights` to the agreement (§5.3), snapshotted at
      acceptance.
- [ ] Migration: make `included_revision_count` nullable and apply the two-round
      fallback when null (§5.4).
- [ ] Playbook: new `requests/cancellation.md`; update `requests/request-lifecycle.md`
      (`REQ-003` loses its "no cancellation workflow" gap) and `requests/agreements.md`.

---

## Sprint 4 — Refunds

Depends on Sprint 2 for the charge handle and Sprint 3 for what a refund does to the
project.

- [ ] `security definer` RPC `apply_refunded_listing_request_payment`, following the
      `apply_paid_listing_request_*` shape, writing `refunded` /
      `partially_refunded`, `stripe_refund_id` and `refunded_at`.
- [ ] Proportional cumulative fee arithmetic per §6.2, with tests covering repeated
      partial refunds and the final rounding remainder.
- [ ] Admin-only refund route: `stripe.refunds.create` on the connected account with
      `refund_application_fee: true`.
- [ ] Cascade the request per §6.3.
- [ ] `charge.refunded` webhook branch now writes status, so a refund issued directly
      in Stripe reconciles instead of diverging.
- [ ] Insufficient-balance handling, once §9.3 is answered.
- [ ] Playbook: `payments/refunds-and-disputes.md` stops being a gap document;
      `REF-001` and `REF-002` gain real resolutions.

---

## Sprint 5 — Non-response and closure

- [ ] Migration: notice records against a request — type (first / final), sender,
      what was requested, sent and expiry timestamps.
- [ ] RPCs to send a first notice and a final notice, enforcing the 7 + 7 day clock
      and refusing a final notice before the first has expired.
- [ ] Administrative closure RPC — admin only, on a request with an expired final
      notice, recording the reason and cascading per §5.
- [ ] Workspace UI: notice state, countdown, and the request-closure action for the
      waiting party.
- [ ] Transactional email for payment receipt, first notice and final notice — **only
      if §7.1 is approved.**
- [ ] Staleness query surfaced in admin: requests not advanced in 14+ days with a
      pending action on one side.
- [ ] Playbook: `REQ-003` in `requests/request-lifecycle.md` is rewritten from "no
      policy exists" to the documented procedure; update
      `requests/final-delivery.md` and `requests/milestones.md`, whose gaps both
      point at it.

---

## Sprint 6 — Policy publication and launch gates

- [ ] Resolve §9.1: legal entity, `[SUPPORT_EMAIL]`, `[PRIVACY_EMAIL]`,
      `[DMCA_AGENT_EMAIL]`, governing law.
- [ ] Apply the §10 policy edits: tips and support removed, currencies stated, the
      10.00 instalment minimum added.
- [ ] Cut non-draft policy versions and remove every `// REVIEW DRAFT` marker.
      Version bumps re-trigger acceptance automatically, which is the intended
      behaviour.
- [ ] Express-consent-to-immediate-start capture at agreement acceptance (§1.2),
      recorded through `policy_acceptances`.
- [ ] Enforce the 10.00 per-instalment minimum at agreement send and schedule item
      creation, with the plain-language message.
- [ ] Full end-to-end rehearsal in test mode, both currencies: request → agreement →
      starting payment → milestone → change order → final delivery → completion, then
      again down the cancellation and refund paths.
- [ ] Verify `npx vitest run`, `npx tsc --noEmit`, `npx eslint .`, `npx vite build`
      against the recorded baselines.

---

## Carried, not launch-blocking

Real gaps the playbooks already record. None of them stops a buyer paying a creator,
so none of them is in the six sprints above — but they should not be lost.

- [ ] `account.updated` webhook handling — the largest gap in
      `connect-onboarding.md`. Readiness is checked at publish time and never again.
- [ ] Scheduled resync of `creator_payment_accounts`.
- [ ] Alerting for the stuck-payment query in `PAY-005`, the mismatch query in
      `CHG-003`, and the staleness query from Sprint 5.
- [ ] Delivery links are never verified, so a dead link is indistinguishable from a
      good one at approval time (`final-delivery.md`).
- [ ] Change orders' effect on existing milestone schedules is undocumented and the
      `AGR-001` totals checks may not reconcile afterwards (`change-orders.md`).
- [ ] No versioned view of agreement terms over time, so which version applied when
      cannot be reconstructed for a dispute (`agreements.md`, `change-orders.md`).
- [ ] Manual `admin_confirm_*_payment` RPCs are reachable in the admin UI and are not
      labelled as break-glass (`milestones.md`).
- [ ] `api/server.js` still has close to no test coverage.
