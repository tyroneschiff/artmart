# Video pivot — economics recon (Phase 0)

*Authored 2026-06-25. Gate before building the "every create is a video" pivot. Prices verified against fal.ai model pages.*

## Native-audio model options (fal.ai, image-to-video WITH synced audio)

| Model | Endpoint | Price (audio on) | 8s clip | Notes |
|---|---|---|---|---|
| **Veo 3 Fast** ⭐ | `fal-ai/veo3/fast/image-to-video` | **$0.15/s** | **~$1.20** | Cheapest native-audio option. The only viable choice. |
| Veo 3 (standard) | `fal-ai/veo3/image-to-video` | $0.40/s | ~$3.20 | 2.7× the cost; not worth it for our use. |

Both return `{ video: { url } }` (clip-webhook already parses this). Veo 3 generates **8-second** clips (treat 8s as the cost basis; confirm the exact duration enum at build time). Audio is a paid add-on (already included above).

## What a "create" costs now vs. before

| | Old (image only) | New (image → Veo 3 Fast video w/ audio) |
|---|---|---|
| Claude vision (description + prompt) | ~$0.02 | ~$0.02 |
| fal Flux Kontext (image) | ~$0.04 | ~$0.04 (keyframe) |
| Veo 3 Fast 8s + audio | — | **~$1.20** |
| **Per create** | **~$0.06** | **~$1.26** (≈ 21×) |

## The problem: current pricing loses money on every create

Credit pack today ≈ **$9.99 / 12 credits = $0.83/credit**. A create is **1 credit**.

| Price per create | User pays | Our cost | Margin |
|---|---|---|---|
| **1 credit (current)** | $0.83 | $1.26 | **−$0.43 (LOSS)** |
| 2 credits | $1.66 | $1.26 | +$0.40 (24%) |
| 3 credits | $2.50 | $1.26 | +$1.24 (50%) |

And **3 free creates per signup** now = **3 × $1.26 ≈ $3.78 of compute given away per new user** (was ~$0.18). Against ~$42 LTV that's survivable IF a healthy fraction convert — but if most never pay, it's a real bleed, and the viral kill-criteria (shares/transform) don't care about it.

## Recommendation

1. **Use Veo 3 Fast**, not standard Veo 3 (2.7× cheaper for the same idea).
2. **Reprice a video-create to 2–3 credits** (or raise the pack price). At 1 credit we lose money on every paid create — non-negotiable to fix before turning this on for everyone.
3. **Cut free creates 3 → 1.** Give one free *video* — that's the wow that converts — then video costs credits. One free video ≈ $1.26 CAC-equivalent, reasonable.
4. **Keep a cheap/free image-only "skip the video" path** for users out of credits and for cost control — preserves activation without the $1.26 hit every time. (This also answers the open question: image-only should remain an option.)
5. Revisit once real usage data exists; shorter durations or batch pricing may help.

## Decisions (confirmed 2026-06-25)
- **Model:** Veo 3 Fast (`fal-ai/veo3/fast/image-to-video`), 8s, audio on. ~$1.20/clip.
- **Price:** a video = **2 credits** ($1.66 rev vs $1.26 cost ≈ 24% margin). Implemented in migration 026 + generate-clip (`CLIP_CREDITS`, env-overridable).
- **Free:** new signups get **2 credits = exactly one free video** (profiles.credits default 3→2 in migration 026).
- **Shape:** **1 free video → then video costs 2 credits → image-only always available (free)**. NOT "every create forces a paid video."
- **Image-only:** stays as the free, always-available fallback. (Needs a per-user daily cap when image becomes free, to bound abuse — fast-follow in the app-rework phase.)

## Margin levers if costs bite
- Drop Veo duration 8s → 6s (`FAL_VIDEO_DURATION=6s`): ~$0.90/clip → ~42% margin at 2 credits.
- Raise to 3 credits (`CLIP_CREDITS=3`): ~50% margin.
