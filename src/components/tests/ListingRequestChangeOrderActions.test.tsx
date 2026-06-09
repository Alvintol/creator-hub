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

import ListingRequestChangeOrderCreatorActions from "../ListingRequestChangeOrderCreatorActions";

const draftChangeOrder = {
  id: "change-order-1",
  status: "draft" as const,
  title: "Additional animated overlay",
};

describe("ListingRequestChangeOrderCreatorActions", () => {
  it("does not render without a change order", () => {
    render(
      <ListingRequestChangeOrderCreatorActions
        changeOrder={null}
        onSendChangeOrder={vi.fn()}
      />
    );

    expect(
      screen.queryByText("Change order actions")
    ).not.toBeInTheDocument();
  });

  it("does not render for a sent change order", () => {
    render(
      <ListingRequestChangeOrderCreatorActions
        changeOrder={{
          ...draftChangeOrder,
          status: "sent",
        }}
        onSendChangeOrder={vi.fn()}
      />
    );

    expect(
      screen.queryByRole("button", {
        name: "Send draft to buyer",
      })
    ).not.toBeInTheDocument();
  });

  it("renders the active draft change order", () => {
    render(
      <ListingRequestChangeOrderCreatorActions
        changeOrder={draftChangeOrder}
        onSendChangeOrder={vi.fn()}
      />
    );

    expect(
      screen.getByText(
        "Draft: Additional animated overlay"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Send draft to buyer",
      })
    ).toBeInTheDocument();
  });

  it("sends the draft change order", () => {
    const onSendChangeOrder = vi.fn();

    render(
      <ListingRequestChangeOrderCreatorActions
        changeOrder={draftChangeOrder}
        onSendChangeOrder={onSendChangeOrder}
      />
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Send draft to buyer",
      })
    );

    expect(onSendChangeOrder).toHaveBeenCalledWith(
      "change-order-1"
    );
  });

  it("disables the action while sending", () => {
    render(
      <ListingRequestChangeOrderCreatorActions
        changeOrder={draftChangeOrder}
        isPending
        onSendChangeOrder={vi.fn()}
      />
    );

    expect(
      screen.getByRole("button", {
        name: "Sending change order…",
      })
    ).toBeDisabled();
  });

  it("renders send errors", () => {
    render(
      <ListingRequestChangeOrderCreatorActions
        changeOrder={draftChangeOrder}
        error={
          new Error(
            "This draft change order is unavailable."
          )
        }
        onSendChangeOrder={vi.fn()}
      />
    );

    expect(
      screen.getByText(
        "This draft change order is unavailable."
      )
    ).toBeInTheDocument();
  });
});