---
feature: requests/change-orders
status: active
surfaces:
  - public.listing_request_change_orders
  - supabase/migrations/20260608_085_respond_listing_request_change_order_rpc.sql
  - supabase/migrations/20260608_086_create_change_order_payment_on_acceptance.sql
unmatched_tier: 2
---

# Change Orders — Support Playbook

A change order amends an accepted agreement: scope, price, or timeline. The buyer
accepts or declines, and acceptance of a price increase creates a new payment.

Change orders are where an agreed record gets rewritten, so the integrity
question here is: **after the change, does the record still show what both
parties actually agreed, and does the money still add up?**

## Quick triage

| Symptom the user reports | Likely issue |
| --- | --- |
| "I can't send a change order" | [`CHG-001`](#chg-001--change-order-content-rejected), [`CHG-002`](#chg-002--request-not-ready-for-a-change-order) |
| "It says nothing changed" | [`CHG-001`](#chg-001--change-order-content-rejected) |
| "Buyer accepted but no payment appeared" | [`CHG-003`](#chg-003--accepted-change-order-did-not-create-its-payment) |
| "The new price isn't reflected" | [`CHG-003`](#chg-003--accepted-change-order-did-not-create-its-payment) |

---

## `CHG-001` — Change order content rejected

```yaml
id: CHG-001
tier: 2
signals:
  - source: db
    match: "A change order must change at least one project term."
  - source: db
    match: "Change order title must be between 3 and 160 characters."
  - source: db
    match: "Change order summary must be between 10 and 4000 characters."
  - source: db
    match: "A revised total amount is required for a price change."
  - source: db
    match: "A revised completion date is required for a timeline change."
  - source: db
    match: "This timeline change does not include a revised completion date."
  - source: db
    match: "Change order response reason cannot exceed 2000 characters."
auto_fix: none
reason_not_automatable: "user input correction"
```

**Cause.** Validation. The most common is a change order that declares a price or
timeline change without supplying the new value — usually a partly-filled form.

**What the user sees.** A rejected change order, often mid-negotiation when the
creator is trying to respond quickly to a buyer request.

**Fix.** Complete the missing field. "Must change at least one term" means the
change order is identical to the current agreement — there is nothing to accept.

**Money impact.** None yet.

---

## `CHG-002` — Request not ready for a change order

```yaml
id: CHG-002
tier: 2
signals:
  - source: db
    match: "This request is not ready for a change order."
  - source: db
    match: "Change order status must be draft or sent."
  - source: db
    match: "Change order response must be buyer_accepted or buyer_declined."
auto_fix: none
reason_not_automatable: "sequencing guard"
```

**Cause.** A change order needs an accepted agreement to amend. Attempting one
before the buyer has accepted, or on a completed request, is refused.

**Fix.** Establish the agreement first. See
[`request-lifecycle.md`](request-lifecycle.md) `REQ-001` for walking back to the
first incomplete step.

**Money impact.** None.

---

## `CHG-003` — Accepted change order did not create its payment

```yaml
id: CHG-003
tier: 2
signals:
  - source: db
    match: "change order status = 'buyer_accepted' with no corresponding listing_request_payments row"
    where: public.listing_request_change_orders
auto_fix: none
reason_not_automatable: "creating a payment record is originating financial state"
escalate_with:
  - "the change order id, revised total, and acceptance timestamp"
  - "existing payments for the request"
  - "whether the agreement total was updated"
```

**Cause.** Acceptance of a price-increasing change order should create a
change-order payment. If the acceptance wrote but the payment creation did not,
the agreement says one thing and the payment records another.

**What the user sees.** A change order marked accepted, an updated scope, and no
way to pay the difference. Work may proceed on the expectation of a payment that
was never requested.

**Fix.** Manual. **The agent may not create the payment record** — that is
originating payment state, which is on the forbidden list.

Establish first whether the agreement total was updated, since that determines
whether the record is merely incomplete or actively inconsistent.

**Money impact.** Direct. The creator may deliver expanded scope with no
mechanism to be paid for it.

---

## `CHG-004` — Change-order payment confirmation restricted

```yaml
id: CHG-004
tier: 2
signals:
  - source: db
    match: "Only an administrator can confirm a change-order payment."
  - source: db
    match: "You must be signed in to confirm a change-order payment."
auto_fix: none
reason_not_automatable: "manual confirmation is break-glass, not the production path"
escalate_with:
  - "why the automated path did not apply the payment"
```

**Cause.** The admin manual-confirmation fallback was attempted.

**Same caution as milestones.** The production path is the Stripe webhook.
Routine use of manual confirmation means the automated path is broken, and
confirming by hand marks money as received without verifying it moved. See
[`milestones.md`](milestones.md) `MIL-004`.

**Money impact.** Manual confirmation can release work against an unpaid change
order.

---

## Known gaps

- **Interaction with existing milestone schedules is undocumented.** What a price
  change does to already-created milestone schedule items is not specified
  anywhere, and `AGR-001` totals checks may or may not still reconcile
  afterwards. Worth resolving before launch.
- **No alerting for `CHG-003`.** The mismatch query exists here only.
- **Declined change orders** have no documented effect on the project's state.
- **No versioned view of terms over time**, so which version applied when is not
  reconstructable for a dispute.
