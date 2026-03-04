import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import HubProvider from "./providers/HubProviders";

import "./styles/app.css";
import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HubProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </HubProvider>
  </React.StrictMode>
);