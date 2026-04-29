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