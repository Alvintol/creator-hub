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

import ListingRequestFinalDeliveryBuyerActions from "../listingRequests/finalDeliveries/ListingRequestFinalDeliveryBuyerActions";

const submittedFinalDelivery = {
  id: "final-delivery-1",
  status: "submitted" as const,
  title: "Final overlay delivery",
};

describe(
  "ListingRequestFinalDeliveryBuyerActions",
  () => {
    it("does not render without a final delivery", () => {
      render(
        <ListingRequestFinalDeliveryBuyerActions
          finalDelivery={null}
          canApprove
          onApprove={vi.fn()}
          onRequestRevision={vi.fn()}
        />
      );

      expect(
        screen.queryByText(
          "Respond to final delivery"
        )
      ).not.toBeInTheDocument();
    });

    it("does not render for an approved delivery", () => {
      render(
        <ListingRequestFinalDeliveryBuyerActions
          finalDelivery={{
            ...submittedFinalDelivery,
            status: "buyer_approved",
          }}
          canApprove
          onApprove={vi.fn()}
          onRequestRevision={vi.fn()}
        />
      );

      expect(
        screen.queryByRole("button", {
          name: "Approve final delivery",
        })
      ).not.toBeInTheDocument();
    });

    it("blocks approval while the final balance is pending", () => {
      render(
        <ListingRequestFinalDeliveryBuyerActions
          finalDelivery={submittedFinalDelivery}
          canApprove={false}
          approvalBlockedReason="The final balance must be confirmed as paid before you can approve this delivery."
          onApprove={vi.fn()}
          onRequestRevision={vi.fn()}
        />
      );

      expect(
        screen.getByRole("button", {
          name: "Approve final delivery",
        })
      ).toBeDisabled();

      expect(
        screen.getByText(
          "The final balance must be confirmed as paid before you can approve this delivery."
        )
      ).toBeInTheDocument();

      expect(
        screen.getByRole("button", {
          name: "Request revisions",
        })
      ).toBeEnabled();
    });

    it("asks for confirmation before approval", async () => {
      const onApprove = vi.fn();

      render(
        <ListingRequestFinalDeliveryBuyerActions
          finalDelivery={submittedFinalDelivery}
          canApprove
          onApprove={onApprove}
          onRequestRevision={vi.fn()}
        />
      );

      fireEvent.click(
        screen.getByRole("button", {
          name: "Approve final delivery",
        })
      );

      expect(onApprove).not.toHaveBeenCalled();

      expect(
        screen.getByText(
          /Approving confirms that the submitted final delivery/
        )
      ).toBeInTheDocument();

      fireEvent.click(
        screen.getByRole("button", {
          name: "Confirm final delivery approval",
        })
      );

      await waitFor(() => {
        expect(onApprove).toHaveBeenCalledWith(
          "final-delivery-1"
        );
      });
    });

    it("requires detailed revision instructions", () => {
      const onRequestRevision = vi.fn();

      render(
        <ListingRequestFinalDeliveryBuyerActions
          finalDelivery={submittedFinalDelivery}
          canApprove
          onApprove={vi.fn()}
          onRequestRevision={onRequestRevision}
        />
      );

      fireEvent.click(
        screen.getByRole("button", {
          name: "Request revisions",
        })
      );

      fireEvent.change(
        screen.getByLabelText("Required revisions"),
        {
          target: {
            value: "Too short",
          },
        }
      );

      fireEvent.click(
        screen.getByRole("button", {
          name: "Submit revision request",
        })
      );

      expect(
        screen.getByText(
          "Revision request details must contain at least 10 characters."
        )
      ).toBeInTheDocument();

      expect(
        onRequestRevision
      ).not.toHaveBeenCalled();
    });

    it("submits a trimmed revision request", async () => {
      const onRequestRevision = vi.fn();

      render(
        <ListingRequestFinalDeliveryBuyerActions
          finalDelivery={submittedFinalDelivery}
          canApprove
          onApprove={vi.fn()}
          onRequestRevision={onRequestRevision}
        />
      );

      fireEvent.click(
        screen.getByRole("button", {
          name: "Request revisions",
        })
      );

      fireEvent.change(
        screen.getByLabelText("Required revisions"),
        {
          target: {
            value:
              " Please adjust the final title alignment. ",
          },
        }
      );

      fireEvent.click(
        screen.getByRole("button", {
          name: "Submit revision request",
        })
      );

      await waitFor(() => {
        expect(
          onRequestRevision
        ).toHaveBeenCalledWith(
          "final-delivery-1",
          "Please adjust the final title alignment."
        );
      });
    });

    it("disables response actions while pending", () => {
      render(
        <ListingRequestFinalDeliveryBuyerActions
          finalDelivery={submittedFinalDelivery}
          canApprove
          isPending
          onApprove={vi.fn()}
          onRequestRevision={vi.fn()}
        />
      );

      expect(
        screen.getByRole("button", {
          name: "Approve final delivery",
        })
      ).toBeDisabled();

      expect(
        screen.getByRole("button", {
          name: "Request revisions",
        })
      ).toBeDisabled();
    });

    it("renders response errors", () => {
      render(
        <ListingRequestFinalDeliveryBuyerActions
          finalDelivery={submittedFinalDelivery}
          canApprove
          error={
            new Error(
              "The final balance must be paid before the delivery can be approved."
            )
          }
          onApprove={vi.fn()}
          onRequestRevision={vi.fn()}
        />
      );

      expect(
        screen.getByText(
          "The final balance must be paid before the delivery can be approved."
        )
      ).toBeInTheDocument();
    });
  }
);