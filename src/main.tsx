import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import HubProvider from "./providers/HubProvider";

import "./styles/app.css";
import "./styles/index.css";
import "./styles/ui.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HubProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </HubProvider>
  </React.StrictMode>
);