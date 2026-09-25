import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";
import {
  OPS_ALERTS,
  OPS_ALERT_REMINDER_MS,
  isAuthorizedOpsRequest,
  planOpsAlertDigest,
  renderOpsAlertDigest,
} from "../opsAlerts.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const readRepoFile = (relativePath) =>
  fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

const migration = readRepoFile(
  "supabase/migrations/20260924_139_add_connect_account_state_and_ops_alerts.sql",
);

const listOpsAlertsBody = migration.slice(
  migration.indexOf("create or replace function public.list_ops_alerts()"),
  migration.indexOf("revoke all on function public.list_ops_alerts()"),
);

describe("alert registry", () => {
  it("matches list_ops_alerts() branch for branch, with the same playbook issue", () => {
    const pairs = [
      ...listOpsAlertsBody.matchAll(
        /select\s+'([a-z0-9_]+)'(?:::text)?,\s+'([A-Z]+-\d{3})'/g,
      ),
    ].map((match) => [match[1], match[2]]);

    expect(pairs.length).toBe(Object.keys(OPS_ALERTS).length);
    expect(Object.fromEntries(pairs)).toEqual(
      Object.fromEntries(
        Object.entries(OPS_ALERTS).map(([id, alert]) => [id, alert.playbookIssue]),
      ),
    );
  });

  it.each(Object.entries(OPS_ALERTS))(
    "%s points at a playbook issue that exists",
    (_id, alert) => {
      const playbook = readRepoFile(alert.playbook);
      expect(playbook).toContain(`## \`${alert.playbookIssue}\``);
      expect(playbook).toContain(`id: ${alert.playbookIssue}`);
    },
  );

  it("names only columns that exist on the tables each branch reads", () => {
    // Columns this sprint's alert queries reference, per table. Verified
    // against the live schema (information_schema.columns) on 2026-09-24,
    // plus 20260924_139's own additions to creator_payment_accounts.
    const knownColumns = {
      p: [
        "id", "status", "updated_at", "currency", "total_checkout_cents",
        "listing_request_id", "tax_treatment", "paid_at",
        "tax_jurisdiction_country", "stripe_tax_calculation_id",
        "stripe_tax_transaction_id", "payment_schedule_item_id",
      ],
      co: [
        "id", "status", "changes_price", "price_delta", "buyer_accepted_at",
        "updated_at", "listing_request_id", "revised_total_amount",
      ],
      si: ["id", "change_order_id"],
      s: ["listing_request_id", "last_activity_at", "days_since_activity", "has_open_notice"],
      e: ["evidence_status", "conflicting_country"],
      r: [
        "id", "created_at", "payment_id", "stripe_refund_id",
        "tax_refund_cents", "stripe_tax_reversal_id",
      ],
      a: [
        "user_id", "stripe_account_id", "charges_enabled", "payouts_enabled",
        "details_submitted", "readiness_lost_at", "requirements_due_count",
        "requirements_past_due_count", "last_synced_at",
      ],
      l: ["user_id", "status", "is_active"],
    };

    const references = [
      ...listOpsAlertsBody.matchAll(/\b([a-z]{1,2})\.([a-z_]+)\b/g),
    ].filter(([, alias]) => alias in knownColumns);

    expect(references.length).toBeGreaterThan(40);

    for (const [whole, alias, column] of references) {
      expect(knownColumns[alias], whole).toContain(column);
    }
  });

  it("adds every creator_payment_accounts column the CON alerts read", () => {
    for (const column of [
      "readiness_lost_at",
      "requirements_due_count",
      "requirements_past_due_count",
      "stripe_state_observed_at",
    ]) {
      expect(migration).toMatch(new RegExp(`add column if not exists ${column}\\b`));
    }
  });
});

describe("planOpsAlertDigest", () => {
  const now = Date.parse("2026-09-24T12:00:00.000Z");
  const row = (alertId, subjectId, extra = {}) => ({
    alert_id: alertId,
    playbook_issue: OPS_ALERTS[alertId]?.playbookIssue ?? "OPS-003",
    subject_id: subjectId,
    observed_at: "2026-09-23T00:00:00.000Z",
    detail: {},
    ...extra,
  });

  it("sends nothing when nothing is open", () => {
    const plan = planOpsAlertDigest({ rows: [], state: [], now });

    expect(plan.send).toBe(false);
    expect(plan.upserts).toEqual([]);
  });

  it("emails a new alert and records that it was notified", () => {
    const plan = planOpsAlertDigest({
      rows: [row("stuck_payment", "pay-1")],
      state: [],
      now,
    });

    expect(plan.send).toBe(true);
    expect(plan.rows).toEqual([expect.objectContaining({ subject_id: "pay-1", isNew: true })]);
    expect(plan.upserts[0]).toMatchObject({
      alert_id: "stuck_payment",
      subject_id: "pay-1",
      playbook_issue: "PAY-005",
      last_notified_at: new Date(now).toISOString(),
    });
    expect(plan.pending[0].last_notified_at).toBeNull();
  });

  it("does not repeat an alert inside the reminder window", () => {
    const plan = planOpsAlertDigest({
      rows: [row("stuck_payment", "pay-1")],
      state: [
        {
          alert_id: "stuck_payment",
          subject_id: "pay-1",
          first_seen_at: "2026-09-24T10:00:00.000Z",
          last_notified_at: "2026-09-24T10:00:00.000Z",
        },
      ],
      now,
    });

    expect(plan.send).toBe(false);
    expect(plan.upserts[0].last_notified_at).toBe("2026-09-24T10:00:00.000Z");
  });

  it("reminds daily while an alert stays open, and includes it as not new", () => {
    const plan = planOpsAlertDigest({
      rows: [row("stuck_payment", "pay-1")],
      state: [
        {
          alert_id: "stuck_payment",
          subject_id: "pay-1",
          first_seen_at: "2026-09-23T11:00:00.000Z",
          last_notified_at: new Date(now - OPS_ALERT_REMINDER_MS).toISOString(),
        },
      ],
      now,
    });

    expect(plan.send).toBe(true);
    expect(plan.rows[0].isNew).toBe(false);
    expect(plan.upserts[0].first_seen_at).toBe("2026-09-23T11:00:00.000Z");
  });

  it("sends TAX-007 once only", () => {
    const plan = planOpsAlertDigest({
      rows: [row("paid_wave2_currency", "pay-eur")],
      state: [
        {
          alert_id: "paid_wave2_currency",
          subject_id: "pay-eur",
          first_seen_at: "2026-09-01T00:00:00.000Z",
          last_notified_at: "2026-09-01T00:00:00.000Z",
        },
      ],
      now,
    });

    expect(plan.send).toBe(false);
  });

  it("retries next run when the email fails, without losing first sight", () => {
    const plan = planOpsAlertDigest({
      rows: [row("tax_reversal_missing", "refund-1")],
      state: [],
      now,
    });

    expect(plan.pending).toEqual([
      expect.objectContaining({
        subject_id: "refund-1",
        first_seen_at: new Date(now).toISOString(),
        last_notified_at: null,
      }),
    ]);

    const nextRun = planOpsAlertDigest({
      rows: [row("tax_reversal_missing", "refund-1")],
      state: plan.pending,
      now: now + 3600 * 1000,
    });

    expect(nextRun.send).toBe(true);
    expect(nextRun.rows[0].isNew).toBe(true);
  });

  it("forgets resolved alerts, so a recurrence is new again", () => {
    const plan = planOpsAlertDigest({
      rows: [],
      state: [
        {
          alert_id: "stale_request",
          subject_id: "req-1",
          first_seen_at: "2026-09-20T00:00:00.000Z",
          last_notified_at: "2026-09-20T00:00:00.000Z",
        },
      ],
      now,
    });

    expect(plan.deletes).toEqual([{ alert_id: "stale_request", subject_id: "req-1" }]);
  });

  it("still emails an alert id the registry does not know, and reports it", () => {
    const plan = planOpsAlertDigest({
      rows: [row("mystery", "x")],
      state: [],
      now,
    });

    expect(plan.send).toBe(true);
    expect(plan.unknown).toEqual(["mystery"]);
  });

  it("collapses duplicate rows for the same subject", () => {
    const plan = planOpsAlertDigest({
      rows: [row("stale_request", "req-1"), row("stale_request", "req-1")],
      state: [],
      now,
    });

    expect(plan.rows).toHaveLength(1);
    expect(plan.upserts).toHaveLength(1);
  });
});

describe("renderOpsAlertDigest", () => {
  it("heads every group with its playbook issue and link", () => {
    const { subject, text, html } = renderOpsAlertDigest({
      rows: [
        {
          alert_id: "stuck_payment",
          playbook_issue: "PAY-005",
          subject_id: "pay-1",
          observed_at: "2026-09-23T00:00:00.000Z",
          detail: { status: "checkout_opened" },
          isNew: true,
        },
        {
          alert_id: "payment_account_lost_readiness",
          playbook_issue: "CON-003",
          subject_id: "user-<1>",
          observed_at: null,
          detail: null,
          isNew: false,
        },
      ],
      repoUrl: "https://github.com/Alvintol/creator-hub/blob/main",
    });

    expect(subject).toBe("[Made for Stream ops] 2 open alerts (1 new): CON-003, PAY-005");
    expect(text).toContain("PAY-005 -- Payment stuck in checkout_opened or processing (1)");
    expect(text).toContain(
      "Playbook: https://github.com/Alvintol/creator-hub/blob/main/docs/support/payments/checkout.md",
    );
    expect(text).toContain("[new] pay-1 since 2026-09-23T00:00:00.000Z -- status=checkout_opened");
    expect(text).toContain("CON-003 -- ");
    expect(html).toContain("user-&lt;1&gt;");
    expect(html).not.toContain("user-<1>");
  });
});

describe("isAuthorizedOpsRequest", () => {
  const secret = "s".repeat(40);

  it("accepts the exact bearer secret", () => {
    expect(isAuthorizedOpsRequest(`Bearer ${secret}`, secret, crypto.timingSafeEqual)).toBe(true);
  });

  it("refuses a wrong, missing or differently sized secret", () => {
    expect(isAuthorizedOpsRequest(`Bearer ${"t".repeat(40)}`, secret, crypto.timingSafeEqual)).toBe(false);
    expect(isAuthorizedOpsRequest(`Bearer ${secret}x`, secret, crypto.timingSafeEqual)).toBe(false);
    expect(isAuthorizedOpsRequest(undefined, secret, crypto.timingSafeEqual)).toBe(false);
    expect(isAuthorizedOpsRequest(secret, secret, crypto.timingSafeEqual)).toBe(false);
  });

  it("refuses everything when the secret is unset or too short", () => {
    expect(isAuthorizedOpsRequest("Bearer ", "", crypto.timingSafeEqual)).toBe(false);
    expect(isAuthorizedOpsRequest("Bearer short", "short", crypto.timingSafeEqual)).toBe(false);
  });
});
