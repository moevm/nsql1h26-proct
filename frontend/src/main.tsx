import { ThemeProvider } from "@gravity-ui/uikit";
import "@gravity-ui/uikit/styles/fonts.css";
import "@gravity-ui/uikit/styles/styles.css";
import { createRoot } from "react-dom/client";
import { AppProviders } from "./app/providers/AppProviders";
import { AppRouter } from "./app/router/AppRouter";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider theme="light">
    <AppProviders>
      <AppRouter />
    </AppProviders>
  </ThemeProvider>,
);
