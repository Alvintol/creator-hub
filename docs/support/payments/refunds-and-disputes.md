---
feature: payments/refunds-and-disputes
status: partial
surfaces:
  - public.listing_request_payments                          # stripe_charge_id, stripe_application_fee_id, stripe_refund_id, stripe_dispute_id, refunded_at, disputed_at now populated; status is not
  - api/server.js                                             # markListingRequestPaymentPaidFromCheckoutSession, getChargeDetailsFromPaymentIntent, recordChargeRefundedFromWebhook, recordChargeDisputeCreatedFromWebhook, recordChargeDisputeClosedFromWebhook
  - src/pages/admin/AdminPaymentIssues.tsx                    # /admin/payment-issues
  - src/hooks/admin/useAdminPaymentIssues.ts
unmatched_tier: 2
---

# Refunds and Disputes — Support Playbook

> **No refund or dispute-response capability exists yet — that part of this
> playbook still documents a gap.** What changed (Sprint 3, 2026-09-22): a
> refund or dispute issued in Stripe is no longer invisible to Made for Stream.
> The webhook now records it — the charge id, the refund id, the dispute id,
> and when it happened — directly on the payment row. **The payment's `status`
> column is still not updated by any of this.** A refunded payment still reads
> `paid` in `status`; the new columns are the only place the refund is visible
> until the ledger work below lands. Read status alongside the new columns, not
> instead of them.

## What exists and what does not

**The database is ready.** `listing_request_payments` already has
`refunded`, `partially_refunded` and `disputed` statuses in its check
constraint, plus `stripe_refund_id`, `stripe_dispute_id`, `refunded_at` and
`disputed_at` columns.

**The charge handle is now populated.** `stripe_charge_id` and
`stripe_application_fee_id` are set on the paid path
(`markListingRequestPaymentPaidFromCheckoutSession`), fetched live from the
PaymentIntent's expanded `latest_charge` rather than trusted from the webhook
payload (Stripe does not put either id on the Checkout Session or PaymentIntent
object directly). A payment that reached `paid` before this shipped, and never
got backfilled, is still missing both — see Known gaps.

**`charge.refunded`, `charge.dispute.created` and `charge.dispute.closed` are
now recorded, not ignored.** Each writes the relevant Stripe id and timestamp
onto the payment row it belongs to (matched by `stripe_charge_id`, falling back
to the `creatorhub_payment_id` metadata Stripe copies from the PaymentIntent to
the Charge — the fallback exists because a refund event can arrive before
`checkout.session.completed` has had a chance to record `stripe_charge_id` at
all; Stripe does not guarantee event order). None of the three writes `status`.
That is deliberate, not an oversight: `refunded` / `partially_refunded` are
meant to be *derived* from a real refund ledger (launch-scope.md §6.2), and
writing status directly now from a single nullable `stripe_refund_id` would
build the exact "cannot represent a partial refund" trap that section warns
against. The ledger, the RPCs that write it, and the status derivation are
still Sprint 5 work.

## What this means operationally, today

A refund issued by hand in the Stripe dashboard **is now visible in
Made for Stream**, in `stripe_refund_id` and `refunded_at` on the payment row —
but the payment's `status` still reads `paid`. The request still behaves as
though the money is fully there, because nothing downstream of `status` knows
otherwise yet.

That divergence — a payment provably refunded per its own columns, while
`status = 'paid'` and the workflow keeps treating it that way — is now the
actual risk, replacing the older "no trace at all" one. It is smaller (there is
a real, queryable trace) but not gone.

**The same is true for disputes**, now via `stripe_dispute_id` and
`disputed_at`. A dispute opened against the creator's connected account is
recorded on the payment; the project workflow still runs as though nothing
happened, because closing collection or freezing work on a disputed payment is
also Sprint 5 scope (launch-scope.md §13, "Dispute opened").

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
    where: public.listing_request_payments
    match: "stripe_refund_id is not null AND status = 'paid'"
auto_fix: none
reason_not_automatable: "no sanctioned write path for refund status yet"
escalate_with:
  - "the refund amount and whether it was full or partial (read from Stripe using stripe_charge_id)"
  - "the Made for Stream payment it corresponds to"
  - "the request's current stage"
```

**Cause.** Someone refunded in Stripe. The webhook now records `stripe_refund_id`
and `refunded_at` on the payment (Sprint 3, 2026-09-22) — `status` is not
written by that path, so it still reads `paid`.

**Detection.** Check `/admin/payment-issues` (filter: Refunded) first — it's
the same query below as a page. Direct SQL, for anything the UI doesn't show:

```sql
select id, listing_request_id, payment_type, status,
       stripe_charge_id, stripe_refund_id, refunded_at
from public.listing_request_payments
where stripe_refund_id is not null
  and status = 'paid'
order by refunded_at desc;
```

A payment that reached `paid` **before** this shipped and was refunded before
that has no `stripe_charge_id` to match against, so it will not show up here —
see Known gaps.

**Fix.** Manual reconciliation of `status` and whatever the request workflow
should do next. Do not hand-write `status` to `refunded` — that is still the
same "single nullable id, no history" ledger gap launch-scope.md §6.2
describes, so it will not survive a second partial refund on the same payment.
Fix the actual status derivation when the refund ledger (Sprint 5) lands
instead of by hand here.

**Money impact.** Already moved. The exposure is the wrong record, which affects
what the request lets both parties do next.

---

## `REF-003` — Dispute opened against a creator

```yaml
id: REF-003
tier: 3
signals:
  - source: db
    where: public.listing_request_payments
    match: "stripe_dispute_id is not null AND disputed_at > now() - interval '1 hour'"
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

**Detection.** Check `/admin/payment-issues` (filter: Disputed) first. Direct
SQL, for anything the UI doesn't show — `stripe_dispute_id` and `disputed_at`
are now recorded by the webhook the moment `charge.dispute.created` arrives,
this is no longer only discoverable in Stripe directly:

```sql
select id, listing_request_id, payment_type, creator_user_id,
       stripe_charge_id, stripe_dispute_id, disputed_at
from public.listing_request_payments
where stripe_dispute_id is not null
order by disputed_at desc;
```

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
    match: "event_type = 'charge.dispute.closed' AND processing_status = 'processed'"
auto_fix: none
reason_not_automatable: "no write path; outcome determines the request's fate"
escalate_with:
  - "the outcome (won/lost) and final amount, read live from Stripe using stripe_dispute_id"
  - "the request's state and whether it should now be cancelled or completed"
```

**Detection.** `charge.dispute.closed` is now recorded — the event id lands in
the payment's `stripe_event_ids`, so a repeat delivery does not reprocess it —
but the outcome (won, lost, the final amount) is deliberately **not** mirrored
into a column. Read it live from Stripe with the payment's `stripe_dispute_id`
rather than trusting a stored copy that could go stale if Stripe's own record
changes after the fact.

**Fix.** Manual. The outcome decides what happens to the project, and nothing in
the product reflects it automatically.

---

## What building this feature requires

Recorded here so the work is specified before it starts. Items 1 and 2 shipped
in Sprint 3 (2026-09-22); the rest is still Sprint 5.

1. ~~**Populate `stripe_charge_id` and `stripe_application_fee_id`** on the
   existing paid path.~~ **Done.** Fetched live from the PaymentIntent's
   expanded `latest_charge` in `markListingRequestPaymentPaidFromCheckoutSession`
   (`api/server.js`), with a self-healing backfill path
   (`backfillChargeDetailsForPayment`) for a payment that reached `paid` before
   this existed and is retried through the "already paid" branch. It does
   **not** run a one-time bulk backfill over historical rows — see Known gaps.
2. ~~**Handle `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`**~~
   **Done**, recording only. `recordChargeRefundedFromWebhook`,
   `recordChargeDisputeCreatedFromWebhook` and
   `recordChargeDisputeClosedFromWebhook` in `api/server.js` write the Stripe
   id and timestamp onto the matching payment and reuse the `stripe_event_ids`
   idempotency pattern. They deliberately never write `status` — see "What
   exists and what does not" above for why.
3. **Add `security definer` RPCs** following the `apply_paid_listing_request_*`
   shape, to write refund and dispute state and cascade the request.
4. **Implement the fee policy** in `REF-001` — proportional, cumulative, rounded
   once, minimums never recalculated. Decided in Refund Policy §8 and
   [`../../launch-scope.md`](../../launch-scope.md) §6.2; no longer a blocker.
5. **Decide what a refund does to the request.** Cancelled? Reverted to an
   earlier stage? Milestone-specific refunds need this answered per stage —
   launch-scope.md §6.7 already has the table.
6. **Add the first server-side tests** for the new recording functions and for
   the RPCs above once they exist. `api/server.js` still has close to no test
   coverage; this feature should not be the code that continues that.
7. ~~**Admin surface** for disputes and out-of-band refunds~~ **Done.**
   `/admin/payment-issues` lists every payment with a `stripe_dispute_id` or
   `stripe_refund_id` set, filterable by type, and flags per row when `status`
   still reads `paid` — replacing the queries above for day-to-day use (they
   remain useful for direct DB investigation).
8. **Update this playbook again** once the ledger lands — replace the Tier 2
   entries with Tier 1 auto-fixes where they qualify, and move the
   reconciliation queries above into real alerting instead of a query run by
   hand.

---

## Known gaps

- **No refund or dispute-response capability in the product.** Recording a
  refund or dispute happened is not the same as acting on one — issuing a
  refund, freezing collection, or closing a disputed request are all still
  manual.
- **`status` never reflects a refund or dispute.** `stripe_refund_id` /
  `stripe_dispute_id` being set is the only signal; `status` keeps reading
  `paid` until the ledger derives it for real (Sprint 5). REF-002 and REF-003's
  detection queries exist because of this gap, not despite it.
- **No bulk backfill has been run.** The self-healing backfill in
  `backfillChargeDetailsForPayment` only fires when a payment already marked
  `paid` is retried through a later webhook event (the "downstream workflow RPC
  failed" retry path). A `paid` row that is never retried keeps a null
  `stripe_charge_id` forever. As of 2026-09-22 there are zero `paid` rows in
  production (no live traffic yet — see launch-scope.md), so there is nothing
  to backfill today; this becomes a real gap the moment the first payment goes
  through under the pre-fix code, and should be closed with a real backfill
  script before that matters, not left to the retry path.
- **The ledger cannot represent a partial refund.** One nullable `stripe_refund_id`,
  one `refunded_at`, no refunded amount and no history — so two partial refunds
  against one payment have nowhere to go. An immutable refund ledger has to land
  with the feature. `recordChargeRefundedFromWebhook` stores only the *latest*
  refund id from `charge.refunds.data[0]` for this reason — it is a pointer for
  REF-002's detection query, not a history.
- Nothing alerts on the new refund/dispute columns being set; the detection
  queries above have to be run by hand until Sprint 6's staleness/alerting work
  covers them too.

The **fee-refund policy is decided** — Refund Policy §8 and
[`../../launch-scope.md`](../../launch-scope.md) §6 — so "what this feature
requires" above is a build specification rather than an open question.
