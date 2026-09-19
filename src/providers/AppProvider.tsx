import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AuthProvider from "./AuthProvider";
import CookiePreferencesProvider from "./CookiePreferencesProvider";
import ThemeProvider from "./ThemeProvider";
import HubProvider from "./hub/HubProvider";

type AppProvidersProps = { children: ReactNode };

const AppProviders = (props: AppProvidersProps) => {
  const { children } = props;

  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, staleTime: 15_000, refetchOnWindowFocus: true },
        },
      })
  );

  return (
    <ThemeProvider>
      <CookiePreferencesProvider>
        <QueryClientProvider client={client}>
          <AuthProvider>
            <HubProvider>{children}</HubProvider>
          </AuthProvider>
        </QueryClientProvider>
      </CookiePreferencesProvider>
    </ThemeProvider>
  );
};

export default AppProviders;