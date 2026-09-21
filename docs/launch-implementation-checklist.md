# Launch Implementation Checklist

The build order for [`launch-scope.md`](launch-scope.md). Ordered by dependency, not
by size: each sprint assumes the ones before it have landed.

Every item follows `AGENTS.md`: enforcement at the database and API rather than the
UI alone, the next free migration number taken from `supabase/migrations/`, and a
support playbook written or updated before the branch is ready.

**Baselines to hold** (as of 2026-09-17): 740 tests passing, eslint 21 pre-existing
errors, tsc 19 lines. Do not let them grow.

---

## Sprint 1 — The currency registry

Global availability rests entirely on this. Three places in the product assume a
currency has exactly 100 minor units, and until that assumption is gone, enabling a
new currency ships wrong money rather than a new market.

- [ ] Migration: `supported_currencies` table per `launch-scope.md` §1.1 — code,
      `minor_unit_exponent`, `amount_multiple`, per-currency fee minimums,
      `minimum_instalment`, `stripe_minimum_charge`, `enabled`. Seeded with CAD and
      USD enabled, wave 2 rows present and disabled.
- [ ] Migration: `supported_countries`, seeded from Stripe's Connect availability
      list, recording which capabilities each supports.
- [ ] Rewrite `ensure_listing_request_payment_for_schedule_item` to take the
      exponent and the minimums from the registry instead of `* 100`, `100` and
      `150`. Behaviour for CAD and USD must be **byte-identical** — that is the
      regression test.
- [ ] Apply `amount_multiple` rounding for three-decimal currencies.
- [ ] Enforce `stripe_minimum_charge` before a payment row is created, with a clear
      message rather than `PAY-004`'s generic failure.
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

**Also in this sprint, because it is two lines and blocks free-listing creators:**

- [ ] Migration: exempt `is_free` listings from
      `enforce_listing_payment_account_readiness`.
- [ ] Playbook: update `listings/listings.md`.

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

## Sprint 3 — Make the charge traceable

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

## Sprint 5 — Refunds and creator recovery balances

Depends on Sprint 3 for the charge handle and Sprint 4 for what a refund does to the
project. The recovery half is what makes a platform-funded refund safe to offer, so
it ships with the refund, not after it.

**Refund execution**

- [ ] `security definer` RPC `apply_refunded_listing_request_payment`, following the
      `apply_paid_listing_request_*` shape, writing `refunded` /
      `partially_refunded`, `stripe_refund_id` and `refunded_at`.
- [ ] Proportional cumulative fee arithmetic per §6.2, using registry exponents, with
      tests covering repeated partial refunds and the final rounding remainder.
- [ ] Admin-only refund route: `stripe.refunds.create` on the connected account with
      `refund_application_fee: true`.
- [ ] Cascade the request per §6.5.
- [ ] `charge.refunded` webhook branch now writes status, so a refund issued directly
      in Stripe reconciles instead of diverging.

**Platform-funded refunds (§6.3)**

- [ ] Migration: `creator_recovery_balances` and a `creator_recovery_entries` ledger
      — one debit when the platform funds a refund, one credit per recovery.
- [ ] Refund path detects an insufficient connected-account balance and funds the
      shortfall from the platform, opening a recovery balance.
- [ ] Add the outstanding-balance check to the `listing requests buyer insert` RLS
      policy on `public.listing_requests`. This is the enforcement boundary — the UI
      check is a courtesy on top of it.
- [ ] Listing and creator-profile UI explain why a request cannot be sent, without
      exposing the creator's financial detail to buyers.
- [ ] Recovery on subsequent payments: raise `application_fee_amount` by the recovery
      instalment, capped per §6.4, respecting
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

## Sprint 6 — Non-response and closure

- [ ] Migration: notice records against a request — type (first / final), sender,
      what was requested, sent and expiry timestamps.
- [ ] RPCs to send a first notice and a final notice, enforcing the 7 + 7 day clock
      and refusing a final notice before the first has expired.
- [ ] Administrative closure RPC — admin only, on a request with an expired final
      notice, recording the reason and cascading per §5.
- [ ] Workspace UI: notice state, countdown, and the request-closure action for the
      waiting party.
- [ ] Transactional email for payment receipt, first notice and final notice — **only
      if §9.2.1 is approved.**
- [ ] Staleness query surfaced in admin: requests not advanced in 14+ days with a
      pending action on one side.
- [ ] Playbook: `REQ-003` in `requests/request-lifecycle.md` is rewritten from "no
      policy exists" to the documented procedure; update
      `requests/final-delivery.md` and `requests/milestones.md`, whose gaps both
      point at it.

---

## Sprint 7 — Policy publication and launch gates

- [ ] Apply the §10 policy edits across `src/domain/legal/`: **Made for Stream** as
      the entity, `inbox@madeforstream.com` replacing all three email placeholders,
      currencies stated, the per-instalment minimum added, the recovery obligation
      disclosed, tips removed if §4 is accepted.
- [ ] Cut non-draft policy versions and remove every `// REVIEW DRAFT` marker.
      Version bumps re-trigger acceptance automatically, which is the intended
      behaviour.
- [ ] Express-consent-to-immediate-start capture at agreement acceptance (§1.5),
      recorded through `policy_acceptances`. **Required, not optional, now that EU
      and UK buyers are in scope.**
- [ ] Enforce the per-instalment minimum at agreement send and schedule item
      creation, with the plain-language message.
- [ ] Register a DMCA designated agent with the US Copyright Office (§9.1).
- [ ] Full end-to-end rehearsal in test mode, in at least three currencies including
      one non-CAD/USD: request → agreement → starting payment → milestone → change
      order → final delivery → completion, then again down the cancellation, refund
      and recovery-balance paths.
- [ ] Verify `npx vitest run`, `npx tsc --noEmit`, `npx eslint .`, `npx vite build`
      against the recorded baselines.

---

## Carried, not launch-blocking

Real gaps the playbooks already record. None of them stops a buyer paying a creator,
so none of them is in the seven sprints above — but they should not be lost.

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
- [ ] Marketplace tax collection, once §9.2.3 is decided.
- [ ] Delivery links are never verified, so a dead link is indistinguishable from a
      good one at approval time (`final-delivery.md`).
- [ ] Change orders' effect on existing milestone schedules is undocumented and the
      `AGR-001` totals checks may not reconcile afterwards (`change-orders.md`).
- [ ] No versioned view of agreement terms over time, so which version applied when
      cannot be reconstructed for a dispute (`agreements.md`, `change-orders.md`).
- [ ] Manual `admin_confirm_*_payment` RPCs are reachable in the admin UI and are not
      labelled as break-glass (`milestones.md`).
- [ ] `api/server.js` still has close to no test coverage.
