import type { ReactNode } from "react";
import HubProvider from "./HubProvider";
import { useTwitchStreamsRefresh } from "../hooks/useTwitchStreamsRefresh";

type Props = { children: ReactNode };

const ProviderEffects = () => {
  useTwitchStreamsRefresh();
  return null;
};

const AppProviders = ({ children }: Props) => {
  return (
    <HubProvider>
      <ProviderEffects />
      {children}
    </HubProvider>
  );
};

export default AppProviders;