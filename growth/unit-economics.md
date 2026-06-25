# Draw Up — unit economics & "can ads work?" (2026-06-25)

Bottom line up front: **at today's settings the app loses money per signup, and paid ads cannot work.** The free video + thin per-pack margins sink it, and at Apple's 30% cut every pack is underwater. Three changes make the packs healthy (~30% margin) and per-signup slightly positive — but blended value per install is still **cents, not dollars**, so growth has to be viral/organic, not bought. Details below.

*Inputs cited from: `app/app/credits.tsx` (packs), `supabase/migrations/026_video_credits.sql` (image=1 credit, video=2, free grant=2), `growth/video-economics.md` (Veo 3 Fast $0.15/s w/ audio). Platform rate: Apple IAP takes 15% (Small Business Program, <$1M/yr — we qualify) or 30%.*

## 1. Cost per create
| Output | Components | Cost |
|---|---|---|
| Image | Claude vision + fal Flux Kontext | **~$0.06** |
| Video (8s) | image keyframe $0.06 + Veo 3 Fast 8s w/ audio $1.20 | **~$1.26** |
| Video (6s) | keyframe $0.06 + Veo 6s $0.90 | **~$0.96** |

Credits: image = 1, video = 2. Video is ~21× the cost of an image and is the only number that matters.

## 2. Per-pack margin — worst case (every credit spent on VIDEO)
Because video is the default, assume credits mostly become videos. Net = gross × (1 − Apple cut).

| Pack | Gross | Videos | Video cost (8s) | Net @15% | Margin @15% | Net @30% | Margin @30% |
|---|---|---|---|---|---|---|---|
| Starter $2.99 (4cr) | $2.99 | 2 | $2.52 | $2.54 | **+$0.02 (1%)** | $2.09 | **−$0.43** |
| Creator $9.99 (12cr) | $9.99 | 6 | $7.56 | $8.49 | **+$0.93 (11%)** | $6.99 | **−$0.57** |
| Family $19.99 (26cr) | $19.99 | 13 | $16.38 | $16.99 | **+$0.61 (3.6%)** | $13.99 | **−$2.39** |

- **At 30% Apple, all three packs lose money.** Enrolling in the Small Business Program (15%) is non-negotiable.
- **Even at 15%, margins are razor-thin (1–11%)** when credits go to video — nothing left to fund free trials or acquisition.
- Best case (all credits → images) is ~90% margin, but that's not the product you're pushing.

## 3. The free video is the killer
New signups get 2 credits = **1 free video ≈ $1.26 of compute given away each**. Per 1,000 signups that's **~$1,260** spent before anyone pays — and per-pack margin (~$0.93 on the popular pack) can't earn it back at realistic conversion.

## 4. LTV per signup — TODAY (15% Apple, video-default, ~$0.93 pack margin)
Assumptions stated; "margin/signup" = conversion × packs × pack-margin − free-tier cost.
| Scenario | Free→paid | Packs/payer | Margin/signup |
|---|---|---|---|
| Low | 2% | 1 | 0.02×$0.93 − $1.26 = **−$1.24** |
| Base | 5% | 2 | 0.05×$1.86 − $1.26 = **−$1.17** |
| High | 10% | 3 | 0.10×$2.79 − $1.26 = **−$0.98** |

**Underwater in every scenario.** The thin margin can't pay for the free video.

## 5. Can ads work? — No, not at these economics
Max sustainable CAC at a healthy 3:1 LTV:CAC = (margin/signup) ÷ 3. Today that's *negative*, so any paid install deepens the loss. Even after the fixes below (per-signup goes mildly positive), blended value is **~$0.02–$0.76 per signup** vs a realistic iOS parenting-app install cost of **~$2–6**. Ads are 5–250× underwater. This **confirms `CLAUDE.md`'s acquisition stance**: the product must grow by virality (the shareable video is the lever), not paid acquisition. Ads only flip positive at implausible conversion (>20%) or whale-level repeat spend.

## 6. The fixes (in leverage order)
1. **Enroll Apple Small Business Program → 15%.** Mandatory; at 30% nothing works.
2. **Make the free tier image-only (no free video).** Free-tier cost drops $1.26 → ~$0.06/signup. Single biggest swing. (New users still get the "wow" via a free image; video is the paid upgrade.)
3. **Drop video to 6s** (`FAL_VIDEO_DURATION=6s`): video cost $1.26 → $0.96. Current prices then yield real margin:

**Fixed model (15% Apple, 6s video $0.96, image-only free tier):**
| Pack | Net @15% | Videos | Cost | Margin |
|---|---|---|---|---|
| Starter $2.99 | $2.54 | 2 | $1.92 | +$0.62 (24%) |
| Creator $9.99 | $8.49 | 6 | $5.76 | **+$2.73 (32%)** |
| Family $19.99 | $16.99 | 13 | $12.48 | +$4.51 (27%) |

LTV/signup then: Low ≈ −$0.01 (break-even), Base **+$0.21**, High **+$0.76**. Positive, but still cents — reinforces "viral, not paid."

4. **Optional, for fatter margin:** raise credit price to ~$1.25–1.50/credit (e.g. Starter $4.99, Creator $13.99, Family $27.99) → ~35–45% margin even at 8s. Trade conversion for margin.

## 7. Compliance flag — Stripe → Apple IAP (required before launch)
Credit purchases currently run through **Stripe** (`supabase/functions/create-payment-intent`, `purchase-credits`, `stripe-webhook`). Apple **requires In-App Purchase for digital goods** (credits) — shipping Stripe for this will get the app **rejected**, and IAP imposes the 15–30% cut this whole model assumes. Migrating credit purchases to StoreKit/IAP is a pre-launch must, not optional. (Stripe stays fine for any future physical/print fulfillment.)

## Recommendation
Before App Store launch: (1) move credits to Apple IAP + enroll Small Business Program, (2) make the free tier one free **image**, not a video, (3) ship video at 6s. That yields ~30% pack margin and non-negative per-signup economics. **Do not budget for paid ads** — at <$1 blended value per install they can't pay back; put the energy into the shareable-video viral loop. Revisit pricing upward once real conversion/repeat data exists.
