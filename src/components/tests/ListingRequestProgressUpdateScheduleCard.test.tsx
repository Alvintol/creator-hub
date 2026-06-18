import {
  render,
  screen,
} from "@testing-library/react";
import {
  describe,
  expect,
  it,
} from "vitest";

import ListingRequestProgressUpdateScheduleCard from "../listingRequests/progressUpdates/ListingRequestProgressUpdateScheduleCard";
import type { ListingRequestAgreementRow } from "../../hooks/creatorRequests/useListingRequestAgreement";
import type { ListingRequestProgressUpdateRow } from "../../hooks/creatorRequests/useListingRequestProgressUpdates";

type ScheduleAgreement = Pick<
  ListingRequestAgreementRow,
  | "status"
  | "starting_payment_status"
  | "minimum_update_rule"
  | "first_update_due_days"
  | "update_frequency_days"
  | "estimated_start_at"
  | "adjusted_estimated_completion_at"
>;

type ScheduleUpdate = Pick<
  ListingRequestProgressUpdateRow,
  "created_at"
>;

const createAgreement = (
  overrides?: Partial<ScheduleAgreement>
): ScheduleAgreement => ({
  status: "buyer_accepted",
  starting_payment_status: "paid",
  minimum_update_rule: "weekly_updates",
  first_update_due_days: 5,
  update_frequency_days: 7,
  estimated_start_at:
    "2026-06-01T12:00:00.000Z",
  adjusted_estimated_completion_at:
    "2026-06-30T12:00:00.000Z",
  ...overrides,
});

const createUpdate = (
  createdAt: string
): ScheduleUpdate => ({
  created_at: createdAt,
});

describe(
  "ListingRequestProgressUpdateScheduleCard",
  () => {
    it("does not render without an agreement", () => {
      render(
        <ListingRequestProgressUpdateScheduleCard
          agreement={null}
          updates={[]}
        />
      );

      expect(
        screen.queryByText("Update scheduled")
      ).not.toBeInTheDocument();
    });

    it("does not render before the buyer accepts the agreement", () => {
      render(
        <ListingRequestProgressUpdateScheduleCard
          agreement={createAgreement({
            status: "sent",
          })}
          updates={[]}
        />
      );

      expect(
        screen.queryByText(
          "Update schedule not started"
        )
      ).not.toBeInTheDocument();
    });

    it("shows that the schedule has not started while payment is required", () => {
      render(
        <ListingRequestProgressUpdateScheduleCard
          agreement={createAgreement({
            starting_payment_status:
              "payment_required",
          })}
          updates={[]}
          now={
            new Date(
              "2026-06-05T12:00:00.000Z"
            )
          }
        />
      );

      expect(
        screen.getByText(
          "Update schedule not started"
        )
      ).toBeInTheDocument();

      expect(
        screen.getByText(
          "The creator update schedule begins when the project is ready for work."
        )
      ).toBeInTheDocument();

      expect(
        screen.getByText("Not scheduled")
      ).toBeInTheDocument();
    });

    it("shows an upcoming update", () => {
      render(
        <ListingRequestProgressUpdateScheduleCard
          agreement={createAgreement()}
          updates={[]}
          now={
            new Date(
              "2026-06-02T12:00:00.000Z"
            )
          }
        />
      );

      expect(
        screen.getByText("Update scheduled")
      ).toBeInTheDocument();

      expect(
        screen.getByText("Upcoming")
      ).toBeInTheDocument();

      expect(
        screen.getByText(/Jun 6, 2026/)
      ).toBeInTheDocument();
    });

    it("shows when the next update is due soon", () => {
      render(
        <ListingRequestProgressUpdateScheduleCard
          agreement={createAgreement()}
          updates={[]}
          now={
            new Date(
              "2026-06-05T12:00:00.000Z"
            )
          }
        />
      );

      expect(
        screen.getByText("Update due soon")
      ).toBeInTheDocument();

      expect(
        screen.getByText("Due soon")
      ).toBeInTheDocument();

      expect(
        screen.getByText(
          "The next required creator update is due soon."
        )
      ).toBeInTheDocument();
    });

    it("shows when the next update is overdue", () => {
      render(
        <ListingRequestProgressUpdateScheduleCard
          agreement={createAgreement()}
          updates={[]}
          now={
            new Date(
              "2026-06-07T12:00:00.000Z"
            )
          }
        />
      );

      expect(
        screen.getByText("Update overdue")
      ).toBeInTheDocument();

      expect(
        screen.getByText("Overdue")
      ).toBeInTheDocument();

      expect(
        screen.getByText(
          "The next required creator update is overdue."
        )
      ).toBeInTheDocument();
    });

    it("shows the most recent update and completed count", () => {
      render(
        <ListingRequestProgressUpdateScheduleCard
          agreement={createAgreement()}
          updates={[
            createUpdate(
              "2026-06-03T12:00:00.000Z"
            ),
            createUpdate(
              "2026-06-08T12:00:00.000Z"
            ),
          ]}
          now={
            new Date(
              "2026-06-10T12:00:00.000Z"
            )
          }
        />
      );

      expect(
        screen.getByText(/Jun 8, 2026/)
      ).toBeInTheDocument();

      expect(
        screen.getByText("Updates posted")
      ).toBeInTheDocument();

      expect(
        screen.getByText("2")
      ).toBeInTheDocument();
    });

    it("shows a satisfied single-update requirement", () => {
      render(
        <ListingRequestProgressUpdateScheduleCard
          agreement={createAgreement({
            minimum_update_rule:
              "single_progress_update",
            first_update_due_days: null,
            update_frequency_days: null,
          })}
          updates={[
            createUpdate(
              "2026-06-04T12:00:00.000Z"
            ),
          ]}
          now={
            new Date(
              "2026-06-05T12:00:00.000Z"
            )
          }
        />
      );

      expect(
        screen.getByText(
          "Update requirement satisfied"
        )
      ).toBeInTheDocument();

      expect(
        screen.getByText("Satisfied")
      ).toBeInTheDocument();

      expect(
        screen.getByText(
          "The required project progress update has been posted."
        )
      ).toBeInTheDocument();

      expect(
        screen.getByText("Requirement completed")
      ).toBeInTheDocument();
    });
  }
);