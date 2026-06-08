import {
  describe,
  expect,
  it,
} from "vitest";

import type { ListingRequestAgreementRow } from "../../hooks/creatorRequests/useListingRequestAgreement";
import type { ListingRequestProgressUpdateRow } from "../../hooks/creatorRequests/useListingRequestProgressUpdates";
import { getListingRequestProgressUpdateSchedule } from "../listings/listingRequestProgressUpdates";

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

describe("getListingRequestProgressUpdateSchedule", () => {
  it("does not start the schedule before buyer acceptance", () => {
    const schedule =
      getListingRequestProgressUpdateSchedule({
        agreement: createAgreement({
          status: "sent",
        }),
        updates: [],
        now: new Date(
          "2026-06-05T12:00:00.000Z"
        ),
      });

    expect(schedule).toEqual({
      status: "not_started",
      nextUpdateDueAt: null,
      lastUpdateAt: null,
      completedUpdateCount: 0,
      summary:
        "The creator update schedule begins when the project is ready for work.",
    });
  });

  it("does not start the schedule while payment is required", () => {
    const schedule =
      getListingRequestProgressUpdateSchedule({
        agreement: createAgreement({
          starting_payment_status:
            "payment_required",
        }),
        updates: [],
        now: new Date(
          "2026-06-05T12:00:00.000Z"
        ),
      });

    expect(schedule.status).toBe("not_started");
    expect(schedule.nextUpdateDueAt).toBeNull();
  });

  it("calculates the first weekly update from the work start date", () => {
    const schedule =
      getListingRequestProgressUpdateSchedule({
        agreement: createAgreement(),
        updates: [],
        now: new Date(
          "2026-06-02T12:00:00.000Z"
        ),
      });

    expect(schedule.status).toBe("upcoming");
    expect(schedule.nextUpdateDueAt).toBe(
      "2026-06-06T12:00:00.000Z"
    );
    expect(schedule.completedUpdateCount).toBe(0);
  });

  it("marks a weekly update as due soon within two days", () => {
    const schedule =
      getListingRequestProgressUpdateSchedule({
        agreement: createAgreement(),
        updates: [],
        now: new Date(
          "2026-06-05T12:00:00.000Z"
        ),
      });

    expect(schedule.status).toBe("due_soon");
    expect(schedule.summary).toBe(
      "The next required creator update is due soon."
    );
  });

  it("marks a weekly update as overdue after its due date", () => {
    const schedule =
      getListingRequestProgressUpdateSchedule({
        agreement: createAgreement(),
        updates: [],
        now: new Date(
          "2026-06-07T12:00:00.000Z"
        ),
      });

    expect(schedule.status).toBe("overdue");
    expect(schedule.summary).toBe(
      "The next required creator update is overdue."
    );
  });

  it("calculates the next weekly update from the most recent valid update", () => {
    const schedule =
      getListingRequestProgressUpdateSchedule({
        agreement: createAgreement(),
        updates: [
          createUpdate(
            "2026-06-03T12:00:00.000Z"
          ),
          createUpdate(
            "2026-06-08T12:00:00.000Z"
          ),
        ],
        now: new Date(
          "2026-06-10T12:00:00.000Z"
        ),
      });

    expect(schedule.status).toBe("upcoming");
    expect(schedule.lastUpdateAt).toBe(
      "2026-06-08T12:00:00.000Z"
    );
    expect(schedule.nextUpdateDueAt).toBe(
      "2026-06-15T12:00:00.000Z"
    );
    expect(schedule.completedUpdateCount).toBe(2);
  });

  it("ignores invalid update dates", () => {
    const schedule =
      getListingRequestProgressUpdateSchedule({
        agreement: createAgreement(),
        updates: [
          createUpdate("not-a-date"),
          createUpdate(
            "2026-06-08T12:00:00.000Z"
          ),
        ],
        now: new Date(
          "2026-06-10T12:00:00.000Z"
        ),
      });

    expect(schedule.completedUpdateCount).toBe(1);
    expect(schedule.lastUpdateAt).toBe(
      "2026-06-08T12:00:00.000Z"
    );
  });

  it("uses the adjusted completion date for a single required update", () => {
    const schedule =
      getListingRequestProgressUpdateSchedule({
        agreement: createAgreement({
          minimum_update_rule:
            "single_progress_update",
          first_update_due_days: null,
          update_frequency_days: null,
        }),
        updates: [],
        now: new Date(
          "2026-06-20T12:00:00.000Z"
        ),
      });

    expect(schedule.status).toBe("upcoming");
    expect(schedule.nextUpdateDueAt).toBe(
      "2026-06-30T12:00:00.000Z"
    );
    expect(schedule.summary).toBe(
      "At least one project progress update is required before final delivery."
    );
  });

  it("marks the single update requirement as satisfied after one update", () => {
    const schedule =
      getListingRequestProgressUpdateSchedule({
        agreement: createAgreement({
          minimum_update_rule:
            "single_progress_update",
          first_update_due_days: null,
          update_frequency_days: null,
        }),
        updates: [
          createUpdate(
            "2026-06-04T12:00:00.000Z"
          ),
        ],
        now: new Date(
          "2026-06-05T12:00:00.000Z"
        ),
      });

    expect(schedule).toEqual({
      status: "satisfied",
      nextUpdateDueAt: null,
      lastUpdateAt:
        "2026-06-04T12:00:00.000Z",
      completedUpdateCount: 1,
      summary:
        "The required project progress update has been posted.",
    });
  });

  it("uses stable weekly defaults when agreement timing values are missing", () => {
    const schedule =
      getListingRequestProgressUpdateSchedule({
        agreement: createAgreement({
          first_update_due_days: null,
          update_frequency_days: null,
        }),
        updates: [],
        now: new Date(
          "2026-06-02T12:00:00.000Z"
        ),
      });

    expect(schedule.nextUpdateDueAt).toBe(
      "2026-06-06T12:00:00.000Z"
    );
  });
});