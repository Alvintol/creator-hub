import {
  describe,
  expect,
  it,
} from "vitest";

import {
  conversationCloseReasonOptions,
  getConversationCloseReasonLabel,
} from "../conversations/conversations";

describe("conversations", () => {
  it("labels automatically completed project conversations", () => {
    expect(
      getConversationCloseReasonLabel(
        "project_completed"
      )
    ).toBe("Project completed");
  });

  it("does not offer project completion as a manual close reason", () => {
    expect(
      conversationCloseReasonOptions.some(
        (option) =>
          option.value === "project_completed"
      )
    ).toBe(false);
  });
});