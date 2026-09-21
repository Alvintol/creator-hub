# Launch Implementation Checklist

The build order for [`launch-scope.md`](launch-scope.md). Ordered by dependency, not
by size: each sprint assumes the ones before it have landed. Sprint 7 is the
exception — its blocking item is external advice, so it starts in parallel.

Every item follows `AGENTS.md`: enforcement at the database and API rather than the
UI alone, the next free migration number taken from `supabase/migrations/`, and a
support playbook written or updated before the branch is ready.

**Baselines to hold** (as of 2026-09-17): 740 tests passing, eslint 21 pre-existing
errors, tsc 19 lines. Do not let them grow.

---

## Sprint 0.5 — Stripe portal configuration

**Dashboard settings, not code.** These are quick, they cost nothing, and three of
them decide numbers that get published — so they come before the fee work rather
than during it. Record the answer to each one in this file as it is confirmed;
several are invisible from the codebase and will otherwise be re-derived wrongly.

**Pricing model and fee liability**

- [ ] Confirm which Connect pricing model the platform is on: **"Stripe handles
      pricing"** (no platform fees) or **"you handle pricing"** (CA$2 per monthly
      active account, 0.25% + CA$0.25 per payout, platform responsible for
      processing). Assumed to be **"you handle pricing"**.
- [ ] **Confirm who bears the 2.9% + CA$0.30 processing fee** on a direct charge —
      the connected account or the platform. This is the single largest input to
      unit economics: it is the difference between netting 10.00 and 6.65 on a
      CAD 100 commission (§3.1).
- [ ] If the platform bears processing, **Fee Schedule §5 is wrong** — "The creator
      is responsible for those transaction-related charges to the extent charged to
      their connected account" — and must be rewritten before publication.
- [ ] Verify the CA$2 monthly active account line actually appears on a Stripe
      invoice, and capture one invoice as the reference for what we are charged.
- [ ] Check whether the platform qualifies for Stripe's revenue share under "Stripe
      handles pricing", and whether that model would net more than the current one
      once the account and payout fees are counted.

**Payouts**

- [ ] Decide the payout interval. §6.3 currently specifies `daily`, which at up to
      ~30 payouts a month costs up to CA$7.50 in fixed payout fees and would swallow
      the monthly minimum whole. **`weekly` is recommended** at about CA$1.00.
- [ ] Verify how `delay_days` interacts with a non-`daily` interval before
      implementing the 14-day hold — `delay_days` is a `daily` schedule parameter.
- [ ] Confirm the per-payout 0.25% volume fee is understood as a standing cost: at a
      5% creator fee it consumes about 5% of gross revenue.

**Other settings that affect published numbers**

- [ ] Record Stripe's minimum charge amount per currency we intend to enable, for
      the registry's `stripe_minimum_charge` column (Sprint 1).
- [ ] Confirm international card and currency conversion surcharges, and who bears
      them, before enabling a currency outside CAD/USD.
- [ ] Register the Connect **webhook endpoint** against the production API origin
      once §11.1 is decided, and confirm the raw body reaches signature
      verification intact.

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
      `150`. For a month's first payment in CAD or USD the result must be
      **byte-identical** to today — that is the regression test.
- [ ] Migration: `creator_fee_minimum_consumption` — one row per creator, currency
      and UTC calendar month, recording which payment consumed that month's minimum
      (§3.1). The fee calculation consults it; only a successful payment consumes it;
      a full refund of the consuming payment releases it for the next one.
- [ ] Tests: second payment in a month pays percentage only; refund of the consuming
      payment re-arms the minimum; two currencies in one month consume separately;
      a month boundary in UTC.
- [ ] Apply `amount_multiple` rounding for three-decimal currencies.
- [ ] Enforce the instalment floor before a payment row is created — the registry's
      `minimum_instalment` for a month's first payment, `stripe_minimum_charge` after
      that (§3.1) — with a clear message rather than `PAY-004`'s generic failure.
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

## Sprint 3 — Payment integrity, payout hold and the charge handle

**Integrity first (§11).** None of the rules in the scope document are safe until
these hold, and two of them were verified directly against the code.

- [ ] `POST /api/stripe/checkout/session` verifies acceptance of the current policy
      versions before opening a session. The string `policy_accept` **does not appear
      anywhere in `api/server.js`** — the gate is browser-only today, which per
      `AGENTS.md` is not a boundary.
- [ ] Recompute the base, fees and recipient server-side from authoritative rows,
      the currency registry and the monthly-minimum state, rather than trusting the
      stored ledger values. This matters more once fees vary by currency and month.
- [ ] Restrict or remove the `admin_confirm_*_payment` RPCs and their admin UI
      entry points. They mark money received without verifying it moved, and once
      refunds exist they can leave a schedule satisfied against a refunded payment.
      If they survive, they are an audited named exception, labelled as break-glass.
- [ ] Handle out-of-order and duplicate webhook delivery explicitly. Stripe
      guarantees neither. Reconcile against current Stripe object state rather than
      trusting the event payload alone.
- [ ] Decide where `api/server.js` runs in production (§11.1). Static hosting does
      not run Express, and the Connect webhook needs a real HTTPS origin preserving
      the **raw body** for signature verification. This gates registering the webhook
      endpoint at all.
- [ ] Idempotently reserve a schedule item against concurrent checkout attempts.

**Payout hold (§6.3)**

Two prerequisites for refunds. The hold keeps the money available so most refunds
never need platform funding; the charge handle is what a refund is issued against.

**Payout hold (§6.3)**

- [ ] Change `createStripeConnectAccount` from
      `settings.payouts.schedule.interval = "manual"` to `interval: "daily"` with
      `delay_days: 14`.
- [ ] Apply the same schedule to every existing connected account. **They are all on
      `manual` today and nothing has ever created a payout** — so this is the change
      that starts paying creators at all, not just the change that delays them.
- [ ] Check whether any creator is holding an unpaid Stripe balance from before this
      change, and make sure it releases rather than sitting behind the new schedule.
- [ ] Surface the hold in creator payout settings: balance, when it releases, and
      what is still held.
- [ ] Disclose the hold in Fee Schedule §5 and the Creator Terms **before** it ships.
- [ ] Playbook: new issues in `payments/connect-onboarding.md` for "my money has not
      arrived" — which will be the most common creator ticket this creates.

**Charge traceability**

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
- [ ] Cascade the request per §6.5.
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

**Platform-funded refunds (§6.4)**

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
      instalment, **capped at 50% of the base payment** (§6.5), respecting
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
      currencies stated, the monthly fee minimum and instalment floors added, the
      payout hold and the recovery obligation disclosed, tips and contributions
      described as the shipping feature they now are.
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
