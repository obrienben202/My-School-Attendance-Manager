type AnalyticsData = Record<string, string | number | boolean>;

declare global {
  interface Window {
    umami?: {
      track(name: string, data?: AnalyticsData): void;
    };
  }
}

export function trackEvent(name: string, data?: AnalyticsData): void {
  if (typeof window === "undefined") return;

  try {
    // Replit injects this tracker into published website artifacts when
    // Project Analytics is enabled; it is intentionally absent in development.
    window.umami?.track(name, data);
  } catch {
    // Analytics must never interrupt the user action being tracked.
  }
}