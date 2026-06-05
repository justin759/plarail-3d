const CLEAR_INTERVAL_MS = 1000;
const KEEP_PERFORMANCE_ENTRIES_PARAM = "keepPerformanceEntries";

function shouldKeepPerformanceEntries() {
  if (typeof window === "undefined") return true;
  return new URLSearchParams(window.location.search).has(KEEP_PERFORMANCE_ENTRIES_PARAM);
}

function clearPerformanceTimeline() {
  if (typeof performance.clearMeasures === "function") {
    performance.clearMeasures();
  }
  if (typeof performance.clearMarks === "function") {
    performance.clearMarks();
  }
}

export function installDevPerformanceTimelineGuard() {
  if (!import.meta.env.DEV || shouldKeepPerformanceEntries()) return;
  if (typeof performance.getEntriesByType !== "function") return;

  clearPerformanceTimeline();

  window.setInterval(clearPerformanceTimeline, CLEAR_INTERVAL_MS);
}
