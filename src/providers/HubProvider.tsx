import React, {
    createContext,
    useContext,
    useMemo,
    useReducer,
    useEffect,
    ReactNode
} from "react";

export type OfferingType = "all" | "digital" | "commission" | "service";
export type VideoSubtype = "all" | "long-form" | "short-form";
export type CategoryKey = "all" | (string & {});

export type HubFilters = {
    q: string;
    onlyLive: boolean;
    onlyOpen: boolean;
    type: OfferingType;
    category: CategoryKey;
    videoSubtype: VideoSubtype;
};

export type FavoritesState = {
    creators: Record<string, true>;
    listings: Record<string, true>;
};

export type HubState = {
    filters: HubFilters;
    favorites: FavoritesState;
};

type Action =
    | { type: "filters/set"; patch: Partial<HubFilters> }
    | { type: "filters/reset" }
    | { type: "favorites/toggleCreator"; handle: string }
    | { type: "favorites/toggleListing"; id: string };

export type HubActions = {
    setFilters: (patch: Partial<HubFilters>) => void;
    resetFilters: () => void;
    toggleFavoriteCreator: (handle: string) => void;
    toggleFavoriteListing: (id: string) => void;
};

const HubStateContext = createContext<HubState | null>(null);
const HubActionsContext = createContext<HubActions | null>(null);

const FAVORITES_KEY = "creatorhub:favorites:v1";

const initialState: HubState = {
    filters: {
        q: "",
        onlyLive: false,
        onlyOpen: false,
        type: "all",
        category: "all",
        videoSubtype: "all",
    },
    favorites: { creators: {}, listings: {} },
};

const safeParseFavorites = (raw: string | null): FavoritesState | null => {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as unknown;

        if (
            typeof parsed === "object" &&
            parsed !== null &&
            "creators" in parsed &&
            "listings" in parsed
        ) {
            const creators =
                (parsed as any).creators && typeof (parsed as any).creators === "object"
                    ? (parsed as any).creators
                    : {};
            const listings =
                (parsed as any).listings && typeof (parsed as any).listings === "object"
                    ? (parsed as any).listings
                    : {};

            return {
                creators: Object.fromEntries(Object.keys(creators).map((k) => [k, true])),
                listings: Object.fromEntries(Object.keys(listings).map((k) => [k, true])),
            };
        }

        return null;
    } catch {
        return null;
    }
};

const initState = (base: HubState): HubState => {
    const favs = safeParseFavorites(localStorage.getItem(FAVORITES_KEY));
    if (!favs) return base;
    return { ...base, favorites: favs };
};

const reducer = (state: HubState, action: Action): HubState => {
    switch (action.type) {
        case "filters/set":
            return { ...state, filters: { ...state.filters, ...action.patch } };

        case "filters/reset":
            return { ...state, filters: initialState.filters };

        case "favorites/toggleCreator": {
            const next = { ...state.favorites.creators };
            if (next[action.handle]) delete next[action.handle];
            else next[action.handle] = true;
            return { ...state, favorites: { ...state.favorites, creators: next } };
        }

        case "favorites/toggleListing": {
            const next = { ...state.favorites.listings };
            if (next[action.id]) delete next[action.id];
            else next[action.id] = true;
            return { ...state, favorites: { ...state.favorites, listings: next } };
        }

        default:
            return state;
    }
};

type HubProviderProps = {
    children: ReactNode;
};

const HubProvider = ({ children }: HubProviderProps) => {
    const [state, dispatch] = useReducer(reducer, initialState, initState);

    useEffect(() => {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(state.favorites));
    }, [state.favorites]);

    const actions = useMemo<HubActions>(
        () => ({
            setFilters: (patch) => dispatch({ type: "filters/set", patch }),
            resetFilters: () => dispatch({ type: "filters/reset" }),
            toggleFavoriteCreator: (handle) =>
                dispatch({ type: "favorites/toggleCreator", handle }),
            toggleFavoriteListing: (id) =>
                dispatch({ type: "favorites/toggleListing", id }),
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
};

export const useHubState = (): HubState => {
    const v = useContext(HubStateContext);
    if (!v) throw new Error("useHubState must be used within HubProvider");
    return v;
};

export const useHubActions = (): HubActions => {
    const v = useContext(HubActionsContext);
    if (!v) throw new Error("useHubActions must be used within HubProvider");
    return v;
};

export default HubProvider;