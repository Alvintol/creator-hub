import type { ReactNode } from "react";
import HubProvider from "./hub/HubProvider";

type AppProvidersProps = {
  children: ReactNode;
};

const AppProviders = (props: AppProvidersProps) => {
  const { children } = props;
  return <HubProvider>{children}</HubProvider>;
};

export default AppProviders;