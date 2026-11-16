export const posthogLogger = {
  info(message, attributes) { window.posthog?.logger?.info(message, attributes); },
  warn(message, attributes) { window.posthog?.logger?.warn(message, attributes); },
};
