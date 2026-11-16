# Analytics (PostHog)

Asterra sends a small set of product events to PostHog so we can see the player funnel and daily active players.

## Turning it on

Set `VITE_POSTHOG_KEY` (a public project key) in `.env.local` for local runs (do not commit it), or in Vercel under Project Settings → Environment Variables for deployments. With no key set, analytics is fully off and nothing is sent.

## What is collected

Events are anonymous. Asterra has no accounts, so PostHog assigns a random browser ID stored in `localStorage`. Nothing typed by the player is sent: no contractor name, no save contents, and no page content.

| Event | When | Properties |
| --- | --- | --- |
| `app_open` | Each launch | `returning` (boolean) |
| `tutorial_completed` | Player finishes the stacking tutorial | — |
| `contract_started` | A blueprint build begins | `contract` (1–3) |
| `contract_completed` | A build finishes | `contract`, `grade`, `reward`, `density_pct`, `why` |
| `contract_failed` | A build ends without finishing | `contract`, `density_pct`, `why` |
| `shop_purchase` | A city item is placed | `item` |
| `new_game` | Player resets the save | — |

Every event carries `app: "asterra"`.

## Funnels to build in PostHog

1. Onboarding: `app_open` → `tutorial_completed` → `contract_started` (contract 1) → `contract_completed` (contract 1)
2. Progression: `contract_completed` 1 → 2 → 3
3. Retention: `app_open` daily, weekly, and 7-day return

## What is deliberately off

Autocapture, session recording, and surveys are disabled. Analytics sends one automatic pageview per launch (for PostHog's Active users and Web analytics views) plus the events listed above, so it cannot change what the player sees or how the game plays.

## Privacy notes

PostHog records the visitor's IP address and approximate location by default. Before public launch, add a short analytics disclosure to the site and update the App Store privacy label when the iOS build ships.
