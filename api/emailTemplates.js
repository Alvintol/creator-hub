// Sprint 6 (launch-scope.md section 7.1): the four launch templates --
// payment receipt, first notice, final notice, payout released. Deliberately
// plain (a wrapper + a heading + a paragraph or two + a link) rather than a
// branded HTML layout -- there is no design system for transactional email
// in this repo yet, and a plain, readable template beats an unfinished
// branded one. Revisit once there's a reason to invest in one.

const wrap = (title, bodyHtml, ctaUrl, ctaLabel) => `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;padding:32px;">
            <tr><td>
              <h1 style="font-size:18px;margin:0 0 16px;">${title}</h1>
              ${bodyHtml}
              ${
                ctaUrl
                  ? `<p style="margin:24px 0 0;"><a href="${ctaUrl}" style="background:#18181b;color:#ffffff;padding:10px 18px;border-radius:6px;text-decoration:none;font-size:14px;">${ctaLabel}</a></p>`
                  : ""
              }
              <p style="margin:32px 0 0;color:#71717a;font-size:12px;">Made for Stream</p>
            </td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

const formatCents = (cents, currency) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (currency || "usd").toUpperCase(),
  }).format((cents || 0) / 100);

export const renderPaymentReceiptEmail = ({
  requestTitle,
  amountCents,
  currency,
  requestUrl,
}) => {
  const amount = formatCents(amountCents, currency);
  const subject = `Receipt: ${amount} for "${requestTitle}"`;

  return {
    subject,
    text: `We received your payment of ${amount} for "${requestTitle}". View the request: ${requestUrl}`,
    html: wrap(
      "Payment received",
      `<p style="margin:0 0 8px;font-size:14px;line-height:1.5;">We received your payment of <strong>${amount}</strong> for "${requestTitle}".</p>`,
      requestUrl,
      "View request",
    ),
  };
};

export const renderFirstNoticeEmail = ({
  requestTitle,
  requestedAction,
  expiresAt,
  requestUrl,
}) => {
  const subject = `Action needed on "${requestTitle}"`;
  const expiresLabel = new Date(expiresAt).toLocaleString();

  return {
    subject,
    text: `A notice was sent on "${requestTitle}": ${requestedAction}. Please reply by ${expiresLabel}. ${requestUrl}`,
    html: wrap(
      "A reply is needed",
      `<p style="margin:0 0 8px;font-size:14px;line-height:1.5;">On <strong>${requestTitle}</strong>, the other party needs: ${requestedAction}</p>
       <p style="margin:0 0 8px;font-size:14px;line-height:1.5;">Please reply by <strong>${expiresLabel}</strong>. A final notice may follow if there is no reply.</p>`,
      requestUrl,
      "Open request",
    ),
  };
};

export const renderFinalNoticeEmail = ({
  requestTitle,
  requestedAction,
  expiresAt,
  requestUrl,
}) => {
  const subject = `Final notice: "${requestTitle}"`;
  const expiresLabel = new Date(expiresAt).toLocaleString();

  return {
    subject,
    text: `Final notice on "${requestTitle}": ${requestedAction}. This grants a further 7 days, until ${expiresLabel}. Administrative closure may follow. ${requestUrl}`,
    html: wrap(
      "Final notice",
      `<p style="margin:0 0 8px;font-size:14px;line-height:1.5;">This is a <strong>final notice</strong> on "${requestTitle}": ${requestedAction}</p>
       <p style="margin:0 0 8px;font-size:14px;line-height:1.5;">You have until <strong>${expiresLabel}</strong> to reply. After that, the other party may request that Made for Stream administratively close this project.</p>`,
      requestUrl,
      "Open request",
    ),
  };
};

export const renderPayoutReleasedEmail = ({
  amountCents,
  currency,
  arrivalDate,
  requestUrl,
}) => {
  const amount = formatCents(amountCents, currency);
  const subject = `Payout released: ${amount}`;

  return {
    subject,
    text: `A payout of ${amount} was released and is on its way to your bank${
      arrivalDate ? ` (expected ${arrivalDate})` : ""
    }. ${requestUrl}`,
    html: wrap(
      "Payout released",
      `<p style="margin:0 0 8px;font-size:14px;line-height:1.5;">A payout of <strong>${amount}</strong> was released from your held balance and is on its way to your bank${
        arrivalDate ? ` (expected ${arrivalDate})` : ""
      }.</p>`,
      requestUrl,
      "View payouts",
    ),
  };
};
