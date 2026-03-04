import React, {
    createContext,
    useContext,
    useMemo,
    useReducer,
    useEffect,
} from "react";

const HubStateContext = createContext(null);
const HubActionsContext = createContext(null);

const FAVORITES_KEY = "creatorhub:favorites:v1";

const initialState = {
    filters: { q: "", onlyLive: false, onlyOpen: false, type: "all", category: "all" },
    favorites: { creators: {}, listings: {} },
};

function initState(base) {
    try {
        const raw = localStorage.getItem(FAVORITES_KEY);
        if (!raw) return base;
        const parsed = JSON.parse(raw);
        return { ...base, favorites: parsed };
    } catch {
        return base;
    }
}

function reducer(state, action) {
    switch (action.type) {
        case "filters/set":
            return { ...state, filters: { ...state.filters, ...action.patch } };

        case "filters/reset":
            return { ...state, filters: initialState.filters };

        case "favorites/toggleCreator": {
            const next = { ...state.favorites.creators };
            next[action.handle] ? delete next[action.handle] : (next[action.handle] = true);
            return { ...state, favorites: { ...state.favorites, creators: next } };
        }

        case "favorites/toggleListing": {
            const next = { ...state.favorites.listings };
            next[action.id] ? delete next[action.id] : (next[action.id] = true);
            return { ...state, favorites: { ...state.favorites, listings: next } };
        }

        default:
            return state;
    }
}

export function HubProvider({ children }) {
    const [state, dispatch] = useReducer(reducer, initialState, initState);

    useEffect(() => {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(state.favorites));
    }, [state.favorites]);

    const actions = useMemo(
        () => ({
            setFilters: (patch) => dispatch({ type: "filters/set", patch }),
            resetFilters: () => dispatch({ type: "filters/reset" }),
            toggleFavoriteCreator: (handle) => dispatch({ type: "favorites/toggleCreator", handle }),
            toggleFavoriteListing: (id) => dispatch({ type: "favorites/toggleListing", id }),
        }),
        []
    );

    return (
        <HubStateContext.Provider value={state}>
            <HubActionsContext.Provider value={actions}>
                {children}
            </HubActionsContext.Provider>
        </HubStateContext.Provider>
    );
}

export const useHubState = () => {
    const v = useContext(HubStateContext);
    if (!v) throw new Error("useHubState must be used within HubProvider");
    return v;
};

export const useHubActions = () => {
    const v = useContext(HubActionsContext);
    if (!v) throw new Error("useHubActions must be used within HubProvider");
    return v;
};