# Draw Up — AI Video Clips → YouTube Shorts (scoped plan)

*Authored 2026-06-25. Plan only — no video code exists yet. This doc is written to be handed back as the build spec when we commit. Decision filter applies: every phase must move shares/transform or emotional impact, not just be cool.*

## The idea, stated precisely

Take the still image we already render (the transformed "world") and animate it into a **6–10 second portrait clip** where the scene comes alive — the monster blinks and breathes, the swirl spins, leaves drift — then stamp light Draw Up branding on it so it's ready to drop into **YouTube Shorts / TikTok / Reels** with zero editing. The clip is a distribution artifact: "AI turned my kid's drawing into THIS" is an already-proven viral format, and a moving version is dramatically more thumb-stopping than a still.

The keyframe is free — `supabase/functions/transform-artwork/index.ts` already produces a high-quality image, and the `description` already names the child's intent and the main subject. We are adding motion + branding on top of an asset we already have.

---

## Two different "video" features — don't conflate them

There is an existing backlog item, **Auto-MP4 before/after reveal**, that is a *different and cheaper* thing than this. Be explicit:

| | Before/after reveal (existing backlog) | Generative clip (this doc) |
|---|---|---|
| What | Deterministic wipe: drawing → wipe → rendered world → child name + watermark | AI animates the rendered world into living motion |
| Tech | ffmpeg / Skia animation, no AI | image-to-video model (paid) + motion-prompt AI |
| Cost | ~$0 per clip | ~$0.10–0.35 per clip (see below) |
| Latency | instant | 15–60s async |
| Risk | none (fully predictable) | medium (model can morph a fragile kid-art character) |
| Magic | high | very high |

**Recommended sequencing:** ship the **before/after reveal first** (cheap, deterministic, already covers the core viral format), prove it lifts shares/transform, *then* add the generative clip as a premium "make it move" upgrade. The generative clip is the epic version but it should not be the first video bet — it's the one that can occasionally produce a weird result, and it costs real money per generation.

---

## Provider recommendation (image-to-video)

We already use **fal.ai** for Flux Kontext, so staying on fal.ai for video keeps one vendor, one key, one billing surface. fal.ai hosts every major image-to-video model. Evaluation for *our* constraints (gentle coherent motion that won't grotesquely morph a child's character, 9:16, 5–10s, sane cost):

| Model (on fal.ai) | Motion quality | 9:16 / duration | ~Cost / 5s | Notes |
|---|---|---|---|---|
| **Kling 2.1 (image-to-video)** ⭐ | Excellent coherence, gentle | yes / 5–10s | ~$0.10–0.35 (std→pro) | Best balance. Strong at "one clear action + ambient motion" without destroying the subject. **Recommended default.** |
| Luma Ray2 (i2v) | Great aesthetic, dreamy | yes / 5–9s | ~$0.20–0.40 | Strong fallback; can be softer/flowier, nice for watercolor styles. |
| MiniMax Hailuo i2v | Good, cheaper | yes / ~6s | ~$0.10 | Budget option for high volume / curation seeding. |
| Veo 3 (i2v) | Best-in-class + native audio | yes / up to 8s | ~$0.40–0.75+ | Overkill on cost for v1; revisit if we want sound. Access can be gated. |

**Decision:** start on **Kling 2.1 image-to-video** (pro tier for hero clips, std for bulk/curation). Keep the provider behind a thin adapter so we can A/B Luma Ray2 on watercolor-style pieces. Budget **~$0.25/clip** for planning.

---

## Per-image motion prompt — the real craft

A generic "animate this" prompt produces drift and morphing. Each clip needs a **custom motion prompt derived from that specific image**, exactly like we already derive a custom Flux prompt. Add a Claude (vision) step:

**Input:** the transformed image + the `description` + the original Flux `prompt` (all already in the publish record).
**Output:** a short image-to-video motion prompt.

System-prompt rules for the motion-prompt generator:
- Choose **ONE primary action** the main character or focal element does — small, physically plausible, in-character (blink, breathe, tilt head, take one slow step, tail swish, wings settle). Never a full traversal across the frame.
- Add **ambient secondary motion**: drifting light, floating particles, swaying foliage, rippling water, a slow push-in or gentle parallax.
- **Protect the subject**: explicitly instruct "keep the character's shape, face, and colors stable; do not morph, melt, add, or remove features." Kid-art characters are fragile; this is the #1 failure mode.
- Match the **mood** of the description (cozy → slow and warm; wild → a touch more energy, still controlled).
- Keep it **6–8s**, loop-friendly if cheap to do.

### Worked example 1 — "The monster" (Josiah's orange three-eyed creature)
> Description on file: *"That orange creature has three big dark eyes and it looks like it is staring right at you — like it knows a secret! ..."*

Motion prompt: *"The orange three-eyed creature slowly blinks all three eyes in a gentle ripple, then its body breathes with one soft rise and fall. Warm orange light pulses faintly behind it; a few tiny glowing motes drift upward through the frame. Very slow, smooth push-in. Keep the creature's exact shape, three eyes, and orange color stable — no morphing, no extra limbs. Cozy, slightly mysterious, storybook mood. 7 seconds."*

### Worked example 2 — "Whirlpool" (blue/orange swirls)
> Description on file: *"Those blue and orange swirls are spinning so fast I can almost feel the wind! ..."*

Motion prompt: *"The blue and orange swirls rotate slowly and hypnotically around a calm center, like a gentle whirlpool turning in place. Soft light glints travel along the spiral arms; faint particles get drawn inward. No camera movement, no new shapes forming — just the existing swirl turning. Dreamy, mesmerizing, smooth loop. 6 seconds."*

---

## Branding (no heavy post-processing)

Goal: a small persistent watermark + an optional 1.5s end card, so re-shares carry attribution and pull new parents in — without us standing up a video-editing pipeline.

- **Watermark:** burn a small "drawup.ink" wordmark (gold on a soft pill) into the bottom-safe area. The child's name can sit beside it ("Riley · drawup.ink").
- **End card (phase 2):** 1.5s outro — logo + "Made with Draw Up" + URL.
- **How, without infra:** Supabase Edge (Deno) cannot run ffmpeg. Recommended path is a **managed video-transform service** — **Cloudinary** (upload the raw clip, apply a watermark overlay + optional spliced end-card via a transformation URL, fetch the result). Alternatives: Shotstack (templated edits), fal.ai's own ffmpeg/workflow endpoints. For v1 do **watermark-only via Cloudinary**; add the end card in phase 2. This avoids running our own ffmpeg box.

**Output spec:** 1080×1920, H.264 MP4, ~6–8s, target <10MB so it saves to camera roll and uploads to Shorts cleanly.

---

## Pipeline & product placement

Do **not** auto-generate on every transform (cost + 15–60s latency would wreck the create flow). Two viable triggers — recommend starting with the first:

1. **Opt-in action on a published piece** — "Bring this to life ▸ Make a video." Costs a credit (or a premium credit). Generates async; push/email or in-app notify when ready; saves to camera roll + opens the share sheet with a "Post to Shorts" nudge. Parent chooses to spend it on the pieces worth it.
2. **Auto-curate the winners** — generate clips only for top-voted pieces, to seed a Draw Up YouTube/TikTok channel. Cheap volume model (Hailuo), human glance before posting.

### New surface area when we build
- `supabase/functions/generate-clip/index.ts` — Claude motion-prompt → fal.ai Kling i2v → Cloudinary watermark → returns final MP4 url. JWT-verified, owner-only, credit-gated, debounced. (Edge function 150s envelope is tight for a 15–60s generation — use fal.ai's **queue/webhook** async API, not a blocking call; store status on the piece and notify on completion.)
- `pieces` columns: `clip_url`, `clip_status` (`none|queued|processing|ready|failed`), `clip_prompt`.
- App: a "Make a video" button on owner's piece detail; a small "▶ Watch it move" badge on pieces that have a clip; save-to-camera-roll + share.
- Migration for the new columns; analytics events `clip_requested` / `clip_ready` / `clip_shared`.

---

## Distribution: YouTube Shorts

- **Phase 1 (default): branded MP4 → manual upload.** We produce the 9:16 branded clip and save it to the camera roll (same mechanism as the planned reveal export). The parent uploads to Shorts/TikTok/Reels themselves. **Zero OAuth, zero platform risk.** This captures ~all the value — the friction is one tap to upload.
- **Phase 3 (optional, heavy): YouTube Data API v3 auto-upload.** Lets Draw Up post to a **community channel** (curation seeding) or a user's own channel. Significant cost: OAuth consent screen + verification, daily quota (uploads are quota-expensive), content-policy exposure, and a kids-content/COPPA "made for kids" flag decision on every upload. **Defer until manual Shorts shows real pull.**

---

## Phased rollout (build order)

- **Phase 0** *(separate item, do first)* — deterministic before/after reveal MP4 → camera roll on publish. Cheap, safe, covers the core format.
- **Phase 1 — Generative clip MVP.** `generate-clip` function (Claude motion-prompt → Kling i2v, async/webhook), watermark via Cloudinary, owner opt-in on a published piece, credit-gated + feature-flagged, save to camera roll. Cost guardrail: hard monthly cap + per-user rate limit.
- **Phase 2 — Polish.** End card, 9:16 framing QA, "Post to Shorts" share CTA, "▶ Watch it move" badge, Luma A/B for watercolor styles.
- **Phase 3 — Auto-curate + (optional) API publish.** Generate clips for top-voted pieces on the cheap model to seed a Draw Up Shorts channel; evaluate YouTube Data API only if manual sharing proves the channel works.

## Cost & risk guardrails
- ~$0.25/clip → 1,000 clips/month ≈ $250. Gate behind credits + a global monthly ceiling so a runaway loop can't bill us. Log every generation cost to `events`.
- Quality risk: kid-art characters morph easily. Mitigate with the subject-protection prompt rules, the gentle-motion bias, std-tier for bulk and pro-tier only for hero clips, and a "regenerate" affordance (the still is never lost; a bad clip is discardable).
- Reputational risk: a generated clip could go off-tone (same risk as image outputs, now moving). Before any *auto*-publish to a Draw Up channel, a human glances first. Manual-upload phases put the parent in the loop by design.

## Open questions for when we build
- Credit pricing for a clip vs a transform (a clip costs us ~5–10× an image — price accordingly, maybe a separate "video credit").
- Cloudinary vs Shotstack vs fal ffmpeg for the watermark step — pick during Phase 1 spike.
- Loop vs one-shot ending for Shorts (looping clips perform well on the format).
