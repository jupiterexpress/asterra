// Product analytics (PostHog). Silent unless VITE_POSTHOG_KEY is set at build time.
// Never changes what the player sees or how the game plays: no autocapture, no
// session recording, no surveys, no pageviews, and every call is guarded.
import posthog from 'posthog-js';

const KEY = import.meta.env.VITE_POSTHOG_KEY;
const HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';
let on = false;

export const Analytics = {
  get enabled() { return on; },
  init() {
    if (!KEY) return;
    try {
      posthog.init(KEY, {
        api_host: HOST,
        person_profiles: 'always',
        capture_pageview: false,
        autocapture: false,
        disable_session_recording: true,
        disable_surveys: true,
        persistence: 'localStorage',
      });
      on = true;
    } catch {
      on = false;
    }
  },
  track(event, props = {}, options = {}) {
    if (!on) return;
    try { posthog.capture(event, { app: 'asterra', ...props }, options); } catch {}
  },
};
