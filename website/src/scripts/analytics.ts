// Umami custom event. No-op when the tracker is absent (no website ID, blocked, not loaded yet).
type Umami = { track: (event: string, data?: Record<string, string | number>) => void };

export function track(event: string, data?: Record<string, string | number>) {
  try { (window as unknown as { umami?: Umami }).umami?.track(event, data); } catch { /* never break the page for analytics */ }
}
