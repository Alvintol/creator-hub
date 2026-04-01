import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ListingCard from "../ListingCard";
import {
  HubActionsContext,
  HubStateContext,
} from "../../providers/hub/HubProvider";
import type { HubActions, HubState } from "../../providers/hub";
import type { Listing } from "../../data/mock";

// Mock Hub actions used by FavouriteButton inside ListingCard
const mockSetFilters = vi.fn();
const mockResetFilters = vi.fn();
const mockRefreshFavourites = vi.fn();
const mockToggleFavouriteCreator = vi.fn();
const mockToggleFavouriteListing = vi.fn();

// Builds a fresh Hub state object for each test
const createState = (overrides?: Partial<HubState>): HubState => ({
  filters: {
    q: "",
    onlyLive: false,
    onlyOpen: false,
    type: "all",
    category: "all",
    videoSubtype: "all",
  },
  favourites: {
    creators: {},
    listings: {},
  },
  favouritesLoaded: true,
  ...overrides,
});

// Builds a full Hub actions object for the mocked provider
const createActions = (): HubActions => ({
  setFilters: mockSetFilters,
  resetFilters: mockResetFilters,
  refreshFavourites: mockRefreshFavourites,
  toggleFavouriteCreator: mockToggleFavouriteCreator,
  toggleFavouriteListing: mockToggleFavouriteListing,
});

// Renders the component inside the providers it depends on
const renderWithProviders = (
  ui: React.ReactNode,
  stateOverrides?: Partial<HubState>
) => {
  const state = createState(stateOverrides);
  const actions = createActions();

  return render(
    <MemoryRouter>
      <HubStateContext.Provider value={state}>
        <HubActionsContext.Provider value={actions}>
          {ui}
        </HubActionsContext.Provider>
      </HubStateContext.Provider>
    </MemoryRouter>
  );
};

// Small reusable listing factory for tests
const createListing = (overrides?: Partial<Listing>): Listing => ({
  id: "listing-emotes-01",
  creatorId: "creator-amatrine",
  offeringType: "digital",
  category: "emotes",
  title: "Cozy Emote Pack (12)",
  short: "12 emotes + variants. Includes PNG + licence notes.",
  preview: "https://picsum.photos/seed/emotes/960/540",
  priceType: "fixed",
  priceMin: 18,
  priceMax: 18,
  deliverables: ["png"],
  featured: true,
  ...overrides,
});

describe("ListingCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the listing title and short description", () => {
    const listing = createListing();

    renderWithProviders(
      <ListingCard listing={listing} creatorName="Amatrine" />
    );

    expect(screen.getByText("Cozy Emote Pack (12)")).toBeInTheDocument();
    expect(
      screen.getByText("12 emotes + variants. Includes PNG + licence notes.")
    ).toBeInTheDocument();
  });

  it("renders the offering type badge", () => {
    const listing = createListing({
      offeringType: "service",
    });

    renderWithProviders(
      <ListingCard listing={listing} creatorName="Amatrine" />
    );

    expect(screen.getByText("service")).toBeInTheDocument();
  });

  it("renders the creator name", () => {
    const listing = createListing();

    renderWithProviders(
      <ListingCard listing={listing} creatorName="Rigmancer" />
    );

    expect(screen.getByText("Rigmancer")).toBeInTheDocument();
  });

  it("renders a fixed price correctly", () => {
    const listing = createListing({
      priceType: "fixed",
      priceMin: 18,
      priceMax: 18,
    });

    renderWithProviders(
      <ListingCard listing={listing} creatorName="Amatrine" />
    );

    expect(screen.getByText("$18")).toBeInTheDocument();
  });

  it("renders a starting_at price correctly", () => {
    const listing = createListing({
      priceType: "starting_at",
      priceMin: 90,
      priceMax: null,
    });

    renderWithProviders(
      <ListingCard listing={listing} creatorName="jaQUILLyn" />
    );

    expect(screen.getByText("From $90")).toBeInTheDocument();
  });

  it("renders a range price correctly", () => {
    const listing = createListing({
      priceType: "range",
      priceMin: 120,
      priceMax: 420,
    });

    renderWithProviders(
      <ListingCard listing={listing} creatorName="Rigmancer" />
    );

    expect(screen.getByText("$120–$420")).toBeInTheDocument();
  });

  it("links to the listing page", () => {
    const listing = createListing({
      id: "listing-rigging-01",
    });

    renderWithProviders(
      <ListingCard listing={listing} creatorName="Rigmancer" />
    );

    const link = screen.getByRole("link");

    expect(link).toHaveAttribute("href", "/listing/listing-rigging-01");
  });

  it("renders the favourite button inside the card", () => {
    const listing = createListing();

    renderWithProviders(
      <ListingCard listing={listing} creatorName="Amatrine" />
    );

    expect(
      screen.getByRole("button", { name: "Add favourite" })
    ).toBeInTheDocument();
  });
});