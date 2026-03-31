import { supabase } from "../supabaseClient";
import type {
  FavouriteTargetType,
  FavouritesState,
} from "../../providers/hub/hub.types";

// Raw row shape returned from the user_favourites table
// Only selects the fields the UI layer actually needs for building in-memory favourites maps
type UserFavouriteRow = {
  target_type: FavouriteTargetType;
  target_id: string;
};

// Converts DB rows into the UI-friendly map structure used by the Hub provider.
// expected output:
// {
//   creators: { "creator-uuid": true },
//   listings: { "listing-uuid": true }
// }

const mapRowsToFavouritesState = (
  rows: UserFavouriteRow[]
): FavouritesState => {
  const nextState: FavouritesState = {
    creators: {},
    listings: {},
  };

  rows.forEach((row) => {
    if (row.target_type === "creator") {
      nextState.creators[row.target_id] = true;
      return;
    }

    if (row.target_type === "listing") {
      nextState.listings[row.target_id] = true;
    }
  });

  return nextState;
};

// Loads all favourites for the current signed-in user
export const loadUserFavourites = async (
  userId: string
): Promise<FavouritesState> => {
  const { data, error } = await supabase
    .from("user_favourites")
    .select("target_type, target_id")
    .eq("user_id", userId);

  if (error) {
    throw new Error(`[favouriteService] Failed to load favourites: ${error.message}`);
  }

  return mapRowsToFavouritesState((data ?? []) as UserFavouriteRow[]);
};

// Inserts a new favourite row for the user
// The DB unique constraint should prevent duplicate rows for the same
// user + target_type + target_id combination

export const addUserFavourite = async (args: {
  userId: string;
  targetType: FavouriteTargetType;
  targetId: string;
}): Promise<void> => {
  const { userId, targetType, targetId } = args;

  const { error } = await supabase.from("user_favourites").insert({
    user_id: userId,
    target_type: targetType,
    target_id: targetId,
  });

  if (error) {
    throw new Error(`[favouriteService] Failed to add favourite: ${error.message}`);
  }
};

// Removes an existing favourite row for the user 
export const removeUserFavourite = async (args: {
  userId: string;
  targetType: FavouriteTargetType;
  targetId: string;
}): Promise<void> => {
  const { userId, targetType, targetId } = args;

  const { error } = await supabase
    .from("user_favourites")
    .delete()
    .eq("user_id", userId)
    .eq("target_type", targetType)
    .eq("target_id", targetId);

  if (error) {
    throw new Error(`[favouriteService] Failed to remove favourite: ${error.message}`);
  }
};