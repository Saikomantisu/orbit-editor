import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";
import "./app/styles.css";
import { AppProviders } from "./ui/AppProviders";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </React.StrictMode>,
);
