import type { ReactNode } from "react";

// The supported marketplace offering types shown in filters.
export type OfferingType = "all" | "digital" | "commission" | "service";

// Video editing subtype filter
export type VideoSubtype = "all" | "long-form" | "short-form";

export type CategoryKey = "all" | string;

export type HubFilters = {
  q: string;
  onlyLive: boolean;
  onlyOpen: boolean;
  type: OfferingType;
  category: CategoryKey;
  videoSubtype: VideoSubtype;
};

export type FavouritesMap = Record<string, true>;

export type FavouritesState = {
  creators: FavouritesMap;
  listings: FavouritesMap;
};

export type HubState = {
  filters: HubFilters;
  favourites: FavouritesState;
  favouritesLoaded: boolean;
};

export type FavouriteTargetType = "creator" | "listing";

// Reducer actions for the Hub state
export type HubAction =
  | { type: "filters/set"; patch: Partial<HubFilters> }
  | { type: "filters/reset" }
  | { type: "favourites/set"; favourites: FavouritesState }
  | { type: "favourites/setLoaded"; value: boolean }
  | { type: "favourites/toggleCreator"; creatorId: string }
  | { type: "favourites/toggleListing"; listingId: string };

// Public actions exposed by the Hub provider
export type HubActions = {
  setFilters: (patch: Partial<HubFilters>) => void;
  resetFilters: () => void;
  refreshFavourites: () => Promise<void>;
  toggleFavouriteCreator: (creatorId: string) => Promise<void>;
  toggleFavouriteListing: (listingId: string) => Promise<void>;
};

// Standard provider children prop
export type HubProviderProps = {
  children: ReactNode;
};