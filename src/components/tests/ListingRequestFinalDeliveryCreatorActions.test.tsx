import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import ListingRequestFinalDeliveryCreatorActions from "../listingRequests/finalDeliveries/ListingRequestFinalDeliveryCreatorActions";

const draftFinalDelivery = {
  id: "final-delivery-1",
  status: "draft" as const,
  title: "Final overlay delivery",
};

describe(
  "ListingRequestFinalDeliveryCreatorActions",
  () => {
    it("does not render without a final delivery", () => {
      render(
        <ListingRequestFinalDeliveryCreatorActions
          finalDelivery={null}
          onSubmitFinalDelivery={vi.fn()}
        />
      );

      expect(
        screen.queryByText(
          "Final delivery actions"
        )
      ).not.toBeInTheDocument();
    });

    it("does not render for a submitted delivery", () => {
      render(
        <ListingRequestFinalDeliveryCreatorActions
          finalDelivery={{
            ...draftFinalDelivery,
            status: "submitted",
          }}
          onSubmitFinalDelivery={vi.fn()}
        />
      );

      expect(
        screen.queryByRole("button", {
          name: "Submit draft to buyer",
        })
      ).not.toBeInTheDocument();
    });

    it("renders the final-delivery draft", () => {
      render(
        <ListingRequestFinalDeliveryCreatorActions
          finalDelivery={draftFinalDelivery}
          onSubmitFinalDelivery={vi.fn()}
        />
      );

      expect(
        screen.getByText(
          "Draft: Final overlay delivery"
        )
      ).toBeInTheDocument();

      expect(
        screen.getByRole("button", {
          name: "Submit draft to buyer",
        })
      ).toBeInTheDocument();
    });

    it("submits the draft final delivery", () => {
      const onSubmitFinalDelivery = vi.fn();

      render(
        <ListingRequestFinalDeliveryCreatorActions
          finalDelivery={draftFinalDelivery}
          onSubmitFinalDelivery={
            onSubmitFinalDelivery
          }
        />
      );

      fireEvent.click(
        screen.getByRole("button", {
          name: "Submit draft to buyer",
        })
      );

      expect(
        onSubmitFinalDelivery
      ).toHaveBeenCalledWith("final-delivery-1");
    });

    it("disables submission while pending", () => {
      render(
        <ListingRequestFinalDeliveryCreatorActions
          finalDelivery={draftFinalDelivery}
          isPending
          onSubmitFinalDelivery={vi.fn()}
        />
      );

      expect(
        screen.getByRole("button", {
          name: "Submitting final delivery…",
        })
      ).toBeDisabled();
    });

    it("renders submission errors", () => {
      render(
        <ListingRequestFinalDeliveryCreatorActions
          finalDelivery={draftFinalDelivery}
          error={
            new Error(
              "This final-delivery draft is unavailable."
            )
          }
          onSubmitFinalDelivery={vi.fn()}
        />
      );

      expect(
        screen.getByText(
          "This final-delivery draft is unavailable."
        )
      ).toBeInTheDocument();
    });
  }
);