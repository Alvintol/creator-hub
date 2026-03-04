import { HubProvider } from "./HubProvider";

export default function AppProviders({ children }) {
    return <HubProvider>{children}</HubProvider>;
}