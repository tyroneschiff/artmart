# Acquisition Metrics

*(Snapshot, not history. Update weekly. Numbers replace, never append.)*

## Kill criterion

If both conditions hold for 4 consecutive weeks, fix the product before running any new acquisition channel:
- `shares-per-completed-transform < 0.10`
- `signups-per-share < 0.10`

## Viral coefficient

```
K = shares-per-completed-transform × signups-per-share × transforms-per-new-signup
```

- K > 1.0 → exponential organic growth (the goal)
- 0.4–1.0 → meaningful viral lift on top of paid/owned channels
- < 0.4 → essentially non-viral; product change required

## Current numbers

*(Not yet instrumented. See `BACKLOG.md` item 2.)*

| Metric | Last 7d | Prior 7d | Trend |
|---|---|---|---|
| Completed transforms | — | — | — |
| Shares initiated | — | — | — |
| Shares per transform | — | — | — |
| Signups via share link | — | — | — |
| Signups per share | — | — | — |
| Transforms per new signup (first 14d) | — | — | — |
| **K** | — | — | — |

## Notes

- A "share initiated" = user tapped the share sheet, regardless of completion.
- A "share completed" = native share callback fired (where the platform exposes it; iMessage does not).
- Attribute signups to a share when the new user lands on `/store/:slug` or `/piece/:id` from outside the app within 24h before signup.
