import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { installDevPerformanceTimelineGuard } from "./devPerformanceTimeline";
import "./styles.css";

installDevPerformanceTimelineGuard();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
