---
feature: payments/refunds-and-disputes
status: not-implemented
surfaces:
  - public.listing_request_payments   # statuses and columns exist, nothing writes them
  - api/server.js:841                 # processStripeWebhookEvent — no refund/dispute branches
unmatched_tier: 2
---

# Refunds and Disputes — Support Playbook

> **This feature does not exist yet.** This playbook documents a gap, not a
> working system. It is written now so that the failures it describes are
> escalated correctly in the meantime, and so that the refund work has a
> specification to satisfy.

## What exists and what does not

**The database is ready.** `listing_request_payments` already has
`refunded`, `partially_refunded` and `disputed` statuses in its check
constraint, plus `stripe_refund_id`, `stripe_dispute_id`, `refunded_at` and
`disputed_at` columns.

**Nothing writes any of them.** There is no RPC, no API route, and no webhook
branch. `charge.refunded`, `charge.dispute.created` and `charge.dispute.closed`
all fall through `processStripeWebhookEvent` and are recorded as `ignored`.

**Two columns needed to do this work are also never populated:**
`stripe_charge_id` and `stripe_application_fee_id`. A refund is issued against a
charge, so without the charge id every refund starts with a search through the
connected account.

## What this means operationally, today

A refund issued by hand in the Stripe dashboard **does not appear in
Made for Stream at all**. The payment continues to read `paid`. The request continues
to behave as though the money is there. The buyer has been refunded and the
system still thinks they paid.

That divergence is the real risk here — not the missing button. Every manual
refund silently makes our records wrong, and nothing detects it.

**The same is true for disputes.** A buyer who disputes a charge with their bank
triggers a Stripe dispute against the *creator's* connected account. Made for Stream
learns nothing. The creator may lose the money and the disputed amount plus a
fee, while the project continues as though everything is settled.

## Rules until this is built

- **The agent may never write a refund or dispute status.** It is on the
  forbidden list in [`agent-contract.md`](../agent-contract.md), and it stays
  there until there is a sanctioned write path.
- **The agent may never issue a refund.** Money movement is always human.
- Every refund and dispute is **Tier 2 minimum**, and Tier 3 if more than one
  buyer is involved.
- Record every manual refund somewhere durable outside the app, because the app
  will not record it. Without that, reconciliation later is guesswork.

---

## `REF-001` — Refund requested by a buyer

```yaml
id: REF-001
tier: 2
signals:
  - source: user_report
    match: "buyer requests a refund"
auto_fix: none
reason_not_automatable: "no refund workflow exists; money movement is always human"
escalate_with:
  - "payment id, amount, currency, payment_type"
  - "the request's current workflow stage and what was delivered"
  - "the creator's connected account id"
  - "whether the work is partially complete"
```

**Cause.** Cancellation, dissatisfaction, non-delivery, or mutual agreement.

**Fix.** Entirely manual, on the creator's connected account. Because these are
direct charges, the refund comes out of the creator's balance — this is a
conversation with the creator, not a unilateral platform action.

**These now have a policy** — Refund Policy §8, with the arithmetic in
[`../../launch-scope.md`](../../launch-scope.md) §6.2. Apply it rather than deciding
case by case:

- **Buyer service fee** — refunded in the same proportion as the base.
- **Creator platform fee** — reversed in the same proportion. Made for Stream
  absorbs this; it does not come back automatically and has to be reversed
  deliberately.
- **Partial delivery** — earned value per Refund Policy §4: a completed conforming
  milestone keeps its price, a partial one keeps only the documented value of
  conforming work actually made available.
- Minimums are **not** recalculated on the remaining balance, and there is no refund
  administration fee.
- For repeated partial refunds, compute the **cumulative** proportional fee refund
  and subtract what has already been returned, so rounding cannot exceed the
  original fee.

**What is still missing is the implementation**, not the policy. Record every manual
refund durably outside the app until it exists.

**Money impact.** Direct. And the Made for Stream record will be wrong afterwards
until this feature exists.

---

## `REF-002` — Refund issued in Stripe, not reflected in Made for Stream

```yaml
id: REF-002
tier: 2
signals:
  - source: db
    where: public.stripe_webhook_events
    match: "event_type = 'charge.refunded' AND processing_status = 'ignored'"
auto_fix: none
reason_not_automatable: "no sanctioned write path for refund status"
escalate_with:
  - "the refund amount and whether it was full or partial"
  - "the Made for Stream payment it corresponds to"
  - "the request's current stage"
```

**Cause.** Someone refunded in Stripe. The event arrived, was stored, and was
ignored.

**Detection.** The `ignored` row is the only trace. This is the one query worth
running regularly before the feature lands:

```sql
select stripe_event_id, event_type, created_at, payload -> 'data' -> 'object' ->> 'id'
from public.stripe_webhook_events
where event_type in ('charge.refunded', 'charge.dispute.created', 'charge.dispute.closed')
  and processing_status = 'ignored'
order by created_at desc;
```

**Fix.** Manual reconciliation. Note what the record *should* say; do not write
it by hand, because a hand-written status with no refund id is a worse record
than an honest inconsistency.

**Money impact.** Already moved. The exposure is the wrong record, which affects
what the request lets both parties do next.

---

## `REF-003` — Dispute opened against a creator

```yaml
id: REF-003
tier: 3
signals:
  - source: db
    where: public.stripe_webhook_events
    match: "event_type = 'charge.dispute.created' AND processing_status = 'ignored'"
  - source: stripe
    match: "dispute opened on a connected account"
auto_fix: none
reason_not_automatable: "financial and legal exposure"
escalate_with:
  - "dispute amount, reason code, and evidence deadline"
  - "the full request history: agreement, milestones, deliveries, messages"
  - "whether the creator has other disputes"
```

**Cause.** A buyer went to their bank instead of to us. Often that means the
in-product resolution path failed them, which is worth understanding separately
from the dispute itself.

**Why Tier 3 regardless of count.** Disputes carry deadlines, fees, and
consequences for the creator's account standing. A missed evidence deadline is an
automatic loss. There is no version of this that waits.

**Fix.** Manual and time-critical:

1. Note the evidence deadline immediately. It is short.
2. Gather the record — this is exactly what Made for Stream is for. The agreement,
   the buyer's acceptance, the delivery, the messages. That evidence is the
   product's core value proposition, and a dispute is where it proves out.
3. Tell the creator. It is their account and their money.
4. Decide whether to contest, with the creator.

**Money impact.** The disputed amount plus a dispute fee, debited from the
creator's account. If they lose, they are out both.

---

## `REF-004` — Dispute resolved

```yaml
id: REF-004
tier: 2
signals:
  - source: db
    where: public.stripe_webhook_events
    match: "event_type = 'charge.dispute.closed' AND processing_status = 'ignored'"
auto_fix: none
reason_not_automatable: "no write path; outcome determines the request's fate"
escalate_with:
  - "the outcome (won/lost) and final amount"
  - "the request's state and whether it should now be cancelled or completed"
```

**Fix.** Manual. The outcome decides what happens to the project, and nothing in
the product reflects it automatically.

---

## What building this feature requires

Recorded here so the work is specified before it starts:

1. **Populate `stripe_charge_id` and `stripe_application_fee_id`** on the
   existing paid path. Everything else depends on having the charge handle.
2. **Handle `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`**
   in `processStripeWebhookEvent`, reusing the existing cross-check and
   `stripe_event_ids` idempotency pattern.
3. **Add `security definer` RPCs** following the `apply_paid_listing_request_*`
   shape, to write refund and dispute state and cascade the request.
4. **Implement the fee policy** in `REF-001` — proportional, cumulative, rounded
   once, minimums never recalculated. Decided in Refund Policy §8 and
   [`../../launch-scope.md`](../../launch-scope.md) §6.2; no longer a blocker.
5. **Decide what a refund does to the request.** Cancelled? Reverted to an
   earlier stage? Milestone-specific refunds need this answered per stage.
6. **Add the first server-side tests.** `api/server.js` has none, and refund
   handling should not be the code that continues that.
7. **Update this playbook** — replace the Tier 2 entries with Tier 1 auto-fixes
   where they qualify, and move the reconciliation query into alerting.

---

## Known gaps

This entire playbook is a known gap. In priority order:

- No refund capability in the product at all.
- No dispute visibility. A creator can lose money and a case without Made for Stream
  ever knowing.
- `stripe_charge_id` / `stripe_application_fee_id` never populated, which blocks
  the rest.
- **The ledger cannot represent a partial refund.** One nullable `stripe_refund_id`,
  one `refunded_at`, no refunded amount and no history — so two partial refunds
  against one payment have nowhere to go. An immutable refund ledger has to land
  with the feature.
- Nothing alerts on the `ignored` refund and dispute events, so the detection
  query above has to be run by hand.

The **fee-refund policy is decided** — Refund Policy §8 and
[`../../launch-scope.md`](../../launch-scope.md) §6 — so "what this feature
requires" below is now a build specification rather than an open question.
