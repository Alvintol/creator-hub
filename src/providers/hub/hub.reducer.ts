import { initialFilters } from "./hub.constants";
import type { HubAction, HubState } from "./hub.types";


// Pure reducer for all Hub state updates.

// This file should stay free of React hooks and free of Supabase calls.
// That separation makes it very easy to unit test.

export const hubReducer = (state: HubState, action: HubAction): HubState => {
  switch (action.type) {
    case "filters/set":
      return {
        ...state,
        filters: {
          ...state.filters,
          ...action.patch,
        },
      };

    case "filters/reset":
      return {
        ...state,
        filters: initialFilters,
      };

    case "favourites/set":
      return {
        ...state,
        favourites: action.favourites,
      };

    case "favourites/setLoaded":
      return {
        ...state,
        favouritesLoaded: action.value,
      };

    case "favourites/toggleCreator": {
      const creators = { ...state.favourites.creators };

      if (creators[action.creatorId]) {
        delete creators[action.creatorId];
      } else {
        creators[action.creatorId] = true;
      }

      return {
        ...state,
        favourites: {
          ...state.favourites,
          creators,
        },
      };
    }

    case "favourites/toggleListing": {
      const listings = { ...state.favourites.listings };

      if (listings[action.listingId]) {
        delete listings[action.listingId];
      } else {
        listings[action.listingId] = true;
      }

      return {
        ...state,
        favourites: {
          ...state.favourites,
          listings,
        },
      };
    }

    default:
      return state;
  }
};