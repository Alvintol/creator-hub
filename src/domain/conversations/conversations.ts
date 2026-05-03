export type ConversationType =
  | "creator_inquiry"
  | "listing_inquiry"
  | "listing_request";

export type ConversationStatus = "open" | "closed" | "admin_locked";

export type ConversationMessageType =
  | "text"
  | "system"
  | "attachment"
  | "mixed";

export type ConversationCloseReasonCode =
  | "question_answered"
  | "not_moving_forward"
  | "not_a_fit"
  | "duplicate_conversation"
  | "unresponsive"
  | "unwanted_messages"
  | "other";

export type BuyerImageUploadStatus =
  | "blocked"
  | "requested"
  | "approved"
  | "revoked";

export type ConversationReportReasonCode =
  | "spam"
  | "harassment"
  | "scam_or_suspicious"
  | "inappropriate_content"
  | "unsolicited_images"
  | "off_platform_payment"
  | "other";

export type ConversationReportStatus =
  | "submitted"
  | "reviewing"
  | "needs_more_info"
  | "action_taken"
  | "resolved"
  | "dismissed";

export type ConversationReportResolutionCode =
  | "warning_issued"
  | "content_removed"
  | "conversation_locked"
  | "account_restricted"
  | "no_violation_found"
  | "insufficient_information"
  | "duplicate_report"
  | "other";

export const conversationReportStatusOptions: Array<{
  value: ConversationReportStatus;
  label: string;
}> = [
    { value: "submitted", label: "Submitted" },
    { value: "reviewing", label: "Under review" },
    { value: "needs_more_info", label: "Needs more info" },
    { value: "action_taken", label: "Action taken" },
    { value: "resolved", label: "Resolved" },
    { value: "dismissed", label: "Dismissed" },
  ];

export const conversationReportResolutionOptions: Array<{
  value: ConversationReportResolutionCode;
  label: string;
}> = [
    { value: "warning_issued", label: "Warning issued" },
    { value: "content_removed", label: "Content removed" },
    { value: "conversation_locked", label: "Conversation locked" },
    { value: "account_restricted", label: "Account restricted" },
    { value: "no_violation_found", label: "No violation found" },
    { value: "insufficient_information", label: "Insufficient information" },
    { value: "duplicate_report", label: "Duplicate report" },
    { value: "other", label: "Other" },
  ];

export const getConversationReportReasonLabel = (
  reasonCode: ConversationReportReasonCode
): string =>
  conversationReportReasonOptions.find((option) => option.value === reasonCode)
    ?.label ?? "Unknown reason";

export const getConversationReportResolutionLabel = (
  resolutionCode: ConversationReportResolutionCode | null
): string =>
  resolutionCode
    ? conversationReportResolutionOptions.find(
      (option) => option.value === resolutionCode
    )?.label ?? "Unknown resolution"
    : "No resolution selected";
export const getConversationReportStatusLabel = (
  status: ConversationReportStatus
): string =>
  status === "submitted"
    ? "Submitted"
    : status === "reviewing"
      ? "Under review"
      : status === "needs_more_info"
        ? "Needs more info"
        : status === "action_taken"
          ? "Action taken"
          : status === "resolved"
            ? "Resolved"
            : "Dismissed";

export const getConversationReportStatusSummary = (
  status: ConversationReportStatus
): string =>
  status === "submitted"
    ? "Your report has been received."
    : status === "reviewing"
      ? "An admin is reviewing this report."
      : status === "needs_more_info"
        ? "An admin needs more information from you."
        : status === "action_taken"
          ? "An admin reviewed this report and took appropriate action."
          : status === "resolved"
            ? "This report has been reviewed and resolved."
            : "This report was reviewed and dismissed.";

export const conversationReportReasonOptions: Array<{
  value: ConversationReportReasonCode;
  label: string;
}> = [
    { value: "spam", label: "Spam or repeated unwanted messages" },
    { value: "harassment", label: "Harassment or abusive behaviour" },
    { value: "scam_or_suspicious", label: "Scam or suspicious behaviour" },
    { value: "inappropriate_content", label: "Inappropriate content" },
    { value: "unsolicited_images", label: "Unsolicited images or references" },
    { value: "off_platform_payment", label: "Asked to move payment off-platform" },
    { value: "other", label: "Other" },
  ];

export const getBuyerImageUploadStatusLabel = (
  status: BuyerImageUploadStatus
): string =>
  status === "blocked"
    ? "Image uploads blocked"
    : status === "requested"
      ? "Image upload access requested"
      : status === "approved"
        ? "Image uploads allowed"
        : "Image uploads disabled";

export const conversationCloseReasonOptions: Array<{
  value: ConversationCloseReasonCode;
  label: string;
}> = [
    { value: "question_answered", label: "My question was answered" },
    { value: "not_moving_forward", label: "I am not moving forward" },
    { value: "not_a_fit", label: "This is not a good fit" },
    { value: "duplicate_conversation", label: "This is a duplicate conversation" },
    { value: "unresponsive", label: "The other person is not responding" },
    { value: "unwanted_messages", label: "I do not want more messages in this thread" },
    { value: "other", label: "Other" },
  ];

export const getConversationCloseReasonLabel = (
  reasonCode: ConversationCloseReasonCode | null
): string => {
  const option = conversationCloseReasonOptions.find(
    (currentOption) => currentOption.value === reasonCode
  );

  return option?.label ?? "Unknown reason";
};

export const canSendConversationMessage = (
  status: ConversationStatus
): boolean => status === "open";

export const isConversationReadOnly = (
  status: ConversationStatus
): boolean => status !== "open";