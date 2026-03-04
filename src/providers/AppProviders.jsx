import { HubProvider } from "./HubProvider";

const AppProviders = ({ children }) => {
    return <HubProvider>{children}</HubProvider>;
}

export default AppProviders