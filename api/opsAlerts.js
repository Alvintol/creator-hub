// Sprint 9: operational alerting. public.list_ops_alerts() (20260924_139)
// returns every open alert; this module decides what to email and renders
// the digest. Delivery is api/email.js to OPS_ALERT_EMAIL. The route is
// POST /api/internal/ops/alerts/run, called hourly by Cloud Scheduler.
// Playbook: docs/support/operations/alerting.md.

// One entry per branch of list_ops_alerts(). `remind: false` means the alert
// is emailed once per subject and never repeated -- used where a row never
// resolves on its own. opsAlerts.test.js checks this list against the
// migration and against the playbooks.
export const OPS_ALERTS = {
  stuck_payment: {
    playbookIssue: "PAY-005",
    playbook: "docs/support/payments/checkout.md",
    title: "Payment stuck in checkout_opened or processing",
    remind: true,
  },
  change_order_payment_missing: {
    playbookIssue: "CHG-003",
    playbook: "docs/support/requests/change-orders.md",
    title: "Accepted change order did not create its payment",
    remind: true,
  },
  stale_request: {
    playbookIssue: "REQ-003",
    playbook: "docs/support/requests/request-lifecycle.md",
    title: "Request not advanced in 14+ days",
    remind: true,
  },
  tax_evidence_insufficient: {
    playbookIssue: "TAX-002",
    playbook: "docs/support/payments/tax.md",
    title: "Taxed payment's location evidence is insufficient or contradictory",
    remind: true,
  },
  tax_transaction_missing: {
    playbookIssue: "TAX-003",
    playbook: "docs/support/payments/tax.md",
    title: "Taxed payment missing its Stripe Tax transaction",
    remind: true,
  },
  tax_reversal_missing: {
    playbookIssue: "TAX-004",
    playbook: "docs/support/payments/tax.md",
    title: "Refund returned tax but Stripe Tax was not reversed",
    remind: true,
  },
  paid_wave2_currency: {
    playbookIssue: "TAX-007",
    playbook: "docs/support/payments/tax.md",
    title: "Paid sale in a currency other than CAD or USD (tax advice still open)",
    remind: false,
  },
  payment_account_lost_readiness: {
    playbookIssue: "CON-003",
    playbook: "docs/support/payments/connect-onboarding.md",
    title: "Creator's Stripe account lost readiness while listings are live",
    remind: true,
  },
  payment_account_mirror_stale: {
    playbookIssue: "CON-006",
    playbook: "docs/support/payments/connect-onboarding.md",
    title: "Payment account mirror not refreshed in 48 hours",
    remind: true,
  },
};

export const OPS_ALERT_REMINDER_MS = 24 * 60 * 60 * 1000;

const alertKey = (alertId, subjectId) => `${alertId}\u0000${subjectId}`;

// rows: list_ops_alerts() output. state: ops_alert_notifications rows.
// Returns what to email and how to update the state table:
//   send       -- whether to send a digest this run
//   rows       -- the rows to include (each with isNew), when sending
//   unknown    -- alert ids the registry does not know (a code bug; they
//                 are still emailed, under their own id)
//   upserts    -- state rows to write if the send succeeds
//   pending    -- state rows to write if it does not (records first sight
//                 without claiming a notification, so the next run retries)
//   deletes    -- resolved subjects to remove from state
export const planOpsAlertDigest = ({
  rows,
  state,
  now = Date.now(),
  reminderMs = OPS_ALERT_REMINDER_MS,
}) => {
  const current = Array.isArray(rows) ? rows : [];
  const known = new Map(
    (Array.isArray(state) ? state : []).map((entry) => [
      alertKey(entry.alert_id, entry.subject_id),
      entry,
    ]),
  );

  const nowIso = new Date(now).toISOString();
  const seen = new Set();
  const included = [];
  const upserts = [];
  const pending = [];
  const unknown = new Set();

  for (const row of current) {
    const key = alertKey(row.alert_id, row.subject_id);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    const definition = OPS_ALERTS[row.alert_id];

    if (!definition) {
      unknown.add(row.alert_id);
    }

    const previous = known.get(key);
    const lastNotified = previous?.last_notified_at
      ? Date.parse(previous.last_notified_at)
      : null;
    const isNew = lastNotified === null;
    const remind = definition ? definition.remind : true;
    const reminderDue =
      !isNew && remind && now - lastNotified >= reminderMs;

    const base = {
      alert_id: row.alert_id,
      subject_id: row.subject_id,
      playbook_issue: row.playbook_issue,
      first_seen_at: previous?.first_seen_at || nowIso,
    };

    if (isNew || reminderDue) {
      included.push({ ...row, isNew });
      upserts.push({ ...base, last_notified_at: nowIso });
      pending.push({ ...base, last_notified_at: previous?.last_notified_at ?? null });
    } else {
      upserts.push({ ...base, last_notified_at: previous.last_notified_at });
      pending.push({ ...base, last_notified_at: previous.last_notified_at });
    }
  }

  const deletes = [...known.values()]
    .filter((entry) => !seen.has(alertKey(entry.alert_id, entry.subject_id)))
    .map((entry) => ({ alert_id: entry.alert_id, subject_id: entry.subject_id }));

  return {
    send: included.length > 0,
    rows: included,
    unknown: [...unknown],
    upserts,
    pending,
    deletes,
  };
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const describeDetail = (detail) => {
  if (!detail || typeof detail !== "object") {
    return "";
  }

  return Object.entries(detail)
    .map(([key, value]) => `${key}=${value === null ? "null" : String(value)}`)
    .join(", ");
};

// Groups rows by alert, each group headed by its playbook issue, so the
// reader goes straight from the email to the fix.
export const renderOpsAlertDigest = ({ rows, repoUrl = "" }) => {
  const groups = new Map();

  for (const row of rows) {
    if (!groups.has(row.alert_id)) {
      groups.set(row.alert_id, []);
    }

    groups.get(row.alert_id).push(row);
  }

  const newCount = rows.filter((row) => row.isNew).length;
  const issues = [...new Set(rows.map((row) => row.playbook_issue))].sort();

  const subject = `[Made for Stream ops] ${rows.length} open alert${
    rows.length === 1 ? "" : "s"
  }${newCount ? ` (${newCount} new)` : ""}: ${issues.join(", ")}`;

  const textSections = [];
  const htmlSections = [];

  for (const [alertId, groupRows] of groups) {
    const definition = OPS_ALERTS[alertId];
    const issue = groupRows[0].playbook_issue;
    const title = definition?.title || `Unregistered alert ${alertId}`;
    const playbook = definition?.playbook || "docs/support/operations/alerting.md";
    const playbookRef = repoUrl ? `${repoUrl}/${playbook}` : playbook;

    textSections.push(
      [
        `${issue} -- ${title} (${groupRows.length})`,
        `Playbook: ${playbookRef}`,
        ...groupRows.map(
          (row) =>
            `  ${row.isNew ? "[new] " : ""}${row.subject_id}` +
            `${row.observed_at ? ` since ${row.observed_at}` : ""}` +
            `${row.detail ? ` -- ${describeDetail(row.detail)}` : ""}`,
        ),
      ].join("\n"),
    );

    htmlSections.push(
      `<h2 style="font-size:16px;margin:24px 0 4px">${escapeHtml(issue)} &mdash; ${escapeHtml(title)} (${groupRows.length})</h2>` +
        `<p style="margin:0 0 8px;font-size:13px">Playbook: ${escapeHtml(playbookRef)}</p>` +
        `<ul style="margin:0;padding-left:20px;font-size:13px">${groupRows
          .map(
            (row) =>
              `<li>${row.isNew ? "<strong>[new]</strong> " : ""}<code>${escapeHtml(row.subject_id)}</code>` +
              `${row.observed_at ? ` since ${escapeHtml(row.observed_at)}` : ""}` +
              `${row.detail ? ` &mdash; ${escapeHtml(describeDetail(row.detail))}` : ""}</li>`,
          )
          .join("")}</ul>`,
    );
  }

  const footer =
    "Each alert is sent once, then repeated daily while it stays open " +
    "(TAX-007 is sent once only). See docs/support/operations/alerting.md.";

  return {
    subject,
    text: `${textSections.join("\n\n")}\n\n${footer}\n`,
    html: `<div style="font-family:system-ui,sans-serif">${htmlSections.join("")}<p style="margin-top:24px;font-size:12px;color:#666">${escapeHtml(footer)}</p></div>`,
  };
};

// Cloud Scheduler sends "Authorization: Bearer <OPS_CRON_SECRET>". Returns
// false when the secret is unset, so an unconfigured deploy refuses rather
// than running the jobs for anyone. Constant-time over equal-length input.
export const isAuthorizedOpsRequest = (authorizationHeader, secret, timingSafeEqual) => {
  if (!secret || typeof secret !== "string" || secret.length < 32) {
    return false;
  }

  const match = /^Bearer (.+)$/.exec(String(authorizationHeader || ""));

  if (!match) {
    return false;
  }

  const given = Buffer.from(match[1]);
  const expected = Buffer.from(secret);

  if (given.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(given, expected);
};
