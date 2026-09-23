// Sprint 6 (launch-scope.md section 7.1): a Postgres RPC cannot send an
// email, so after send_listing_request_first_notice /
// send_listing_request_final_notice write the notice row, this calls the
// Express follow-up that actually sends it -- the exact same best-effort
// pattern as drainFlaggedListingRequestRefunds.ts. If this call fails, the
// notice itself is still validly sent (the 7+7 day clock is a database
// fact, not an email fact); the notice's email_status just stays 'pending'
// or 'failed' for support to see.
const getApiBase = (): string =>
  (import.meta.env.VITE_API_BASE as string | undefined)?.trim() || "";

export const sendListingRequestNoticeEmail = async ({
  noticeId,
  accessToken,
}: {
  noticeId: string;
  accessToken: string | undefined;
}): Promise<void> => {
  if (!accessToken) {
    return;
  }

  try {
    await fetch(`${getApiBase()}/api/notices/${noticeId}/send-email`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
  } catch {
    // Best-effort -- see the comment above.
  }
};
