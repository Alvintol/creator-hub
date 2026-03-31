import type { FavouritesState, HubFilters, HubState } from "./hub.types";

// Initial filter values used when the provider starts and whenever filters are reset
export const initialFilters: HubFilters = {
  q: "",
  onlyLive: false,
  onlyOpen: false,
  type: "all",
  category: "all",
  videoSubtype: "all",
};

// Empty favourites state used:
// before the first load
// when a signed-out user is present
// as a fallback if the DB read fails
export const initialFavourites: FavouritesState = {
  creators: {},
  listings: {},
};


// Full initial Hub state.
// favouritesLoaded starts false because we want the provider to explicitly
// mark when the first server-backed favourites fetch has completed.
export const initialHubState: HubState = {
  filters: initialFilters,
  favourites: initialFavourites,
  favouritesLoaded: false,
};