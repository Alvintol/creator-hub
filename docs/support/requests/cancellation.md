---
feature: requests/cancellation
status: active
surfaces:
  - public.listing_requests
  - public.listing_request_cancellation_proposals
  - public.listing_request_cancellation_proposal_items
  - public.cancel_listing_request_before_payment()
  - public.propose_listing_request_cancellation()
  - public.submit_listing_request_cancellation_statement()
  - public.respond_listing_request_cancellation_proposal()
  - api/server.js (POST /api/stripe/checkout/expire-cancelled-sessions)
  - src/domain/listings/requestWorkspace.ts
unmatched_tier: 2
---

# Cancellation — Support Playbook

Sprint 4 (`../../launch-scope.md` §5). Two different mechanisms, chosen by
whether a payment has been collected:

- **Before any payment**: `cancel_listing_request_before_payment` — either
  party, unilateral, no review. Cancels the request, the agreement, every
  non-terminal schedule item / milestone / change order / final delivery, and
  expires any open Stripe checkout session.
- **After any payment**: a `listing_request_cancellation_proposals` row —
  never unilateral. The creator's itemised, per-payment earned-value
  statement is what the buyer accepts or disputes. Acceptance cancels the
  rest of the project and flags unearned amounts for the refund engine
  (Sprint 5, which has not shipped — nothing is actually refunded by this
  feature). A dispute is this playbook's Tier 2 signal, not a bug.

Both paths write `listing_requests.status = 'cancelled'`, which closes the
conversation the same way completion does (`20260611_094`'s pattern, with
`closed_reason_code = 'not_moving_forward'`) and is a terminal state the
workspace's "Next step" card renders as closed for everyone.

## Quick triage

| Symptom the user reports | Likely issue |
| --- | --- |
| "I can't cancel / it says the wrong state" | [`CAN-001`](#can-001--cancellation-attempted-from-the-wrong-state) |
| "The itemised statement won't save" | [`CAN-002`](#can-002--itemised-statement-rejected) |
| "It says I'm not allowed to do that" | [`CAN-003`](#can-003--wrong-party-or-not-signed-in) |
| "The buyer disputed my cancellation statement" | [`CAN-004`](#can-004--dispute-opened-on-a-cancellation-statement) |
| "A cancelled payment still shows paid / still got charged" | [`CAN-005`](#can-005--a-cancelled-payments-checkout-session-was-completed-anyway) |
| "My cancellation was accepted but I never got my refund" | [`CAN-006`](#can-006--accepted-cancellations-flagged-refund-never-applied) |

---

## `CAN-001` — Cancellation attempted from the wrong state

```yaml
id: CAN-001
tier: 2
signals:
  - source: db
    match: "Only an accepted request can be cancelled through this unilateral path."
  - source: db
    match: "A payment has already been collected on this request. Use the post-payment cancellation proposal instead."
  - source: db
    match: "No payment has been collected on this request yet. Use cancel_listing_request_before_payment instead."
  - source: db
    match: "Only an accepted request can have a cancellation proposed."
  - source: db
    match: "No accepted agreement was found for this request."
  - source: db
    match: "A cancellation proposal is already open for this request."
  - source: db
    match: "This cancellation proposal is not awaiting your statement."
  - source: db
    match: "This cancellation proposal is not awaiting your response."
auto_fix: none
reason_not_automatable: "the guard is correct; forcing the wrong cancellation path would corrupt the ledger"
escalate_with:
  - "the request's current status and whether an agreement exists"
  - "every listing_request_payments row's status for the request"
  - "any existing listing_request_cancellation_proposals row and its status"
```

**Cause.** The two cancellation paths are mutually exclusive by design: the
unilateral RPC refuses once any payment reaches `paid` / `processing` /
`refunded` / `partially_refunded` / `disputed`, and the proposal RPC refuses
until at least one payment is `paid`. Most hits are a stale page — a payment
completed in another tab while the buyer or creator was still looking at the
"cancel unilaterally" button.

**What the user sees.** A cancel action that was visible a moment ago now
fails, or a second attempt to open a proposal fails because one is already
open.

**Fix.** Refresh and use whichever path the current state actually supports.
**Never bypass the guard** — the two paths write different columns and post
different conversation events; forcing one through the other's precondition
produces a request that is `cancelled` without the settlement math a
post-payment cancellation requires.

**Money impact.** None directly — these are all pre-write guards. If the
guard is firing when it should not be (e.g. a payment that is actually
`cancelled` or `failed` is somehow blocking the unilateral path), that is a
data-integrity question, not a support one — escalate to Tier 3.

---

## `CAN-002` — Itemised statement rejected

```yaml
id: CAN-002
tier: 2
signals:
  - source: db
    match: "A cancellation statement must include at least one itemised payment."
  - source: db
    match: "Each cancellation statement item must reference a payment_id."
  - source: db
    match: "/Payment .+ is not a paid payment on this request\\./"
  - source: db
    match: "/Earned amount for payment .+ cannot exceed the .+ cents actually paid\\./"
  - source: db
    match: "/Payment .+ is listed more than once in this statement\\./"
  - source: db
    match: "The itemised statement must cover every paid payment on this request."
  - source: db
    match: "The creator must include an itemised earned-value statement when opening a cancellation."
auto_fix: none
reason_not_automatable: "the agent may never adjust the earned/unearned split -- that is the creator's claim, evidenced against the work"
escalate_with:
  - "every paid listing_request_payments row for the request, with base_amount_cents"
  - "the items the creator attempted to submit"
```

**Cause.** `apply_listing_request_cancellation_statement` (the internal
function both `propose_listing_request_cancellation` and
`submit_listing_request_cancellation_statement` call) requires the itemised
statement to cover **every** `paid` payment on the request exactly once,
with each item's `earned_amount_cents` no greater than that payment's
`base_amount_cents`. Same principle as
[`AGR-001`](agreements.md#agr-001--agreement-totals-do-not-reconcile):
the numbers must actually add up before anything is saved.

**What the user sees.** The statement form refuses to save, most often
because a payment created after the creator started filling it out (a
milestone payment collected mid-session) is missing from the list.

**Fix.** Have the creator reload and resubmit with every currently-paid
payment included. **The agent must never invent or adjust an earned amount**
— that figure is the creator's evidenced claim about their own work, and a
support-fabricated number is worthless in the dispute this statement may
become evidence for (see `CAN-004`).

**Money impact.** None yet — this is the check preventing an incomplete or
inflated statement from ever becoming the operative one.

---

## `CAN-003` — Wrong party or not signed in

```yaml
id: CAN-003
tier: 2
signals:
  - source: db
    match: "/^You must be signed in to (cancel|propose|submit|respond)/"
  - source: db
    match: "Only the creator provides the itemised earned-value statement."
auto_fix: none
reason_not_automatable: "authorization boundary"
escalate_if:
  - "one user hitting these across several requests"   # -> tier 3, probing
```

**Cause.** Same shape as
[`REQ-002`](request-lifecycle.md#req-002--action-attempted-by-the-wrong-party):
an expired session, or the wrong role attempting a role-restricted step. Both
cancellation RPCs check `auth.uid()` against the request's own
`buyer_user_id` / `creator_user_id` — there is no separate authorization
layer to get out of sync with the UI.

**Fix.** Re-authenticate, or clarify who is meant to act — the buyer opens a
cancellation with a reason only; only the creator ever writes the itemised
statement; only the buyer ever accepts or disputes it.

**Money impact.** None. These checks run at the database.

---

## `CAN-004` — Dispute opened on a cancellation statement

```yaml
id: CAN-004
tier: 2
signals:
  - source: db
    match: "listing_request_cancellation_proposals.status = 'disputed'"
    where: "public.listing_request_cancellation_proposals"
auto_fix: none
reason_not_automatable: "money movement is always human; this is the intended Tier 2 queue"
escalate_with:
  - "the operative statement's items (public.listing_request_cancellation_proposal_items where is_operative = true), with paid/earned/unearned per payment"
  - "the dispute reason (buyer_response_reason)"
  - "the original cancellation reason and who proposed it"
  - "the full conversation history for the request"
  - "whether any work product (milestone submissions, final delivery links) supports the creator's earned-value claim"
```

**Cause.** This is not a bug — §5.2 step 5 makes disputing the intended
outcome when the buyer disagrees with the creator's earned-value claim.
`respond_listing_request_cancellation_proposal` writes `status = 'disputed'`
and stops; nothing downstream is cancelled and no money moves.

**The queue, mechanically.** There is no separate ticket table (same pattern
as [`REF-001`](../payments/refunds-and-disputes.md#ref-001--refund-requested-by-a-buyer)):
query `public.listing_request_cancellation_proposals where status =
'disputed'` for the current queue.

**Fix.** The decision itself is still entirely manual, per Refund Policy §9 —
Made for Stream reviews the operative statement against the evidence
(milestone submissions, delivery links, conversation history) and decides.
**What changed in Sprint 5:** that decision is now *actionable* —
`/admin/requests/:id`'s Payments section has a refund panel
(`ListingRequestPaymentAdminRefundPanel.tsx`) that can issue whatever refund
the decision calls for, on any `paid`/`partially_refunded` payment, without
needing the proposal's own acceptance flow. **There is still no formal
"resolved" state for the dispute itself** — the
`listing_request_cancellation_proposals` row stays `status = 'disputed'`
forever, even after the decision is acted on. Record the decision and its
reasoning in the conversation (a message on the request) until a real
resolution state exists; see
`docs/support/payments/refunds-and-disputes.md`'s Known gaps for the same
note from the money side.

**Money impact.** The disputed payments stay `paid` and undisturbed. Nothing
is at risk from inaction, but the request itself is stuck — neither
cancelled nor progressing — until someone decides.

---

## `CAN-005` — A cancelled payment's checkout session was completed anyway

```yaml
id: CAN-005
tier: 2
signals:
  - source: user_report
    match: "buyer says they paid after a request was cancelled"
  - source: db
    match: "listing_request_payments.status = 'paid' and updated_at > (select cancelled_at from listing_requests where id = listing_request_payments.listing_request_id)"
    where: "public.listing_request_payments joined to public.listing_requests"
auto_fix: none
reason_not_automatable: "money was actually captured by Stripe; reversing it is a refund decision, not a cleanup script"
escalate_with:
  - "the payment id, its stripe_charge_id, and the exact paid_at timestamp"
  - "the request's cancelled_at timestamp and which cancellation path produced it"
  - "whether /api/stripe/checkout/expire-cancelled-sessions was ever called for this request (check server logs around cancelled_at)"
```

**Cause.** Both cancellation RPCs move any `requires_checkout` /
`checkout_opened` payment to `status = 'cancelled'` in the database, but a
database write cannot reach the Stripe API. The actual Stripe checkout
session is only expired by a **second, separate call** —
`POST /api/stripe/checkout/expire-cancelled-sessions` — that the frontend
hooks (`useCancelListingRequestBeforePayment`,
`useRespondListingRequestCancellationProposal`) fire immediately after a
successful cancellation. There is a real window between the two calls, and
the expire call is deliberately best-effort (network failure there does not
undo the cancellation) — see the comment in
`src/hooks/payments/expireCancelledCheckoutSessions.ts`. If a buyer still had
that checkout page open and completed payment inside that window, Stripe
processes it, and `markListingRequestPaymentPaidFromCheckoutSession` in
`api/server.js` marks the payment `paid` — **it does not currently check
whether the request was cancelled first.**

**What the user sees.** A buyer who insists they paid on an already-cancelled
request, or — from the other side — a `listing_request_payments` row reading
`paid` against a `listing_requests` row reading `cancelled`, which is the
data-integrity shape to search for.

**Fix (Sprint 5): this is now automatic, not manual.**
`markListingRequestPaymentPaidFromCheckoutSession` in `api/server.js` checks
the linked request's status before applying any payment workflow; if it is
already `cancelled`, it calls `refundStrayPaymentOnCancelledRequest` instead
— a full refund of everything (base, both fees, tip and contribution) via
the same refund engine as `REF-001`
(`apply_refunded_listing_request_payment`, `initiated_via = 'system_auto_refund'`),
and no project workflow ever runs. The request itself correctly stays
`cancelled` — nothing tries to revert it to `accepted`.

**If you still see this symptom**, the automatic refund itself failed
(Stripe error, or the RPC raised) rather than never having run — check the
API logs for `refundStrayPaymentOnCancelledRequest` / a thrown error around
the payment's `paid_at`, then confirm the charge against Stripe directly
(`stripe_charge_id` on the payment row) and, if still unrefunded, issue it by
hand from `/admin/requests/:id`'s refund panel — the request itself stays
`cancelled` regardless.

**Money impact.** Direct. A real charge exists on a project both parties
already agreed is cancelled.

---

## `CAN-006` — Accepted cancellation's flagged refund never applied

```yaml
id: CAN-006
tier: 2
signals:
  - source: db
    match: "listing_request_cancellation_proposal_items.flagged_for_refund_at is not null and refunded_at is null and flagged_for_refund_at < now() - interval '10 minutes'"
    where: "public.listing_request_cancellation_proposal_items"
auto_fix: retry_drain_route
params:
  listingRequestId: "$.listing_request_id (via the item's proposal)"
verify:
  - "the item's refunded_at is now set"
retry_limit: 1
escalate_if:
  - "the retry also fails, or fails with a Stripe error rather than a transient one"
escalate_with:
  - "the item's payment_id, unearned_amount_cents"
  - "whatever error POST /api/stripe/refunds/drain-flagged-for-request returned"
```

**Cause.** `useRespondListingRequestCancellationProposal`'s follow-up call to
`POST /api/stripe/refunds/drain-flagged-for-request` is best-effort — a
network failure, a closed tab, or the payment's Stripe charge being
otherwise unrefundable (see `apply_refunded_listing_request_payment`'s own
guards) all leave the item flagged with no refund applied.

**What the user sees.** The buyer accepted or received an accepted
cancellation statement showing an unearned amount, but no refund shows up on
their card and the payment still reads `paid` or `partially_refunded`
instead of `refunded`.

**Fix.** Retrying the same route is safe and usually sufficient — the drain
route re-derives its own queue from the database rather than trusting
anything cached, and `apply_refunded_listing_request_payment` is idempotent
per Stripe refund. If it fails again with an actual Stripe error (not a
network blip), escalate — the underlying payment may have a real problem
(missing charge id, insufficient connected-account balance triggering the
platform-funded-refund path unexpectedly, etc.) that needs a human to look
at rather than a second automatic retry.

**Money impact.** None yet if genuinely never applied — the money is still
sitting where it always was. Once applied, it is the ordinary refund money
impact (see `docs/support/payments/refunds-and-disputes.md`).

---

## Known gaps

- **`CAN-004` still has no formal "resolved" state.** The refund engine makes
  Made for Stream's decision actionable (see the entry above), but the
  proposal row itself has no admin-facing "mark resolved" action — it stays
  `status = 'disputed'` in the database even after money moves. Recording the
  decision durably still means a message on the request's conversation, not
  a structured field.
- **A `processing` payment (an async payment method, mid-flight) is still not
  touched by either cancellation RPC.** `cancel_listing_request_before_payment`
  refuses to run at all if one exists; the post-payment acceptance cascade
  only cancels `requires_checkout` / `checkout_opened` rows. If that payment
  later resolves to `paid`, it now hits the same `CAN-005` guard described
  below (the fix is not specific to the checkout-session race) — Cards-only
  checkout (`launch-scope.md` §1.6) makes an actual `processing` payment rare
  in practice, not impossible.
- **An accepted post-payment cancellation's flagged unearned amounts are
  refunded via a best-effort follow-up call, not inside the acceptance
  transaction itself.** `respond_listing_request_cancellation_proposal`
  flags the amounts (Sprint 4); `useRespondListingRequestCancellationProposal`
  then calls `POST /api/stripe/refunds/drain-flagged-for-request`
  immediately afterward (Sprint 5), the same pattern
  `expireCancelledCheckoutSessions` already uses. **If that follow-up call
  fails or the buyer/creator closes the tab before it completes**, the
  amounts stay flagged and unrefunded — query
  `listing_request_cancellation_proposal_items where flagged_for_refund_at is
  not null and refunded_at is null` to find them, and either retry the same
  route or issue the refund by hand from `/admin/requests/:id` (which sets
  `refunded_at` on the matching item as a side effect either way).
