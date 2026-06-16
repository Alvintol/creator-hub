import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import ListingRequestMilestoneSubmissionForm from "../listingRequests/milestones/ListingRequestMilestoneSubmissionForm";

const pendingMilestone = {
  id: "milestone-1",
  status: "pending" as const,
  title: "Initial design direction",
  sort_order: 0,
};

const fillValidSubmission = () => {
  fireEvent.change(
    screen.getByLabelText(
      "Milestone submission summary"
    ),
    {
      target: {
        value:
          " The initial design concepts are ready for buyer review. ",
      },
    }
  );

  fireEvent.change(
    screen.getByLabelText(
      "Milestone delivery links"
    ),
    {
      target: {
        value:
          " https://example.com/concepts \n\nhttps://example.com/source-files ",
      },
    }
  );
};

describe(
  "ListingRequestMilestoneSubmissionForm",
  () => {
    it("does not render without a milestone", () => {
      render(
        <ListingRequestMilestoneSubmissionForm
          milestone={null}
          onSubmitMilestone={vi.fn()}
        />
      );

      expect(
        screen.queryByText(
          "Submit milestone"
        )
      ).not.toBeInTheDocument();
    });

    it("does not render for a milestone awaiting buyer review", () => {
      render(
        <ListingRequestMilestoneSubmissionForm
          milestone={{
            ...pendingMilestone,
            status: "submitted",
          }}
          onSubmitMilestone={vi.fn()}
        />
      );

      expect(
        screen.queryByRole("button", {
          name: "Submit milestone for review",
        })
      ).not.toBeInTheDocument();
    });

    it("renders the pending milestone", () => {
      render(
        <ListingRequestMilestoneSubmissionForm
          milestone={pendingMilestone}
          onSubmitMilestone={vi.fn()}
        />
      );

      expect(
        screen.getByRole("heading", {
          name: "Submit milestone",
        })
      ).toBeInTheDocument();

      expect(
        screen.getByText(
          "Initial design direction"
        )
      ).toBeInTheDocument();

      expect(
        screen.getByText("Milestone 1")
      ).toBeInTheDocument();
    });

    it("shows validation errors for a missing summary", () => {
      const onSubmitMilestone = vi.fn();

      render(
        <ListingRequestMilestoneSubmissionForm
          milestone={pendingMilestone}
          onSubmitMilestone={
            onSubmitMilestone
          }
        />
      );

      fireEvent.click(
        screen.getByRole("button", {
          name: "Submit milestone for review",
        })
      );

      expect(
        screen.getByText(
          "Milestone submission summary must be between 10 and 4000 characters."
        )
      ).toBeInTheDocument();

      expect(
        onSubmitMilestone
      ).not.toHaveBeenCalled();
    });

    it("submits normalized milestone details", async () => {
      const onSubmitMilestone = vi.fn();

      render(
        <ListingRequestMilestoneSubmissionForm
          milestone={pendingMilestone}
          onSubmitMilestone={
            onSubmitMilestone
          }
        />
      );

      fillValidSubmission();

      fireEvent.click(
        screen.getByRole("button", {
          name: "Submit milestone for review",
        })
      );

      await waitFor(() => {
        expect(
          onSubmitMilestone
        ).toHaveBeenCalledWith({
          milestoneId: "milestone-1",
          summary:
            "The initial design concepts are ready for buyer review.",
          deliveryLinks: [
            "https://example.com/concepts",
            "https://example.com/source-files",
          ],
        });
      });
    });

    it("renders revision resubmission state", () => {
      render(
        <ListingRequestMilestoneSubmissionForm
          milestone={{
            ...pendingMilestone,
            status: "revision_requested",
          }}
          onSubmitMilestone={vi.fn()}
        />
      );

      expect(
        screen.getByRole("heading", {
          name: "Resubmit milestone",
        })
      ).toBeInTheDocument();

      expect(
        screen.getByText(
          /The buyer requested revisions/
        )
      ).toBeInTheDocument();

      expect(
        screen.getByRole("button", {
          name: "Resubmit milestone for review",
        })
      ).toBeInTheDocument();
    });

    it("rejects more than 20 delivery links", () => {
      const onSubmitMilestone = vi.fn();

      render(
        <ListingRequestMilestoneSubmissionForm
          milestone={pendingMilestone}
          onSubmitMilestone={
            onSubmitMilestone
          }
        />
      );

      fireEvent.change(
        screen.getByLabelText(
          "Milestone submission summary"
        ),
        {
          target: {
            value:
              "The initial design concepts are ready.",
          },
        }
      );

      fireEvent.change(
        screen.getByLabelText(
          "Milestone delivery links"
        ),
        {
          target: {
            value: Array.from(
              {
                length: 21,
              },
              (_, index) =>
                `https://example.com/file-${index + 1}`
            ).join("\n"),
          },
        }
      );

      fireEvent.click(
        screen.getByRole("button", {
          name: "Submit milestone for review",
        })
      );

      expect(
        screen.getByText(
          "A milestone submission can contain no more than 20 delivery links."
        )
      ).toBeInTheDocument();

      expect(
        onSubmitMilestone
      ).not.toHaveBeenCalled();
    });

    it("renders submission errors", () => {
      render(
        <ListingRequestMilestoneSubmissionForm
          milestone={pendingMilestone}
          error={
            new Error(
              "Earlier milestones must be completed first."
            )
          }
          onSubmitMilestone={vi.fn()}
        />
      );

      expect(
        screen.getByText(
          "Earlier milestones must be completed first."
        )
      ).toBeInTheDocument();
    });

    it("disables the form while submitting", () => {
      render(
        <ListingRequestMilestoneSubmissionForm
          milestone={pendingMilestone}
          isPending
          onSubmitMilestone={vi.fn()}
        />
      );

      expect(
        screen.getByRole("button", {
          name: "Submitting milestone…",
        })
      ).toBeDisabled();

      expect(
        screen.getByLabelText(
          "Milestone submission summary"
        )
      ).toBeDisabled();

      expect(
        screen.getByLabelText(
          "Milestone delivery links"
        )
      ).toBeDisabled();
    });
  }
);