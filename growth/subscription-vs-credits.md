# Draw Up — subscription vs. credits (2026-06-25)

**Bottom line: stay on credits for launch. A monthly subscription is a poor fit for this app right now** — video COGS is high (~$1.26) and usage is bursty + novelty-churny, which is the exact combination that makes subscriptions lose money or force a cap so tight it's a worse deal than non-expiring credits. Revisit a subscription later, and if so as an **annual "keepsake" plan or a hybrid (small sub + overflow credits)**, only once data shows steady monthly usage. This refines (doesn't reverse) the existing `CLAUDE.md` rejection note.

*Inputs: `growth/unit-economics.md`, `growth/video-economics.md` (video ≈ $1.26 at 8s / $0.96 at 6s; video = 2 credits; image ≈ $0.06), `app/app/credits.tsx` (credit model), `CLAUDE.md` (prior rejection; viral, sub-$1 LTV/install). Apple auto-renewable subs: 30% year 1 → 15% after 12 retained months, or flat 15% under the Small Business Program (<$1M/yr, applies here). Modeled at 15%.*

## 1. The "unlimited" trap — why it's impossible here
Flat unlimited sub, video cost $1.26, net = price × 0.85:
| Price/mo | Net | Break-even videos/mo | A 30-video power user costs us | Result |
|---|---|---|---|---|
| $9.99 unlimited | $8.49 | ~6.7 | $37.80 | **−$29/mo** |
| $19.99 unlimited | $16.99 | ~13.5 | $37.80 | **−$21/mo** |
A single engaged kid (daily drawings) bankrupts any unlimited price. **Unlimited is off the table** — a viable sub must be metered ("N videos/month").

## 2. Capped tiers — the COGS makes them expensive or thin
Margin at full utilization (subscriber uses the whole allotment), 15% Apple:
| Tier | Videos/mo | Net | Cost @8s | Margin @8s | Cost @6s | Margin @6s |
|---|---|---|---|---|---|---|
| $7.99/mo | 5 | $6.79 | $6.30 | **+$0.49 (7%)** | $4.80 | +$1.99 (29%) |
| $14.99/mo | 12 | $12.74 | $15.12 | **−$2.38 (loss)** | $11.52 | +$1.22 (10%) |
| $14.99/mo | 5 | $12.74 | $6.30 | +$6.44 (51%) | $4.80 | +$7.94 (62%) |

To hit ~50% margin you must either price high for few videos ($14.99/mo for 5) or go 6s. **A metered sub is just "credits that expire monthly" — and that's a *worse* deal than our non-expiring credits unless we underprice it (killing margin).** That's the structural problem.

## 3. Product-fit & churn — the deeper issue
- **Usage is bursty, not monthly.** Kids' drawings arrive in waves (start of school, holidays, a rainy weekend), not on a billing cycle. Subscriptions monetize *steady* habits; they leak via churn when usage is sporadic.
- **Novelty churn is high.** Expect ~15–30%/mo for a consumer novelty app → average sub life ~3–5 months. The "gym membership" win (people pay and don't use) is undercut here: in the months they DON'T use, they churn; in the months they DO, it's an expensive burst.
- **Credits don't have a churn cliff.** A parent buys when inspired, comes back months later, buys again — every purchase is margin-positive and there's no "cancel" moment.

## 4. Head to head
| | Credits (current) | Monthly subscription |
|---|---|---|
| Fit with bursty usage | ✅ pay when inspired | ❌ pays for idle months / churns |
| High COGS protection | ✅ pay-per-use | ⚠️ only if capped tight (worse UX) |
| Revenue predictability | ❌ lumpy | ✅ MRR (if retained) |
| LTV if retained | medium | higher — *but* retention is the weak point here |
| Build cost | ✅ already shipped (consumables) | ❌ StoreKit2 subs + server receipt/ASSN v2 + entitlements + restore/grace — a real project |
| Risk | low | high (churn + COGS + bigger build) |

## 5. Hybrid (the only subscription worth revisiting)
If subscriptions return, the fit is **annual, archive-framed**, not monthly all-you-can-eat:
- **Annual "Family Keepsake" plan** (~$39.99/yr) bundling a video allotment (e.g. 24/yr ≈ 2/mo) + gallery perks (custom cover, unlimited image saves, priority). Annual smooths bursty usage and the "preserve a year of their art" story fits the product's emotional core better than a monthly meter.
- Or **hybrid**: keep credits as default; offer the annual plan as the committed-parent upsell; overflow beyond the allotment uses credits.

## 6. Recommendation
1. **Launch on credits**, repriced to ~$2/credit / ~63% margin (the balanced table in `growth/unit-economics.md`). It fits bursty + high-COGS usage, has no churn cliff, and is already built.
2. **Do not build a monthly subscription now** — wrong fit + a big StoreKit lift, on zero retention data.
3. **Revisit a subscription only after launch data shows BOTH:** (a) videos/active-user/month is *steady* across months (not one burst then silence), and (b) repeat-purchase rate is high enough that recurring billing would capture materially more than packs do. If both hold, pilot the **annual keepsake plan**, not a monthly meter.
4. **Update `CLAUDE.md`'s rejection note** to reflect this sharper rationale (it's not just "not enough data" — it's that high video COGS + bursty usage structurally favor credits; subs only make sense annual/hybrid once usage proves steady).

The metric that flips this: if monthly active creators reliably make ≥3–4 videos *every* month, a capped or annual sub starts to beat packs on LTV. Until that shows up, credits win.
