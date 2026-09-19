---
feature: requests/request-lifecycle
status: active
surfaces:
  - public.listing_requests
  - src/domain/listings/requestWorkspace.ts
  - src/pages/buyer/ , src/pages/creator/ , src/pages/admin/
unmatched_tier: 2
---

# Request Lifecycle — Support Playbook

A request is the container for a commission. It carries a snapshot of the listing
as it was when the buyer asked, the conversation, the agreement, payments,
milestones, deliveries, and the final outcome.

The workflow is a strict sequence:

```
buyer request -> creator acceptance -> project agreement -> buyer acceptance
-> required payment -> work and progress -> revisions / change orders
-> final delivery -> completion
```

Almost every "not ready for…" error in this family means **something upstream in
that sequence has not happened**. Diagnosing them is usually a matter of walking
backwards to the first incomplete step rather than investigating the step that
produced the error.

The workspace UI computes whose turn it is from
`src/domain/listings/requestWorkspace.ts`. When a user says the request is
stuck, that "Next step" card is the fastest way to see what the system thinks is
outstanding.

## Quick triage

| Symptom the user reports | Likely issue |
| --- | --- |
| "Nothing happens, it's stuck" | [`REQ-001`](#req-001--request-stuck-behind-an-unmet-precondition) |
| "I paid but it won't move on" | [`WHK-002`](../payments/webhooks.md#whk-002--payment-marked-paid-but-the-workflow-did-not-advance) |
| "The other party has gone quiet" | [`REQ-003`](#req-003--unresponsive-participant) |
| "I can't archive this" | [`REQ-002`](#req-002--action-attempted-by-the-wrong-party) |
| "My request was declined and the chat is gone" | [`REQ-004`](#req-004--conversation-missing-for-a-declined-request) |

---

## `REQ-001` — Request stuck behind an unmet precondition

```yaml
id: REQ-001
tier: 2
signals:
  - source: db
    match: "This request is not ready for a project agreement."
  - source: db
    match: "This request is not ready for agreement response."
  - source: db
    match: "This request is not ready for a change order."
  - source: db
    match: "Final delivery can only be created for an accepted request."
auto_fix: none
reason_not_automatable: "the guard is correct; forcing the stage would corrupt the workflow"
escalate_with:
  - "the request's current stage"
  - "the first incomplete step walking backwards from the attempted action"
  - "the Next step card's computed state for both parties"
```

**Cause.** An action was attempted out of order. Usually the UI offered it — a
stale page, or a state the workspace computed differently from the database.

**What the user sees.** A button that exists and then fails, which reads as the
product being broken rather than as them being early.

**Fix.** Identify the actual current stage and complete the missing upstream step.
**Never force the stage forward.** These guards exist because payments and
deliverables depend on the ordering, and stepping over one leaves money and work
records disagreeing.

**Worth watching.** Frequent hits mean the UI and the database disagree about
state. That is a bug in the workspace computation, not a support problem, and it
will keep generating tickets until it is fixed.

**Money impact.** None directly. The project is frozen.

---

## `REQ-002` — Action attempted by the wrong party

```yaml
id: REQ-002
tier: 2
signals:
  - source: db
    match: "/^You must be signed in to /"
  - source: db
    match: "/^Only (the creator|the buyer|an administrator|admins) /"
auto_fix: none
reason_not_automatable: "authorization boundary"
escalate_if:
  - "one user hitting these across several requests"   # -> tier 3, probing
escalate_with:
  - "the acting user id and their actual role on the request"
  - "count of similar denials from that user"
```

**Cause.** Either an expired session (the "must be signed in" variants) or
genuinely the wrong role attempting a role-restricted action.

**What the user sees.** For the session case, an action failing for no apparent
reason — see [`auth/sign-in.md`](../auth/sign-in.md) `AUTH-004`.

**Fix.** Re-authenticate, or clarify who is meant to act. The "Next step" card
shows whose turn it is.

**Escalate on patterns.** One person hitting role denials across multiple
requests is testing boundaries, not misclicking.

**Money impact.** None. These checks run at the database, so a UI bypass does not
get past them.

---

## `REQ-003` — Unresponsive participant

```yaml
id: REQ-003
tier: 2
signals:
  - source: user_report
    match: "the other party has stopped responding"
  - source: db
    match: "request has not advanced in 14+ days with a pending action on one side"
auto_fix: none
reason_not_automatable: "no policy exists; resolution affects money"
escalate_with:
  - "which side is unresponsive and for how long"
  - "money already paid and its current state"
  - "what has been delivered so far"
```

**Cause.** A buyer who stopped responding to a delivery, or a creator who took a
deposit and went quiet.

**What the user sees.** A project frozen indefinitely, often with money already
paid into it, and no way to end it.

**Fix.** There is no automated path and **no policy for this yet**. Each case is
handled by hand.

**This is a launch gap, not just a support case.** A marketplace that takes
deposits needs defined rules for abandonment: how long before a request can be
closed, who keeps the deposit, what the other party can do unilaterally. Without
them, every occurrence is an ad-hoc judgement, and the parties have no stated
expectations to rely on.

**Money impact.** Potentially significant. Deposits can sit indefinitely with no
delivery and no refund route — and no refund route exists at all, see
[`refunds-and-disputes.md`](../payments/refunds-and-disputes.md).

---

## `REQ-004` — Conversation missing for a declined request

```yaml
id: REQ-004
tier: 2
signals:
  - source: db
    match: "Conversation not found for declined request."
auto_fix: none
reason_not_automatable: "data inconsistency; needs inspection before any write"
escalate_with:
  - "the request id and its status"
  - "whether a conversation row exists in any state"
```

**Cause.** A request was declined but the expected conversation is not there. The
decline flow assumes one exists.

**What the user sees.** A decline that errors, or a request with no visible
history of why.

**Fix.** Manual inspection. This is a data-consistency issue — if it recurs,
treat it as an integrity problem rather than a series of one-offs.

**Money impact.** None; declined requests have no payments.

---

## Known gaps

- **No abandonment policy.** `REQ-003` is the biggest one. It needs product
  rules before launch, not a support workaround.
- **No cancellation workflow.** The brief calls for explicit cancellation rules;
  there is no implementation and therefore nothing here to document beyond
  "handle by hand".
- **No staleness alerting.** Nothing surfaces requests that have not moved.
- **UI/database state disagreement** is the likely cause of most `REQ-001`
  reports and is not instrumented.
