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

import ListingRequestChangeOrderBuyerActions from "../ListingRequestChangeOrderBuyerActions";

const sentChangeOrder = {
  id: "change-order-1",
  status: "sent" as const,
  title: "Additional animated overlay",
};

describe("ListingRequestChangeOrderBuyerActions", () => {
  it("does not render without a change order", () => {
    render(
      <ListingRequestChangeOrderBuyerActions
        changeOrder={null}
        onAccept={vi.fn()}
        onDecline={vi.fn()}
      />
    );

    expect(
      screen.queryByText("Respond to change order")
    ).not.toBeInTheDocument();
  });

  it("does not render for a completed change order", () => {
    render(
      <ListingRequestChangeOrderBuyerActions
        changeOrder={{
          ...sentChangeOrder,
          status: "buyer_accepted",
        }}
        onAccept={vi.fn()}
        onDecline={vi.fn()}
      />
    );

    expect(
      screen.queryByRole("button", {
        name: "Accept change order",
      })
    ).not.toBeInTheDocument();
  });

  it("asks for confirmation before accepting", () => {
    const onAccept = vi.fn();

    render(
      <ListingRequestChangeOrderBuyerActions
        changeOrder={sentChangeOrder}
        onAccept={onAccept}
        onDecline={vi.fn()}
      />
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Accept change order",
      })
    );

    expect(onAccept).not.toHaveBeenCalled();

    expect(
      screen.getByText(
        /By accepting, you agree that the proposed project changes/
      )
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Confirm change order acceptance",
      })
    );

    expect(onAccept).toHaveBeenCalledWith(
      "change-order-1"
    );
  });

  it("lets the buyer cancel acceptance confirmation", () => {
    const onAccept = vi.fn();

    render(
      <ListingRequestChangeOrderBuyerActions
        changeOrder={sentChangeOrder}
        onAccept={onAccept}
        onDecline={vi.fn()}
      />
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Accept change order",
      })
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Keep reviewing",
      })
    );

    expect(onAccept).not.toHaveBeenCalled();

    expect(
      screen.getByRole("button", {
        name: "Accept change order",
      })
    ).toBeInTheDocument();
  });

  it("declines with a trimmed optional reason", () => {
    const onDecline = vi.fn();

    render(
      <ListingRequestChangeOrderBuyerActions
        changeOrder={sentChangeOrder}
        onAccept={vi.fn()}
        onDecline={onDecline}
      />
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Decline change order",
      })
    );

    fireEvent.change(
      screen.getByLabelText("Decline reason"),
      {
        target: {
          value:
            " The additional work is outside my budget. ",
        },
      }
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Confirm change order decline",
      })
    );

    expect(onDecline).toHaveBeenCalledWith(
      "change-order-1",
      "The additional work is outside my budget."
    );
  });

  it("allows declining without a reason", () => {
    const onDecline = vi.fn();

    render(
      <ListingRequestChangeOrderBuyerActions
        changeOrder={sentChangeOrder}
        onAccept={vi.fn()}
        onDecline={onDecline}
      />
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Decline change order",
      })
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Confirm change order decline",
      })
    );

    expect(onDecline).toHaveBeenCalledWith(
      "change-order-1",
      null
    );
  });

  it("disables the response action while pending", () => {
    render(
      <ListingRequestChangeOrderBuyerActions
        changeOrder={sentChangeOrder}
        isPending
        onAccept={vi.fn()}
        onDecline={vi.fn()}
      />
    );

    expect(
      screen.getByRole("button", {
        name: "Accept change order",
      })
    ).toBeDisabled();

    expect(
      screen.getByRole("button", {
        name: "Decline change order",
      })
    ).toBeDisabled();
  });

  it("renders response errors", () => {
    render(
      <ListingRequestChangeOrderBuyerActions
        changeOrder={sentChangeOrder}
        error={
          new Error(
            "This change order is no longer available."
          )
        }
        onAccept={vi.fn()}
        onDecline={vi.fn()}
      />
    );

    expect(
      screen.getByText(
        "This change order is no longer available."
      )
    ).toBeInTheDocument();
  });
});