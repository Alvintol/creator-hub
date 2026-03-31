import {
    createContext,
    useCallback,
    useEffect,
    useMemo,
    useReducer,
} from "react";

import { useAuth } from "../AuthProvider";
import { initialFavourites, initialHubState } from "./hub.constants";
import { hubReducer } from "./hub.reducer";
import type {
    HubActions,
    HubProviderProps,
    HubState,
} from "./hub.types";
import {
    addUserFavourite,
    loadUserFavourites,
    removeUserFavourite,
} from "../../lib/favourites/favouriteService";


export const HubStateContext = createContext<HubState | null>(null);
export const HubActionsContext = createContext<HubActions | null>(null);


// HubProvider owns:
// - local marketplace filter state
// - server-backed favourites mirrored into client state
// - optimistic favourite toggles with DB persistence

const HubProvider = (props: HubProviderProps) => {
    const { children } = props;

    // Pull the current authenticated user from the auth layer.
    const { user } = useAuth();

    // All state updates still go through a reducer so the state flow stays explicit and easy to test.
    const [state, dispatch] = useReducer(hubReducer, initialHubState);

    // Loads favourites from Supabase for the current user.
    // This is also exposed publicly as refreshFavourites() so future UI pieces can force a sync if needed.
    const refreshFavourites = useCallback(async (): Promise<void> => {

        // Mark favourites as "not yet loaded" whenever a new fetch begins.
        dispatch({ type: "favourites/setLoaded", value: false });

        // Signed-out users do not have account-backed favourites.
        // Reset to empty and mark the load as complete.
        if (!user?.id) {
            dispatch({ type: "favourites/set", favourites: initialFavourites });
            dispatch({ type: "favourites/setLoaded", value: true });
            return;
        }

        try {
            const favourites = await loadUserFavourites(user.id);

            dispatch({ type: "favourites/set", favourites });
        } catch (error) {

            // If fetch fails, fall back to an empty state so the UI remains usable.
            console.warn("[HubProvider] Failed to load favourites:", error);
            dispatch({ type: "favourites/set", favourites: initialFavourites });
        } finally {
            dispatch({ type: "favourites/setLoaded", value: true });
        }
    }, [user?.id]);

    // Automatically reload favourites whenever the signed-in user changes.
    useEffect(() => {
        void refreshFavourites();
    }, [refreshFavourites]);


    // Local filter patching.    
    const setFilters = useCallback<HubActions["setFilters"]>((patch) => {
        dispatch({ type: "filters/set", patch });
    }, []);

    // Restores filters to their known defaults.
    const resetFilters = useCallback<HubActions["resetFilters"]>(() => {
        dispatch({ type: "filters/reset" });
    }, []);

    // Optimistically toggles a creator favourite.
    // Flow:
    // 1. Read current favourite state
    // 2. Update UI immediately
    // 3. Persist to Supabase
    // 4. Roll back if the DB write fails    
    const toggleFavouriteCreator = useCallback<HubActions["toggleFavouriteCreator"]>(
        async (creatorId) => {
            if (!user?.id) {
                console.warn(
                    "[HubProvider] Cannot toggle creator favourite without an authenticated user."
                );
                return;
            }

            const isCurrentlyFavourited = Boolean(state.favourites.creators[creatorId]);

            // Optimistic UI update.
            dispatch({ type: "favourites/toggleCreator", creatorId });

            try {
                if (isCurrentlyFavourited) {
                    await removeUserFavourite({
                        userId: user.id,
                        targetType: "creator",
                        targetId: creatorId,
                    });
                } else {
                    await addUserFavourite({
                        userId: user.id,
                        targetType: "creator",
                        targetId: creatorId,
                    });
                }
            } catch (error) {
                // If persistence fails, roll the optimistic change back so UI and DB do not drift apart.
                console.warn("[HubProvider] Failed to toggle creator favourite:", error);
                dispatch({ type: "favourites/toggleCreator", creatorId });
            }
        },
        [state.favourites.creators, user?.id]
    );

    // Optimistically toggles a listing favourite
    // Uses the same flow as creator favourites
    const toggleFavouriteListing = useCallback<HubActions["toggleFavouriteListing"]>(
        async (listingId) => {
            if (!user?.id) {
                console.warn(
                    "[HubProvider] Cannot toggle listing favourite without an authenticated user."
                );
                return;
            }

            const isCurrentlyFavourited = Boolean(state.favourites.listings[listingId]);


            // Optimistic UI update.
            dispatch({ type: "favourites/toggleListing", listingId });

            try {
                if (isCurrentlyFavourited) {
                    await removeUserFavourite({
                        userId: user.id,
                        targetType: "listing",
                        targetId: listingId,
                    });
                } else {
                    await addUserFavourite({
                        userId: user.id,
                        targetType: "listing",
                        targetId: listingId,
                    });
                }
            } catch (error) {
                // Roll the optimistic change back if the DB write fails.
                console.warn("[HubProvider] Failed to toggle listing favourite:", error);
                dispatch({ type: "favourites/toggleListing", listingId });
            }
        },
        [state.favourites.listings, user?.id]
    );

    // Memoize the public action API so consuming components receive a stable object unless one of the action functions truly changes.
    const actions = useMemo<HubActions>(
        () => ({
            setFilters,
            resetFilters,
            refreshFavourites,
            toggleFavouriteCreator,
            toggleFavouriteListing,
        }),
        [
            setFilters,
            resetFilters,
            refreshFavourites,
            toggleFavouriteCreator,
            toggleFavouriteListing,
        ]
    );

    return (
        <HubStateContext.Provider value={state}>
            <HubActionsContext.Provider value={actions}>
                {children}
            </HubActionsContext.Provider>
        </HubStateContext.Provider>
    );
};

export default HubProvider;