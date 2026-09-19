---
feature: messaging/moderation
status: active
surfaces:
  - public.moderation_reports
  - src/hooks/moderation/ , src/domain/moderation/
  - src/pages/admin/ , src/pages/reports/
unmatched_tier: 2
---

# Moderation and Reports — Support Playbook

Users report listings, profiles, messages and conversations. Admins review the
queue, and can hide listings, lock conversations, or mark profiles under review.
Reporters can see the status of their own reports.

The reports themselves are rarely the technical problem. **The queue is.** A
moderation report is a user telling us something is wrong — often a scam in
progress — and an unworked queue produces no errors at all while the harm
continues.

## Quick triage

| Symptom the user reports | Likely issue |
| --- | --- |
| "I can't report this" | [`MOD-001`](#mod-001--report-rejected-as-duplicate-or-self-report) |
| "My report went nowhere" | [`MOD-003`](#mod-003--report-queue-not-being-worked) |
| "Admin actions are failing" | [`MOD-002`](#mod-002--moderation-action-rejected) |
| "Someone is scamming on the platform" | [`MOD-004`](#mod-004--active-harm-reported) |

---

## `MOD-001` — Report rejected as duplicate or self-report

```yaml
id: MOD-001
tier: 2
signals:
  - source: db
    match: "You cannot report your own listing."
  - source: db
    match: "You cannot report your own profile."
  - source: db
    match: "You cannot report your own message."
  - source: db
    match: "You cannot report yourself."
  - source: db
    match: "You already have an active report for this listing. You can submit another report after the current review is complete."
  - source: db
    match: "You already have an active report for this profile. You can submit another report after the current review is complete."
  - source: db
    match: "You have already reported this listing."
  - source: db
    match: "You have already submitted a report for this item."
auto_fix: none
reason_not_automatable: "working as designed"
escalate_if:
  - "a user repeatedly tries to re-report the same target"   # the first report may be unworked
```

**Cause.** Duplicate-report and self-report guards.

**What the user sees.** A refusal to accept their report.

**Fix.** None needed — but the escalation condition matters. **Someone trying
repeatedly to re-report the same target is usually someone whose first report was
ignored and who is watching harm continue.** Treat the repetition as a signal
about the queue rather than as a user error.

**Money impact.** None directly. An unaddressed scam report can mean real loss.

---

## `MOD-002` — Moderation action rejected

```yaml
id: MOD-002
tier: 2
signals:
  - source: db
    match: "Only admins can update moderation reports."
  - source: db
    match: "Only admins can update report status."
  - source: db
    match: "Only admins can view moderation report summaries."
  - source: db
    match: "Only admins can clear profile review."
  - source: db
    match: "Only admins can mark profiles under review."
  - source: db
    match: "Moderation report not found."
  - source: db
    match: "A report status is required."
  - source: db
    match: "A resolution is required when resolving a report."
  - source: db
    match: "A report reason is required."
auto_fix: none
reason_not_automatable: "admin authorization; the agent may never write admin_roles or act as an admin"
escalate_if:
  - "a non-admin repeatedly attempting admin actions"   # -> tier 3
escalate_with:
  - "the acting user id and whether they hold an admin role"
```

**Cause.** Either a non-admin attempting an admin action, or an incomplete
resolution form.

**Fix.** For the form case, supply the missing field — the resolution requirement
exists so closed reports carry a reason, which matters if the same target is
reported again.

**Escalate on repetition.** A non-admin repeatedly attempting moderation actions
is attempting privilege escalation. **The agent may never grant an admin role**
or perform a moderation action.

**Money impact.** None directly.

---

## `MOD-003` — Report queue not being worked

```yaml
id: MOD-003
tier: 2
signals:
  - source: db
    where: public.moderation_reports
    match: "status = 'open' AND created_at < now() - interval '48 hours'"
auto_fix: none
reason_not_automatable: "moderation is a human judgement"
escalate_with:
  - "queue depth and the age of the oldest open report"
  - "breakdown by target type"
  - "whether any open report alleges active financial harm"
```

**Cause.** The queue is not being reviewed.

**What the user sees.** Nothing — which is the problem. Their report vanishes
into silence while whatever they reported continues.

**Fix.** Work the queue. **The agent may only surface the backlog**, never
resolve a report.

**Why this is worth alerting on.** It produces no errors and no logs. The only
symptoms are users giving up and harm continuing. Of every gap in this
documentation set, an unworked moderation queue is the one most likely to cost
someone money quietly.

**Money impact.** Indirect and potentially large. Reports frequently describe
scams in progress.

---

## `MOD-004` — Active harm reported

```yaml
id: MOD-004
tier: 3
signals:
  - source: user_report
    match: "report alleging fraud, impersonation, or an in-progress scam"
  - source: db
    match: "multiple reports against the same target in a short window"
auto_fix: none
reason_not_automatable: "requires judgement, and possibly account and payment action"
escalate_with:
  - "every report against the target"
  - "the target's active listings and in-flight requests"
  - "money currently in flight to or from them"
  - "their payment account state"
```

**Cause.** Someone is being defrauded, or a creator is being impersonated —
exactly the failure CreatorHub exists to prevent.

**Why Tier 3 immediately.** Money may be moving right now, and delay is the cost.
Multiple reports against one target within a short window is a strong signal
regardless of what each individual report says.

**Fix.** Human, urgent, and follow [`incident-response.md`](../incident-response.md).
Containment options include unpublishing listings and locking conversations —
**recommended by the agent, executed by a human.**

**Money impact.** Potentially the largest of anything in this documentation set.
Fraud in progress is money leaving real people's hands while we decide.

---

## Known gaps

- **No queue-age alerting.** `MOD-003` must be run by hand, and it is the entry
  most likely to matter.
- **No velocity detection** for multiple reports against one target, which is
  the main `MOD-004` signal.
- **No documented reporter feedback loop** — reporters are not told outcomes, so
  they cannot distinguish "reviewed and dismissed" from "ignored".
- **No account suspension capability** documented. The containment options are
  unpublishing listings and locking conversations; there is no way to stop a bad
  actor from simply continuing elsewhere on the platform.
