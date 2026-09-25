---
feature: payments/checkout
status: active
surfaces:
  - api/server.js:1791     # POST /api/stripe/checkout/session
  - api/server.js:1907     # GET  /api/stripe/checkout/session-status
  - api/server.js:1156     # assertCheckoutPaymentCanBeOpened
  - api/server.js:1181     # assertCheckoutPoliciesAccepted
  - api/server.js:1065     # CHECKOUT_OPENABLE_PAYMENT_STATUSES
  - api/policyVersions.js                                  # required policy versions, mirrors the TS client
  - api/policyAcceptanceGuard.js                            # pure missing-policy logic
  - public.listing_request_payments
  - public.policy_acceptances
  - supabase/migrations/20260921_117_per_user_fee_rates_and_no_minimums.sql
  - public.resolve_listing_request_fee_rates                # where a rate is decided
  - src/pages/payments/ListingRequestPaymentCheckout.tsx   # fee disclosure
  - src/domain/payments/listingRequestPaymentDisplay.ts    # describeBuyerServiceFee
  - src/domain/tests/checkoutPolicyVersionsSync.test.ts    # keeps api/policyVersions.js honest
unmatched_tier: 2
---

# Checkout — Support Playbook

Checkout is where a buyer actually pays. Made for Stream uses **direct charges on the
creator's connected account** with an application fee, so the money lands in the
creator's Stripe account and Made for Stream takes its cut from the same charge.

Two consequences that shape everything in this playbook:

- A checkout cannot open unless the **creator's** Stripe account is ready. Most
  checkout failures are actually creator-onboarding failures wearing a buyer's
  error message.
- The charge belongs to the connected account, not to Made for Stream. Looking for it
  in the platform dashboard will find nothing — it has to be looked up on the
  creator's account.

## Quick triage

| Symptom the user reports | Likely issue |
| --- | --- |
| "It says the creator can't accept payments" | [`PAY-003`](#pay-003--creator-cannot-accept-payments-yet) |
| "The pay button does nothing / errors" | [`PAY-002`](#pay-002--payment-is-not-in-an-openable-state), [`PAY-003`](#pay-003--creator-cannot-accept-payments-yet) |
| "I paid, it's still asking me to pay" | [`PAY-005`](#pay-005--payment-stuck-in-checkout_opened-or-processing) |
| "I was charged twice" | [`PAY-006`](#pay-006--buyer-reports-a-duplicate-charge) |
| "The fee is more than 5%" | [`PAY-008`](#pay-008--buyer-questions-the-service-fee) |
| "Checkout won't open, says I need to accept something" | [`PAY-009`](#pay-009--checkout-refused-for-an-unaccepted-or-outdated-policy) |
| "It says I'm not the buyer" | [`PAY-001`](#pay-001--wrong-user-attempting-checkout) |
| "It asks for my billing country" / "Why is there a tax line?" | [`TAX-001`](tax.md#tax-001--checkout-refused-at-the-tax-step), [`TAX-006`](tax.md#tax-006--buyer-questions-the-tax-on-a-payment) — Sprint 7 tax step, see [`tax.md`](tax.md) |

---

## `PAY-001` — Wrong user attempting checkout

```yaml
id: PAY-001
tier: 2
signals:
  - source: api
    match: "Only the buyer for this payment can open checkout."
    where: api/server.js:1155
auto_fix: none
reason_not_automatable: "authorization boundary; volume indicates probing"
escalate_if:
  - "3 or more occurrences from one user in 15m"       # -> tier 3
  - "one user hitting payments across multiple requests" # -> tier 3
escalate_with:
  - "requesting user id, payment id, and the payment's actual payer_user_id"
  - "count of similar attempts from the same user"
```

**Cause.** Usually innocent: a creator or admin clicked a buyer-only pay link, or
someone is signed into the wrong account. The check compares the authenticated
user against `payer_user_id` and refuses.

**What the user sees.** An error telling them only the buyer can pay.

**Fix.** Confirm who they are signed in as. No code fix needed for the innocent
case.

**Why it is not Tier 1.** In isolation it is noise. Repeated, it is someone
walking payment ids to see what they can open — which is why the escalation
gathers attempt counts rather than treating each one in isolation.

**Money impact.** None. The check fails before Stripe is contacted.

---

## `PAY-002` — Payment is not in an openable state

```yaml
id: PAY-002
tier: 2
signals:
  - source: api
    match: "This payment is not available for checkout."
    where: api/server.js:1159
auto_fix: none
reason_not_automatable: "correct behaviour for an already-settled payment; the question is why the UI offered it"
escalate_with:
  - "payment id, current status, paid_at"
  - "whether the request workflow shows the payment as outstanding"
```

**Cause.** Checkout may only open for `requires_checkout`, `checkout_opened`,
`failed`, or `cancelled`. Anything else — most often `paid` or `processing` — is
refused.

Seeing this usually means the UI is offering a pay button for a payment that is
already settled, which is a **display bug, not a payment bug**.

**What the user sees.** An error when they try to pay for something they have
often already paid for.

**Fix.** Check the payment's real status first. If it is `paid`, the buyer is
done and the UI is wrong — and the request may also be stuck, which is
[`WHK-002`](webhooks.md#whk-002--payment-marked-paid-but-the-workflow-did-not-advance).

**Money impact.** None, and possibly the opposite — this check is what prevents a
second charge for the same payment.

---

## `PAY-003` — Creator cannot accept payments yet

```yaml
id: PAY-003
tier: 1
signals:
  - source: api
    match: "Creator Stripe account is not ready for payments."
  - source: api
    match: "Creator has not connected Stripe payouts."
auto_fix: resync_connect_account
params:
  user_id: "$.payment.creator_user_id"
verify:
  - "creator_payment_accounts.charges_enabled = true"
retry_limit: 1
escalate_if:
  - "resync confirms the account is genuinely not ready"
  - "the creator has active listings while not ready"    # -> tier 2
```

**Cause.** Two different situations behind one symptom. Either the creator never
finished Stripe onboarding, or they did and **our mirror of their account state
is stale**. Nothing refreshes `creator_payment_accounts` automatically today —
it updates only when the creator opens their settings page and the client calls
the sync endpoint.

The stale case is the common one and it is invisible from the buyer's side.

**What the user sees.** The buyer is told the creator cannot accept payments —
which reads to them as the creator being untrustworthy, so this one costs
goodwill as well as money.

**Fix.** Re-sync the creator's account from Stripe. If they are actually ready,
that fixes it immediately and the buyer can retry.

**If the resync confirms they are not ready**, the creator has to finish
onboarding. That is a real block, not a bug — but a creator who is not ready
should not have had a live listing in the first place. If they do, escalate: the
readiness trigger is being bypassed somewhere. See
[`connect-onboarding.md`](connect-onboarding.md).

**Money impact.** None yet, but this is a blocked sale. The buyer is ready to pay
and cannot.

---

## `PAY-004` — Payment amount or fee setup is invalid

```yaml
id: PAY-004
tier: 2
signals:
  - source: api
    match: "This payment amount is invalid."
  - source: api
    match: "This payment fee setup is invalid."
  - source: db
    match: "Each payment must be at least % %."
  - source: db
    match: "Payment amount % % is too small for the configured Made for Stream fees."
  - source: db
    match: "Payment amount % % is too small for the configured CreatorHub fee minimums."   # pre-117 wording
auto_fix: none
reason_not_automatable: "the record is wrong; correcting money figures is a human decision"
escalate_with:
  - "base_amount_cents, total_checkout_cents, application_fee_cents, currency"
  - "buyer_service_fee_bps and creator_platform_fee_bps, and their minimum_cents columns"
  - "the agreement or milestone amount this was derived from"
```

**Cause — almost always the instalment floor.** Since `20260923_138` the floor
is **10.00** and is enforced much earlier, when the agreement, a schedule item or
a change order is written ([`AGR-005`](../requests/agreements.md#agr-005--a-payment-is-below-the-instalment-floor)).
The **5.00** check here, applied when the payment row is created
(`20260921_117`), is now only a backstop that keeps schedules accepted before
`20260923_138` payable. Reaching it with a new agreement means a schedule item
bypassed the trigger, which is worth escalating.

The message names the amount, so "Each payment must be at least 5.00 CAD" needs
no investigation: the agreement or milestone amount is too small and has to
change, which is a conversation between buyer and creator.

**The fee-setup variant is now near-impossible.** Fees are a flat 5% each side
with no minimums, so the application fee is 10% of base against a total of 105%
of base and cannot exceed it. That check survives as a backstop against a future
rate change that forgets it — if it ever fires, a **rate** is wrong, not an
amount.

**Older payments read differently.** Anything created before `20260921_117`
carries the fee minimums that applied then, and the older error wording. Check
the payment's own `buyer_service_fee_minimum_cents` and
`creator_platform_fee_minimum_cents` rather than assuming today's rules.

**What the user sees.** A generic failure when opening checkout.

**Fix.** Manual. The agreement or milestone amount needs to change, which is a
conversation between buyer and creator — not something to patch in the database.

**Money impact.** None charged. The project is blocked at this payment.

**Currencies.** Payments can only be in a currency enabled in
`public.supported_currencies` (`20260923_138`): CAD, USD and the two-decimal
wave 2 majors. The API refuses any other at checkout with
[`AGR-006`](../requests/agreements.md#agr-006--the-projects-currency-is-not-supported)'s
message. The bridge still converts with `round(amount * 100)`, which is why zero-
and three-decimal currencies (JPY, KWD) are refused outright: in JPY it would
overstate an amount a hundredfold. Enabling one needs the exponent work in
[`../../launch-scope.md`](../../launch-scope.md) §1.1 first.

---

## `PAY-005` — Payment stuck in `checkout_opened` or `processing`

```yaml
id: PAY-005
tier: 1
signals:
  - source: db
    where: public.listing_request_payments
    match: "status IN ('checkout_opened','processing') AND updated_at < now() - interval '30 minutes'"
auto_fix: reconcile_checkout_session
params:
  listing_request_payment_id: "$.id"
verify:
  - "payment.status is terminal and matches Stripe"
retry_limit: 1
escalate_if:
  - "any of the four cross-checks fails"                 # -> tier 3
  - "Stripe has no session for the stored session id"
  - "the session is still genuinely open"                # not stuck; leave it
```

**Cause.** Either the buyer opened checkout and walked away (normal, and it will
expire on its own), or they completed payment and the webhook never arrived
(not normal — see [`WHK-003`](webhooks.md#whk-003--webhook-delivery-has-stopped)).

`processing` specifically means a delayed payment method; those legitimately
take days and should not be treated as stuck.

**What the user sees.** If they abandoned it, nothing. If they paid, they see a
request still asking for payment they have already made — which reliably
produces an angry message.

**Fix.** Read the session from Stripe and reconcile our record to it, through
the same cross-checks the webhook uses.

**If any cross-check fails**, stop. A mismatch between our record and Stripe on
amount, currency, or account is [`WHK-005`](webhooks.md#whk-005--event-identity-does-not-match-the-payment)
and is a security matter, not a stuck payment.

**Money impact.** Possibly captured and unrecorded. Until reconciled, we do not
know whether this buyer has paid.

---

## `PAY-006` — Buyer reports a duplicate charge

```yaml
id: PAY-006
tier: 2
signals:
  - source: user_report
    match: "buyer reports being charged more than once"
  - source: stripe
    match: "multiple succeeded PaymentIntents for one listing_request_payment id"
auto_fix: none
reason_not_automatable: "resolution requires a refund, which the agent may never issue"
escalate_if:
  - "more than one buyer affected"                        # -> tier 3
escalate_with:
  - "every Stripe session and PaymentIntent for the payment id"
  - "the payment's stripe_event_ids array"
  - "amounts and timestamps of each charge"
```

**Cause.** Should be prevented. Reopening checkout for the same payment reuses a
still-open Stripe session, and session creation uses an idempotency key derived
from the payment id and its `updated_at`. A genuine duplicate means one of those
guards did not hold — which is worth finding rather than just refunding.

**What the user sees.** Two charges on their statement.

**Fix.** Manual, and it requires a refund. **The agent may not issue refunds**,
and Made for Stream has no refund workflow yet at all — see
[`refunds-and-disputes.md`](refunds-and-disputes.md). Today this is done by hand
in the creator's Stripe account, and the Made for Stream record will not reflect it.

**Money impact.** Direct and immediate. The buyer has paid twice. Treat this as
the highest-urgency Tier 2 there is — trust damage here is disproportionate.

---

## `PAY-007` — Session or authorization failure

```yaml
id: PAY-007
tier: 2
signals:
  - source: api
    match: "Missing Authorization bearer token"
  - source: api
    match: "Invalid session"
auto_fix: none
reason_not_automatable: "usually a client-side auth problem, not a payment problem"
escalate_if:
  - "occurring at volume across users"                    # -> tier 3
```

**Cause.** The buyer's Supabase session expired or was not attached to the
request. The API returns 401 for these.

**What the user sees.** A failure to open checkout, often after leaving the page
open a long time.

**Fix.** Sign out and back in. See [`auth/sign-in.md`](../auth/sign-in.md).

**Money impact.** None.

---

## `PAY-008` — Buyer questions the service fee

```yaml
id: PAY-008
tier: 2
signals:
  - source: user_report
    match: "buyer asks why the fee is more than 5%"
  - source: user_report
    match: "buyer says the total does not match the agreed price"
auto_fix: none
reason_not_automatable: "explanation, not a fault; a genuine mismatch is PAY-004"
escalate_with:
  - "base_amount_cents, buyer_service_fee_cents, buyer_service_fee_bps and buyer_service_fee_minimum_cents on the payment"
```

**Cause.** Since `20260921_117` there are **no fee minimums** — the buyer fee is
a flat 5% of the base, every time. A buyer seeing more than 5% is either looking
at a payment created before that migration, or adding the creator's fee to their
own. The creator's 5% comes out of the creator's proceeds and is **not** added to
the buyer's total; the checkout note says so in place.

**Check the payment's own stored `buyer_service_fee_bps`**, not an assumed 5%.
The rate is a per-payment snapshot and will vary per buyer once subscriptions
land (`launch-scope.md` §3.5). `buyer_service_fee_reason` records why that rate
applied — `standard`, `subscription`, `promotional` or `goodwill`.

**A zero fee is not a bug** if the reason is anything other than `standard`. It
is a waiver, and the checkout note renders it as "waived on this payment" rather
than "0%".

**Payments created before `20260921_117`** carry a non-zero
`buyer_service_fee_minimum_cents`, and the minimum may be what they were charged.
`describeBuyerServiceFee` still explains those correctly — it reads the row
rather than assuming today's rules.

**If the figures do not reconcile**, it is not this issue — see
[`PAY-004`](#pay-004--payment-amount-or-fee-setup-is-invalid).

**Money impact.** None. The charge is correct; the expectation was not set.

---

## `PAY-009` — Checkout refused for an unaccepted or outdated policy

```yaml
id: PAY-009
tier: 2
signals:
  - source: api
    match: "You must accept the current"
    where: api/server.js, assertCheckoutPoliciesAccepted
escalate_if:
  - "the buyer reports having already ticked every box on the checkout page" # -> tier 3, client/server disagreement
auto_fix: none
reason_not_automatable: "the buyer must actually accept the named policy; nobody may accept on their behalf"
escalate_with:
  - "the payment id, listing_request_id and payer_user_id"
  - "the policy types named in the error message"
  - "the buyer's current rows in policy_acceptances for this listing request"
```

**Cause.** `assertCheckoutPoliciesAccepted` checks `policy_acceptances` for the
buyer, scoped to this listing request, for every policy `api/policyVersions.js`
requires — currently `refund`, `payment_terms` and `early_service_request` — at
their exact current version. Since `20260923_138` the `early_service_request` row
is first written when the buyer accepts the agreement
([`AGR-007`](../requests/agreements.md#agr-007--acceptance-refused-without-the-early-start-request)),
so checkout shows that box again only if the Refund Policy version changed
since. **Every policy was re-versioned on 2026-09-23/24 (Sprint 8)**, so every
buyer with a project in flight re-accepts all three at their next checkout.
That is expected, not this issue. It runs on **every** call to
`POST /api/stripe/checkout/session`, including a reused session, because an
acceptance of an older version does not satisfy a newer one.

**What the user sees.** Checkout fails to open, naming which policy is missing
or outdated in the error message.

**The ordinary case is not a bug.** `CheckoutPolicyAcceptance.tsx` records
acceptance before ever calling this endpoint, so this should only fire for a
client that is stale, out of sync, or was bypassed — the API is now the real
boundary here, exactly as `AGENTS.md` requires, so a client that skips the
checkbox no longer gets through.

**If the buyer insists they already accepted**, check
`policy_acceptances` directly for that `user_id` and
`related_listing_request_id`: either the row is missing (client silently
failed to record it — see `logPolicyAcceptanceFailure` in
`usePolicyAcceptances.ts`), or a policy version was bumped after they accepted
an earlier one and the client has not re-prompted them yet. The second case is
a genuine client bug and should escalate.

**Fix.** For a missing or stale acceptance, the buyer accepts again — nobody
may record it on their behalf, for the same reason as `AGR-003`: the record is
the evidence that the buyer agreed, and one they did not personally make is
worse than no record at all.

**Money impact.** None. This fires before Stripe is contacted.

---

## Known gaps

- **No refund path exists.** `PAY-006` has no clean resolution inside
  Made for Stream. This is a launch blocker, tracked in
  [`refunds-and-disputes.md`](refunds-and-disputes.md).
- **`stripe_charge_id` is never stored**, so finding the charge for a given
  payment means searching the connected account by metadata rather than looking
  it up directly. Every manual fix in this playbook is slower because of it.
- **No alerting on stuck payments.** `PAY-005` describes the query but nothing
  runs it on a schedule yet.
- **Non-USD currencies are unvalidated** end to end — see the note in `PAY-004`.
- `one_time` is a valid `payment_type` in the schema with no workflow behind it.
  If one ever appears in production, it is unhandled and falls through to Tier 2.

## Audit note: `revoke ... from public` does not lock a function down on Supabase

`20260921_117` introduced two new internal helper functions and revoked their
`EXECUTE` privilege "from public", following the pattern already used
elsewhere in this codebase — including the pre-existing
`ensure_listing_request_payment_for_schedule_item`. **That pattern does not
work on Supabase.** The `anon` and `authenticated` roles are granted `EXECUTE`
on new `public`-schema functions independently of the `PUBLIC` pseudo-role, so
`revoke ... from public` leaves both roles able to call the function directly
over PostgREST RPC.

Confirmed live against `information_schema.role_routine_grants`: `anon` had
`EXECUTE` on `resolve_listing_request_fee_rates`,
`lock_listing_request_agreement_fee_rates`, and
`ensure_listing_request_payment_for_schedule_item` after `117` was applied,
including the pre-existing function that `117` only rewrote the body of.
Fixed in `20260921_118_lock_down_fee_rpc_execute_grants.sql`, which revokes
`EXECUTE` from `anon` and `authenticated` explicitly on all three. Verified
the trigger-driven payment-creation flow is unaffected — every call path runs
through `security definer` functions that execute as their owner regardless
of who fired the triggering statement.

**Follow-up audit (2026-09-22).** Every `security definer` function across
`supabase/migrations/*.sql` was checked against
`information_schema.role_routine_grants` on the live project. Functions with
an explicit `grant execute ... to authenticated` after their creation (the
`has_ready_creator_payment_account` pattern) are intentionally client-callable
and were left alone. Twenty-two internal helpers were confirmed to have
`EXECUTE` live on `anon`/`authenticated` with no explicit grant-back and no
client `.rpc()` call site anywhere in `src/`:

`capture_listing_revision`, `close_conversation_when_listing_request_completed`,
`close_conversation_when_listing_request_declined`,
`complete_listing_request_after_final_delivery_approval`,
`create_conversation_for_listing_request`,
`create_listing_request_change_order_payment`,
`create_listing_request_milestone_from_payment`,
`create_listing_request_payments_when_agreement_accepted`,
`enforce_final_delivery_approval_milestone_payments`,
`enforce_final_delivery_milestone_payments`,
`enforce_listing_payment_account_readiness`,
`enforce_listing_request_milestone_buyer_response_sequence`,
`enforce_listing_request_milestone_payment_sequence`,
`enforce_listing_request_milestone_submission_sequence`,
`handle_conversation_message_insert`,
`log_listing_request_agreement_conversation_event`,
`log_listing_request_status_change`,
`refresh_listing_request_agreement_adjusted_completion`,
`refresh_listing_request_agreement_progress_schedule`,
`set_listing_request_archive_metadata`,
`sync_listing_request_agreement_progress_schedule`, and
`sync_listing_request_progress_update_schedule`.

All but one are `returns trigger` functions bound to exactly one trigger, so a
direct call is inert regardless of grants (Postgres refuses to run a trigger
function outside real trigger context) — revoking them is hygiene, same as
`lock_listing_request_agreement_fee_rates` in `118`. The exception,
`refresh_listing_request_agreement_progress_schedule(uuid)`, is a real gap: an
ordinary function that unconditionally overwrites the progress-update schedule
columns for whatever `agreement_id` it's given. Left exposed, any caller could
force-recompute (and in some branches null out) another buyer/creator's
schedule. It's called only from two of the trigger functions above and a
one-time backfill, never from a client.

A 23rd function, `protect_listing_request_completion` (trigger
`listing_requests_protect_completion` on `listing_requests`), was found live
with the same gap but **has no corresponding migration file anywhere in this
repo** — schema drift that predates this audit, not introduced by it. It was
included in the fix since it matches the same exposed/internal-only pattern,
but the drift itself is unresolved: something applied this function directly
against the project outside the migration history and it should be
reconciled (e.g. backfilled as its own migration) separately from this fix.

Fixed in `20260922_119_lock_down_internal_trigger_execute_grants.sql`, which
revokes `EXECUTE` from `anon` and `authenticated` (and, where still present,
`public`) on all 23. Re-verified against `information_schema.role_routine_grants`
that none of the three roles retain `EXECUTE`. Re-verified the payment-creation
trigger chain still works end to end: inserting a `payment_required` schedule
item on a real `buyer_accepted` agreement still produces a
`listing_request_payments` row (`starting_payment`, `requires_checkout`,
correct fee math), tested in a transaction that was rolled back.
