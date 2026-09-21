---
feature: payments/checkout
status: active
surfaces:
  - api/server.js:1755     # POST /api/stripe/checkout/session
  - api/server.js:1870     # GET  /api/stripe/checkout/session-status
  - api/server.js:1153     # assertCheckoutPaymentCanBeOpened
  - api/server.js:1062     # CHECKOUT_OPENABLE_PAYMENT_STATUSES
  - public.listing_request_payments
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
| "It says I'm not the buyer" | [`PAY-001`](#pay-001--wrong-user-attempting-checkout) |

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
    match: "Payment amount % % is too small for the configured CreatorHub fee minimums."
auto_fix: none
reason_not_automatable: "the record is wrong; correcting money figures is a human decision"
escalate_with:
  - "base_amount_cents, total_checkout_cents, application_fee_cents, currency"
  - "the agreement or milestone amount this was derived from"
```

**Cause.** The application fee is greater than or equal to the total charge,
which Stripe rejects for direct charges. With a 5%/$1.00 buyer fee and a
5%/$1.50 creator fee, the combined minimum is $2.50, so any base amount under
roughly $2.50 cannot work.

The schedule-to-payment bridge already refuses to create such a payment, so
seeing this at checkout means a payment was created before that guard existed,
or by another path.

**What the user sees.** A generic failure when opening checkout.

**Fix.** Manual. The agreement or milestone amount needs to change, which is a
conversation between buyer and creator — not something to patch in the database.

**Money impact.** None charged. The project is blocked at this payment.

**Note for non-CAD/USD work.** These minimums are **minor-unit** integers — `100`
and `150` — applied to whatever currency the payment carries. That is correct for
CAD and USD, which is why both work today and why the fee schedule can name each
separately. It is wrong for any currency with a different minor-unit convention: in
JPY those are ¥100 and ¥150, and the bridge's `round(amount * 100)` conversion
overstates a JPY amount by a hundredfold. Stripe's own minimum charge also differs
per currency.

Do not enable another currency without working through that. The plan for doing so
is the currency registry in
[`../../launch-scope.md`](../../launch-scope.md) §1.1.

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
