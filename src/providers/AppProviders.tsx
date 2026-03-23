import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import HubProvider from "./HubProvider";

type AppProvidersProps = {
  children: ReactNode;
};

const AppProviders = ({ children }: AppProvidersProps) => {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            // cooldown for focus refetch:
            // if data was fetched in the last 15s, focus won't refetch.
            staleTime: 15_000,
            refetchOnWindowFocus: true,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={client}>
      <HubProvider>{children}</HubProvider>
    </QueryClientProvider>
  );
};

export default AppProviders;