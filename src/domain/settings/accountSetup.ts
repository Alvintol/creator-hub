export type AccountSetupStepKey = "profile" | "connections" | "creator" | "payouts";

// optional: available but not expected of every member (e.g. applying to sell).
export type AccountSetupStepState = "done" | "todo" | "waiting" | "locked" | "optional";

export type AccountSetupStep = {
  key: AccountSetupStepKey;
  label: string;
  detail: string;
  state: AccountSetupStepState;
  actionLabel: string;
};

export type AccountSetupInput = {
  profileReady: boolean;
  hasLinkedPlatform: boolean;
  applicationStatus:
    | "draft"
    | "submitted"
    | "under_review"
    | "approved"
    | "rejected"
    | "needs_changes"
    | "suspended"
    | null;
  payoutsReady: boolean;
};

const creatorStep = (status: AccountSetupInput["applicationStatus"]): AccountSetupStep => {
  const base = { key: "creator" as const, label: "Creator access" };

  switch (status) {
    case "approved":
      return { ...base, state: "done", detail: "Approved creator", actionLabel: "View access" };
    case "submitted":
    case "under_review":
      return {
        ...base,
        state: "waiting",
        detail: "Application is with Made for Stream review",
        actionLabel: "View application",
      };
    case "needs_changes":
      return { ...base, state: "todo", detail: "Reviewers asked for changes", actionLabel: "Update application" };
    case "draft":
      return { ...base, state: "todo", detail: "Application in progress", actionLabel: "Continue application" };
    case "rejected":
    case "suspended":
      return {
        ...base,
        state: "locked",
        detail: status === "rejected" ? "Application was not approved" : "Creator access is suspended",
        actionLabel: "View status",
      };
    default:
      return { ...base, state: "optional", detail: "Apply if you want to sell on Made for Stream", actionLabel: "Start application" };
  }
};

// Ordered setup steps for the settings checklist; later steps depend on earlier ones.
export const getAccountSetupSteps = (input: AccountSetupInput): AccountSetupStep[] => {
  const isCreator = input.applicationStatus === "approved";

  return [
    {
      key: "profile",
      label: "Public profile",
      state: input.profileReady ? "done" : "todo",
      detail: input.profileReady ? "Handle and display name set" : "Add a handle and display name",
      actionLabel: "Edit profile",
    },
    {
      key: "connections",
      label: "Connected platforms",
      state: input.hasLinkedPlatform ? "done" : "todo",
      detail: input.hasLinkedPlatform ? "Platform linked" : "Link Twitch to build trust",
      actionLabel: "Connect",
    },
    creatorStep(input.applicationStatus),
    {
      key: "payouts",
      label: "Payouts",
      state: !isCreator ? "locked" : input.payoutsReady ? "done" : "todo",
      detail: !isCreator
        ? "Unlocks after creator approval"
        : input.payoutsReady
          ? "Stripe is ready for payouts"
          : "Finish Stripe setup to get paid",
      actionLabel: "Set up payouts",
    },
  ];
};

// The first step the viewer can act on, or null when nothing is pending.
export const getNextAccountSetupStep = (steps: AccountSetupStep[]): AccountSetupStep | null =>
  steps.find((step) => step.state === "todo") ?? null;

export const getAccountSetupProgress = (steps: AccountSetupStep[]) => {
  const applicable = steps.filter((step) => step.state !== "locked" && step.state !== "optional");

  return {
    done: applicable.filter((step) => step.state === "done").length,
    total: applicable.length,
  };
};
