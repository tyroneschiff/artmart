# Growth — acquisition workspace

This folder is where acquisition strategy lives, separate from the engineering codebase. Everything here is a draft, a brief, a metric snapshot, or a record of decisions. Nothing here is shipped automatically.

## Files

- `BACKLOG.md` — ranked list of acquisition experiments to run next. Strategist (eventually CRON C) reads this to pick what to draft.
- `REJECTED.md` — channels, tactics, and ideas tried or deliberately not pursued, with the reason. Prevents re-suggesting bad ideas.
- `METRICS.md` — current viral coefficient and trend. The kill criterion. Updated weekly.
- `drafts/` — concrete artifacts: Reddit post drafts, holiday campaign briefs, influencer outreach templates, ASO refreshes, TikTok scripts. Filename format: `YYYY-MM-DD-{slug}.md`. Each draft is reviewed by a human before anything is posted, sent, or shipped.

## Operating principles

1. **Ship the product change before the marketing.** A Reddit post about a feature that doesn't work yet is worse than no post.
2. **One artifact at a time.** A folder with 20 half-finished campaign drafts is less useful than 1 finished one.
3. **Snapshot not history.** Trim aggressively. Old drafts that didn't ship: archive or delete. `BACKLOG.md` capped at 12 items, `REJECTED.md` capped at 15.
4. **Strategy lives in `CLAUDE.md` `## Acquisition strategy`** — this folder is the operating layer, not the strategy layer.
