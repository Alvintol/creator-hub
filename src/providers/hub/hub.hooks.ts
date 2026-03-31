import { useContext } from "react";
import { HubActionsContext, HubStateContext } from "./HubProvider";
import type { HubActions, HubState } from "./hub.types";


// Read-only hook for Hub state.
// This keeps consuming components from importing context objects directly.
export const useHubState = (): HubState => {
  const value = useContext(HubStateContext);

  if (!value) {
    throw new Error("useHubState must be used within HubProvider");
  }

  return value;
};


// Action hook for Hub actions.
// Components use this to update filters or toggle favourites.
export const useHubActions = (): HubActions => {
  const value = useContext(HubActionsContext);

  if (!value) {
    throw new Error("useHubActions must be used within HubProvider");
  }

  return value;
};