---
feature: payments/webhooks
status: active
surfaces:
  - api/server.js:150      # POST /api/stripe/webhook
  - api/server.js:841      # processStripeWebhookEvent
  - api/server.js:637      # markListingRequestPaymentPaidFromCheckoutSession
  - public.stripe_webhook_events
  - public.listing_request_payments
unmatched_tier: 2
---

# Stripe Webhooks — Support Playbook

Webhooks are how CreatorHub learns that money moved. Everything downstream —
a request advancing past its payment gate, a milestone unlocking, a final
delivery becoming allowed — happens because a webhook was processed.

When webhooks stop, the product does not visibly break. Buyers pay successfully,
Stripe is happy, and the request simply never advances. That silence is the
dangerous part: **a webhook outage looks like nothing is wrong.**

Every event is recorded in `stripe_webhook_events` with its full payload before
processing. That table is both the audit trail and the replay queue, and it is
what makes most failures here recoverable.

## Quick triage

| Symptom the user reports | Likely issue |
| --- | --- |
| "I paid but the project hasn't moved" | [`WHK-001`](#whk-001--transient-failure-processing-a-received-event), [`WHK-002`](#whk-002--payment-marked-paid-but-the-workflow-did-not-advance) |
| Several buyers report the same, at once | [`WHK-003`](#whk-003--webhook-delivery-has-stopped) |
| Nothing reported, but payments look stuck | [`WHK-003`](#whk-003--webhook-delivery-has-stopped) |

---

## `WHK-001` — Transient failure processing a received event

```yaml
id: WHK-001
tier: 1
signals:
  - source: db
    where: public.stripe_webhook_events
    match: "processing_status = 'failed'"
    error_message: "/fetch failed|ECONNRESET|ETIMEDOUT|socket hang up|503|502|timeout|Service Unavailable/i"
auto_fix: replay_webhook_event
params:
  stripe_event_id: "$.stripe_event_id"
verify:
  - "stripe_webhook_events.processing_status = 'processed'"
retry_limit: 2
escalate_if:
  - "still failed after 2 replays"
  - "error_message changes between attempts"
  - "3 or more distinct users affected in 15m"   # -> tier 3
```

**Cause.** Supabase was briefly unreachable while the handler was writing. The
Stripe event itself is fine and fully stored — only our write failed.

**What the user sees.** A successful payment, and a request that has not
advanced. No error on their side at all.

**Fix.** Replay the stored payload. This re-runs the same handler with the same
cross-checks. It is safe to repeat: the payment records each event id it has
applied, and a payment already marked `paid` skips straight to re-running the
downstream cascade.

**If the fix does not work.** If two replays fail with the same transient
signature, Supabase is not briefly down — it is down. Check the project status
before escalating, and include that in the package.

**Money impact.** None at risk. The charge succeeded on the connected account.
The money is where it should be; only our record of it lags.

---

## `WHK-002` — Payment marked paid but the workflow did not advance

```yaml
id: WHK-002
tier: 1
signals:
  - source: db
    where: public.listing_request_payments
    match: "status = 'paid' AND paid_at < now() - interval '10 minutes'"
    and: "the request stage still sits behind this payment gate"
auto_fix: reapply_payment_workflow
params:
  listing_request_payment_id: "$.id"
verify:
  - "the request workflow state has advanced past the payment gate"
retry_limit: 2
escalate_if:
  - "the cascade RPC raises a sequence-guard or constraint error"  # -> tier 3
  - "still not advanced after 2 attempts"
```

**Cause.** The payment write succeeded but the downstream cascade RPC did not.
The handler writes `status = 'paid'` and then calls
`applyPaidListingRequestPaymentWorkflow` as a separate step, so a failure
between the two leaves exactly this state. It is an anticipated case — the paid
path already re-runs the cascade when it sees a payment that is already paid.

**What the user sees.** The payment shows as complete, but the next step of the
project never unlocks. Buyer and creator both see a request that will not move.

**Fix.** Re-run the cascade. The RPCs are no-ops when the stage has already
advanced, so this cannot double-apply.

**If the fix does not work.** A cascade that fails on a *sequence guard* is not
this issue — it means the workflow is in a state the guards consider
inconsistent (for example a milestone paid out of order). That is a data
integrity problem, Tier 3, and must not be retried.

**Money impact.** None at risk, but the project is frozen. Both parties are
blocked, so this is worth resolving quickly even though nothing is lost.

---

## `WHK-003` — Webhook delivery has stopped

```yaml
id: WHK-003
tier: 3
signals:
  - source: db
    where: public.stripe_webhook_events
    match: "no rows inserted for 15 minutes during active hours"
  - source: stripe
    match: "endpoint showing repeated delivery failures"
auto_fix: none
reason_not_automatable: "cause is upstream of the agent; impact is all payments"
escalate_with:
  - "count of Stripe events pending delivery"
  - "API health check result"
  - "last successfully processed event id and timestamp"
  - "list of payments in checkout_opened or processing, with amounts"
```

**Cause.** Several possibilities, and the escalation should distinguish them:
the API is down; the endpoint URL or signing secret is wrong after a config
change; Stripe has disabled the endpoint after repeated failures; or a network
path is broken.

**What the user sees.** Nothing. Payments keep succeeding, nothing advances.
This is the failure mode that generates support tickets hours late.

**Fix.** Manual. Restore delivery first, then replay the backlog — Stripe retries
for roughly three days, so a backlog is usually recoverable in full.

**Do not** make the endpoint return 200 to clear the error. Returning a non-2xx
keeps events queued at Stripe; returning 200 to a request we did not process
discards them permanently.

**Money impact.** Everything in flight. Charges are succeeding and being
recorded nowhere. The longer it runs the larger the reconciliation.

---

## `WHK-004` — Event references a payment we do not have

```yaml
id: WHK-004
tier: 2
signals:
  - source: api
    match: "Stripe checkout session is missing CreatorHub payment metadata."
  - source: api
    match: "Payment record was not found."
auto_fix: none
reason_not_automatable: "an event we cannot attribute may not be ours"
escalate_with:
  - "the full stored payload"
  - "the connected account id from event.account"
  - "whether the referenced payment id exists in any form"
```

**Cause.** Either a session was created outside the normal path and carries no
`client_reference_id`, or the payment row was deleted, or the event belongs to a
different system pointed at this endpoint.

**Fix.** Manual investigation. Do not create a payment record to make the event
fit — that fabricates a financial record.

**Money impact.** Unknown, which is why it is Tier 2. A real charge may exist
with no corresponding record.

---

## `WHK-005` — Event identity does not match the payment

```yaml
id: WHK-005
tier: 3
signals:
  - source: api
    match: "Stripe connected account does not match this payment."
  - source: api
    match: "Stripe checkout session amount does not match this payment."
  - source: api
    match: "Stripe checkout session currency does not match this payment."
  - source: api
    match: "This payment is linked to a different Stripe account."
auto_fix: none
reason_not_automatable: "security signal"
escalate_with:
  - "expected vs received values for every cross-check"
  - "the full payload and event.account"
  - "every other event from the same connected account in the window"
```

**Cause.** One of the four cross-checks in the paid path rejected the event. In
normal operation these never fire. A hit means either a real bug in how sessions
are created, or an event that is not what it claims to be.

**Fix.** None automated, by design. The check already did its job by refusing to
write. Investigate before changing anything.

**Money impact.** Potentially severe and possibly adversarial. Treat as a
security incident until shown otherwise.

---

## `WHK-006` — Signature verification failed

```yaml
id: WHK-006
tier: 3
signals:
  - source: api
    match: "/No signatures found matching the expected signature|Unable to extract timestamp|webhook signature/i"
auto_fix: none
reason_not_automatable: "security signal"
escalate_with:
  - "source IP"
  - "request count in the window"
  - "whether STRIPE_WEBHOOK_SECRET was recently changed"
```

**Cause.** Most often benign: the signing secret does not match the endpoint,
usually right after a config change or a `dev`/`prod` mode mixup. The other
possibility is someone posting forged events.

Distinguish them by volume and timing. One burst immediately after a deploy is
almost certainly configuration. A steady trickle from an unfamiliar source is
not.

**Fix.** Manual. Confirm `STRIPE_KEY_MODE` and the matching
`STRIPE_WEBHOOK_SECRET_DEV` / `_PROD` first.

**Money impact.** None directly — nothing unsigned is ever processed. But if it
is a config error, real events are being rejected, which becomes `WHK-003`.

---

## `WHK-007` — Event received and ignored

```yaml
id: WHK-007
tier: 1
signals:
  - source: db
    where: public.stripe_webhook_events
    match: "processing_status = 'ignored'"
auto_fix: none
action: log_only
escalate_if:
  - "an ignored event type exceeds 20 occurrences in 24h"
```

**Cause.** `processStripeWebhookEvent` handles four event types and returns
`"ignored"` for everything else. This is normal — Stripe sends plenty we do not
need.

**Fix.** None needed. It is recorded for the audit trail.

**Why it is still worth watching.** A *new* event type arriving in volume means
either Stripe changed something or someone subscribed the endpoint to events we
do not handle. Notably, `charge.refunded` and `charge.dispute.created` currently
land here — see [`refunds-and-disputes.md`](refunds-and-disputes.md).

**Money impact.** None today. But see the gap below.

---

## Known gaps

- **Refunds and disputes are not processed.** `charge.refunded`,
  `charge.dispute.created` and `charge.dispute.closed` all fall through to
  `"ignored"` at `WHK-007`. The schema supports these states; no code writes
  them. Documented in [`refunds-and-disputes.md`](refunds-and-disputes.md).
- **Connect account changes are not processed.** `account.updated` is ignored.
  See [`connect-onboarding.md`](connect-onboarding.md) `CON-003`.
- **`stripe_charge_id` and `stripe_application_fee_id` are never populated.**
  Both columns exist and stay null. They are the handles needed to issue a refund
  or reconcile a payout, so this blocks the refund work.
- There is no alert on webhook silence. `WHK-003` describes the signal but
  nothing currently watches for it. This needs to exist before launch.
