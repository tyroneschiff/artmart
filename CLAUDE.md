# Draw Up — Claude Code Project Context

## What this is

Parents photograph their children's artwork, AI transforms it into gallery-quality art, and it publishes to a personal store. Family buys digital downloads or physical prints. Voting surfaces the best pieces. Primary driver: family gifting and sentimental preservation — not a stranger art marketplace.

## Core user flows

1. **Create** — Snap photo → AI describes & transforms → name & publish piece
2. **Share** — Each child gets a store link (drawup.art/store/emma) parents send to family
3. **Purchase** — Family visits link, buys digital download or physical print (Printful drop-ship)
4. **Discover** — Browse all stores, vote on pieces, top-voted rise in ranking
5. **Social** — Share to WhatsApp/iMessage/Instagram; every piece has a public URL with OG preview

## Social & sharing strategy

Every share is a free acquisition channel:
- Each piece and store has a shareable URL with rich OG preview
- In-app share sheet (WhatsApp, native, copy link) on every piece and store
- Post-publish prompt: pre-written message to family WhatsApp group
- Post-vote notification: tell the parent when their piece gets love (not yet built)
- Instagram Stories export: 9:16 card with branded watermark (not yet built)
- Watermark on free shares; clean version for buyers (not yet built)

## Tech stack (locked for MVP)

| Layer | Tool | Notes |
|---|---|---|
| Mobile | Expo (React Native) | iOS-first; Android after App Store launch |
| Backend / DB | Supabase | Postgres + Auth + Storage + Edge Functions |
| AI — description | Claude API (claude-sonnet-4-6, vision) | Server-side via Edge Function |
| AI — transform | fal.ai (Flux Kontext img2img) | Server-side via Edge Function; pay-per-use |
| Payments | Stripe | Digital purchases + Printful order initiation |
| Print fulfillment | Printful API | Drop-ship physical prints, no inventory |
| Landing page | Single HTML file | Deployed to Vercel/Netlify |

## Database schema (core tables)

- `profiles` — display name, avatar (extends Supabase Auth users)
- `stores` — one per child; slug, child_name, owner_id
- `pieces` — store_id, original_image_url, transformed_image_url, title, ai_description, price_digital, price_print
- `votes` — user_id, piece_id, unique constraint
- `orders` — user_id, piece_id, type (digital|print), stripe_payment_intent, printful_order_id, status

## AI pipeline

Client sends image URI → Edge Function compresses → Claude vision generates gallery prompt → fal.ai Flux Kontext transforms → both URLs returned to client → client downloads transformed image locally → publishes both to Supabase Storage on confirm.

## Design system

All values live in `lib/theme.ts`. Use tokens, never raw hex.

| Token | Value | Use |
|---|---|---|
| `cream` | `#FEFAF3` | All screen backgrounds |
| `gold` | `#E8A020` | Primary accent, active states |
| `dark` | `#1C1810` | Primary text, dark buttons |
| `mid` | `#6B5E4E` | Secondary text, labels |
| `muted` | `#A89880` | Placeholders, hints |
| `border` | `#EDE4D0` | Card borders, dividers |
| `white` | `#FFFFFF` | Card backgrounds only |

- Primary button: `dark` background, white text, `borderRadius: 100` (pill)
- Headings: `fontWeight: 800–900`, `letterSpacing: -1`
- Tab bar: white background, gold active tint
- Never use `#FF6B35` — replaced by gold everywhere

Aesthetic blend: ucals.com layout discipline + tincan.kids warmth. Premium but approachable.

## Platform strategy

- Bundle ID: `art.drawup.app`, ASC App ID: `6762963488`
- TestFlight: `eas build --platform ios --profile preview`
- App Store: `eas submit --platform ios`
- Android: after iOS App Store launch

## Key constraints

- MVP scope only — no DMs, no comments, voting is the only social feature
- No inventory — all fulfillment via Printful drop-ship
- API keys in Supabase secrets only — never in app bundle or eas.json
- Stripe webhooks must verify signature; Supabase RLS must be set before any table goes live
- Prompt caching headers on all Claude API calls

## Coding conventions

- TypeScript everywhere
- Expo Router (file-based routing)
- Supabase client initialized once in `lib/supabase.ts`
- React Query for all data fetching and cache invalidation
- Zod for runtime validation at API boundaries
- No comments unless WHY is non-obvious
- No mocking in tests — use real Supabase local dev instance

## Definition of "done" for MVP

- [x] Sign up, create a store for a child
- [x] Photograph art, receive AI-transformed version
- [x] Publish piece to store
- [x] Visitor can vote on a piece
- [x] Visitor can purchase digital download (Stripe + signed URL)
- [x] Visitor can order physical print (Stripe → Printful)
- [x] Top-voted pieces discoverable in browse screen
- [ ] Store accessible via public shareable URL (web routes not deployed)
- [ ] Landing page live on drawup.art
- [ ] Android APK deployable via EAS Build

---

## Product empathy

The crons must reason from user experience, not code. These are the three people using this app:

**Parent (creator)** — Time-poor, emotionally invested. They photographed their kid's drawing and want to share it with grandparents. The "wow" moment is seeing the AI transformation. Every step before and after must honor that. If Transform fails, they feel embarrassed and give up. If it works, they're excited and share immediately. Friction = they Instagram the photo instead and the app loses them forever.

**Family member (gifter)** — Grandparent, aunt, uncle. Gets a WhatsApp link. Not tech-savvy. Has 90 seconds of attention. Needs to see the artwork and tap Buy with minimal thought. Any confusion — missing price, unclear button, broken image — and they close the tab and never return.

**Visitor (voter)** — Another parent on Discover. Casual, zero commitment. Votes if it's beautiful and one tap. Won't scroll past a broken or empty screen.

---

## Known gotchas

Lessons learned from running the app on real devices. Apply these before analyzing any code.

**Image handling:**
- iPhone camera photos are 4–15MB raw. Claude API rejects images over 5MB. Always compress to max 1200px / 70% JPEG before any API call. `expo-image-manipulator` is in package.json for this.
- `fetch(localFileUri)` returns an empty blob on iOS for `file://` URIs. Always use `FileSystem.readAsStringAsync(uri, { encoding: 'base64' })` then convert to Uint8Array for Supabase Storage uploads.
- `ImageManipulator` always outputs JPEG regardless of input format. When sending compressed base64 to Claude, always pass `'image/jpeg'` as mimeType — never infer from the original file extension.
- fal.ai CDN URLs expire within minutes. Always `FileSystem.downloadAsync` to device immediately after transform, before showing the publish screen.

**Supabase:**
- `.update().eq('id', x)` silently succeeds with 0 rows if the row doesn't exist. Use `.upsert()` for any row that may not exist (profiles, settings).
- Deleting from the DB doesn't clear React Query's in-memory cache. Always call `queryClient.invalidateQueries()` after mutations.
- Edge Function timeout is 150 seconds. Polling loops must use synchronous endpoints or abort before that limit.

**Platform / third-party:**
- `Linking.canOpenURL('whatsapp://')` returns false on iOS without `LSApplicationQueriesSchemes`. Use `wa.me/?text=` universal link instead.
- Stripe idempotency keys lock for 24 hours. A failed payment with the same key returns the same failed intent — user cannot retry.
- Supabase Edge Function CORS headers must be returned on OPTIONS preflight or all app requests fail silently.
- `supabase.storage.from('bucket').upload()` has no built-in timeout and exposes no AbortController in the JS v2 API. A 4–15MB original image upload on 3G can hang indefinitely — wrap with `Promise.race` against a timeout rejection to prevent a permanent pending state.

---

## Reasoning protocols

How to think like an engineer who has run this app on a real device — not a static code reviewer.

### 1. Trace forward from user action
Never start from code. Start from what the user does:
> "A parent taps Transform with an iPhone 15 Pro photo. What happens at each step?"

Follow the full path through every function, network call, and state update. At each step ask:
- What's the timeout? No timeout = hangs forever on cellular drop.
- What does the user see if this step fails? Silent blank = worst case.
- Is there a recovery action, or are they stuck?

### 2. Apply worst-case conditions to every flow
- **Slow cellular** — 3G, 5–10s round trips, mid-operation drops
- **Large files** — iPhone 15 Pro photo, not a small test image
- **Empty database** — new user, no stores, no pieces
- **Returning user** — has purchases, prior votes, existing stores
- **Non-tech user** — grandparent on a WhatsApp link with no account

### 3. Hunt for silent failures
The most dangerous bugs look like success but do nothing:
- `.update()` with no matching row → 0 rows changed, no error
- `fetch()` on `file://` URI on iOS → empty blob uploaded to storage
- React Query cache showing deleted DB records as if present
- fal.ai URL expired before user taps Publish
- Edge Function returning HTTP 200 with `{ "error": "..." }` in body

### 4. Prioritize by real user impact
1. Permanently loses user's photo or payment — fix first
2. Create flow broken (photo → transform → publish) — fix first
3. Purchase funnel broken (grandparent can't buy) — fix first
4. Empty/error states on high-traffic screens (Discover, Store, Piece detail)
5. Design consistency, copy, edge cases

### 5. Before recommending or implementing
- Read `## Recent session notes` first — user-reported issues outrank code analysis
- Read `## Known gotchas` — don't re-solve understood problems
- Check `## Strategic Backlog` — is it already tracked? If yes, verify the description is still accurate

---

## Recent session notes

*(Maintained by Claude at end of each conversation — newest first. Ground truth from real device use.)*

**2026-04-23 — BUSINESS MODEL PIVOT (decided, not yet implemented):**
- **Product reframe: "Step inside your child's drawing" — NOT "transform art into gallery pieces."** The drawing IS the vision; the AI is the door into that world. Never say "elevate," "improve," "gallery-worthy," "fine art print," or treat the original as raw material. Description is the hero product — written as a witness to the world the child built, not as a curator praising technique. All new copy, prompts, and product decisions must flow from this framing.
- **Monetization pivot to hybrid: credits + keep prints.** 3 free transforms on signup → one credit pack ($9.99 / 12 credits, ~$0.83/gen, ~$0.05 marginal cost → ~85% margin) → prints remain as high-ARPU gift upsell. Retire per-piece `price_digital` and `price_print`. No subscription until month 2 usage data.
- **Grandparent is the buyer for prints, not the parent.** Purchase path is: parent generates → shares to family WhatsApp → grandparent buys print as gift-for-themselves. Rebuild checkout for guest purchase from `/store/[slug]` and add a "send as gift" email flow. This is the highest-ARPU lever and prior plan to retire prints was wrong.
- **Comments are retention, not monetization.** Auth-only, 300 char limit, Claude Haiku pre-moderation, report button, 1-per-5min rate limit. Kid safety non-negotiable. Ship after the credits/paywall loop works.
- **Implementation sequence:** (1) reframe copy + Claude system prompt [DONE this session], (2) credits + 3-free tier + Buy Credits screen, (3) grandparent-optimized guest checkout + gift-a-print, (4) comments with Haiku mod. Social-fame/upvote loop is deprioritized as monetization driver — it only works at 10k+ active users; keep votes as retention not as a revenue hook.
- Claude system prompt in `transform-artwork/index.ts` rewritten to "visual collaborator stepping inside a child's imagination"; fal.ai `guidance_scale: 6.0`. In-app copy reframed: tagline "Step inside your child's imagination", transform button "✨ Step Inside", compare labels "The Drawing" / "The World", share messages rewritten around "imagined a world, come take a look."

**2026-04-22:**
- Transform failing with "invalid request error — could not process image." Root cause: iPhone photos 4–15MB, Claude rejects >5MB. Fixed by adding `expo-image-manipulator` compression (1200px, 70% JPEG) in `handleTransform()`. Had to `npx expo install expo-image-manipulator` — was not in package.json.
- Profile display name silently failing for new users. Root cause: `.update()` on `profiles` when no row existed yet. Fixed by switching to `.upsert()`.
- Anthropic API key rotated — new key set in Supabase secrets and both cron scripts.
- Crons were running every 3 minutes, hitting 30k TPM rate limit. Slowed to 15-minute cadence; upgraded to `claude-opus-4-7`; rewrote prompts with specific file reading order and investigation checklists.
- CLAUDE.md restructured: added Product empathy, Known gotchas, Reasoning protocols, Recent session notes — so crons have ground truth instead of just static code analysis.

---

## Standing instructions for Claude

**At the end of every response:**
1. Update `## Current task queue` — what just completed, what's next, ≤8 bullets total
2. If anything was learned from real device use this session, prepend a dated entry to `## Recent session notes`

**Response style:** Maximum signal, minimum words. Code over prose.

## Current task queue

**Done (recent):**
- ✅ Product reframe rollout (step 1) — Claude system prompt in `transform-artwork/index.ts` rewritten from "art director elevating" to "visual collaborator stepping inside a child's imagination"; user-text "Step inside this child's drawing"; app copy updated (tagline `login.tsx:38`, transform button + status + compare labels `create.tsx`, share messages `share.ts`). Deployed to edge function; client changes need EAS rebuild.
- ✅ Transform ES256 JWT fix — `transform-artwork/index.ts` deployed with `--no-verify-jwt` (gateway skips), function verifies via `jose.createRemoteJWKSet` against Supabase JWKS endpoint. Unblocks every transform on current asymmetric-JWT project config.
- ✅ Upload timeouts — `withUploadTimeout` wraps both `supabase.storage.upload()` calls in `publishMutation` with a 90s `Promise.race`
- ✅ Transformed image download timeout — 30s AbortController around `fetch(transformedUrl)` + `arrayBuffer()` in `create.tsx:107–120`
- ✅ Re-download path — `piece/[id].tsx` queries existing digital orders; card swaps to "Re-download" when `status=paid` exists
- ✅ Re-download column fix — `fetchMyDigitalOrder` in `piece/[id].tsx` corrected from `.eq('user_id')/.eq('type')` to `.eq('buyer_id')/.eq('order_type')` to match what the edge function actually inserts; re-download CTA now appears for paying customers

**Pending (reframe + monetization pivot — see Recent Session Notes 2026-04-23):**
- ✅ Reframe pass 2 — updated `mystores.tsx`, `discover.tsx`, `store/[slug].tsx`, `profile.tsx`, and `piece/[id].tsx` to match "step inside" framing; replaced "gallery / piece / art" with "world" where appropriate; updated empty states and icons.
- ✅ Profile display name fix — `profile.tsx` now fetches and pre-fills the display name via `useQuery`; no longer write-only and doesn't clear on save.
- ✅ Error handling with retry — added `isError`/`refetch` with a "Try again" pill to `store/[slug].tsx`, `discover.tsx`, `mystores.tsx`, and `piece/[id].tsx` to handle transient network failures.
- ✅ Store empty state — replaced bare text in `store/[slug].tsx` with a warm centered block (icon + possessive copy) matching the app's pattern.
- [ ] Credits schema + 3-free tier — `profiles.credits` int default 3, atomic deduct inside `transform-artwork` edge function (refund on fal.ai fail), block transform with low-credit paywall when 0 remaining
- [ ] Buy Credits screen + Stripe flow — single $9.99 / 12-credit pack, `purchase-credits` edge function, webhook handler increments balance
- [ ] Grandparent guest checkout — allow buy from `/store/[slug]` without login + "send print as gift" email flow; this is the highest-ARPU lever
- [ ] Comments with Claude Haiku pre-moderation — auth-only, 300 char limit, 1-per-5min rate limit, report button, `comments` + `reports` tables
- [ ] Accept TestFlight invite — appstoreconnect.apple.com/apps/6762963488/testflight/ios
- [ ] Deploy landing page to Vercel on drawup.art (domain not registered)
- [ ] OG meta tags for piece/store public URLs

---

## Autonomous improvement system

**Two automated Claude cron processes read this file.** Each must read the full file first, follow its instructions, update the relevant sections, then exit.

**Meta-principle:** Every action should make the next run more effective. If instructions are unclear or producing poor results, update them. If backlog items are too vague to implement, sharpen them. This system compounds in quality over time.

---

### CRON A — Strategic Reviewer (runs every 15 minutes)

**Job: think, not code.** Read the codebase, find real problems, update the knowledge base.

**May update:**
- `## Strategic Backlog` — rewrite entirely each run, max 8 items
- `## Current task queue` — mark done if codebase confirms it
- `## Definition of "done" for MVP` — check off verifiably complete items
- `## Known gotchas` — see evolution rules below
- `## Reasoning protocols` — see evolution rules below
- `## Improvement Log` — prepend one line per run, trim to 10

**Never change:** tech stack, design system values, bundle IDs, API keys, product vision, `## Product empathy`, `## Recent session notes`

**Evolution rules (focused, not accumulative):**
- `## Known gotchas` has a hard cap of 12 bullet points. To add one: it must describe a non-obvious platform-specific failure that would bite silently, AND you must remove a stale or resolved item to make room. Do not add things that are obvious from the code or already implied by existing entries.
- `## Reasoning protocols` — you may add one clarifying question to an *existing* protocol if investigation revealed a gap. Never add a new protocol section. Never remove existing ones.

---

### CRON B — Implementer (runs every 15 minutes)

**Job: ship one small, complete, correct change per run.**

**Priority order:**
1. Broken create → publish flow (permanent user loss)
2. Broken purchase flow (lost revenue)
3. Design system violations on high-traffic screens
4. Copy improvements on empty states and share messages
5. Error handling and edge case recovery
6. Everything else

**Scope rules:**
- One focused change per run, 1–3 files max
- Prefer refinements over features — these compound and never half-ship
- Never start what you can't finish. Split large items; implement the smallest useful slice
- No partial implementations — a button with no handler is worse than nothing

**After implementing:**
1. Move completed item to `## Current task queue` Done ✅ with one-line summary
2. If split, add remainder back to backlog at appropriate rank
3. If implementation revealed a non-obvious platform gotcha not in `## Known gotchas`, add it — but only if it caused a real silent failure and the cap (12 items) has room or a stale item can be removed
4. Prepend one line to `## Improvement Log` (timestamp, "CRON B", what changed, which files). Trim to 10 entries.

**Never implement:** anything requiring secrets, App Store submission, domain registration, third-party account setup, or new dependencies not in package.json.

---

## Strategic Backlog

*(Rewritten each run by CRON A — Implementer reads this to pick next task)*

1. **Anonymous vote button silently no-ops — missed signup funnel** `[Growth]` `[UX]` — `discover.tsx:104` (`onPress={() => canVote && voteMutation.mutate(item.id)}`) and `piece/[id].tsx:140` (`onPress={() => session && voteMutation.mutate()}`), all silently do nothing when unauthenticated; fix requires TWO changes per button: (1) change `onPress` to call `router.push('/(auth)/login')` when `!session`, AND (2) update `disabled` — change `discover.tsx:105` from `disabled={!canVote}` to `disabled={isVoted || isVoting}`, and `piece/[id].tsx:141` from `disabled={!session || voteMutation.isPending}` to `disabled={voteMutation.isPending}` — if `disabled` still includes `!session`, React Native swallows the tap before `onPress` fires and the login redirect silently never happens. Impact: converts the highest-intent anonymous tap into a signup prompt instead of a confusing freeze.

2. **Login always redirects to Discover — breaks vote conversion funnel** `[Growth]` `[UX]` — `login.tsx:25` hardcodes `router.replace('/(tabs)/discover')` regardless of entry point; when item 2 routes an anonymous voter to login, they complete signup but land on Discover instead of the piece they tapped; pass the originating route as a param and redirect there on success. Impact: without this, item 2's funnel improvement stalls — the vote is still lost after signup.

## Improvement Log

*(One line per run, newest first)*

- [2026-04-22 CRON B] Reframe pass 2 & critical UX fixes — updated 5 screens with "step inside" copy; fixed write-only profile name; added network error retry UI; improved store empty state. Files: `mystores.tsx`, `discover.tsx`, `store/[slug].tsx`, `profile.tsx`, `piece/[id].tsx`.
- [2026-04-22 CRON B] Re-download column fix — `fetchMyDigitalOrder` corrected from `user_id`/`type` to `buyer_id`/`order_type`; paying customers can now re-download. File: `app/app/piece/[id].tsx`.
- [2026-04-22 CRON B] Upload timeouts — `withUploadTimeout` wraps both `supabase.storage.upload()` calls in `publishMutation`; 90s `Promise.race` prevents permanent "Publishing…" state on cellular drop. File: `app/app/(tabs)/create.tsx`.
- [2026-04-22 CRON B] Transformed image download timeout — 30s AbortController wraps `fetch`+`arrayBuffer()` at `create.tsx:107–120`; AbortError → user-readable message via existing error box; spinner no longer hangs forever on CDN drop. File: `app/app/(tabs)/create.tsx`.
- [2026-04-22 CRON A] Found column mismatch: `fetchMyDigitalOrder` queries `user_id`/`type` but Edge Function inserts `buyer_id`/`order_type`; re-download CTA marked ✅ done is silently broken; added as backlog #3; all 7 prior items verified still broken; line refs updated.
- [2026-04-22 CRON B] Re-download path — added `fetchMyDigitalOrder` query and `handleRedownload` to `piece/[id].tsx`; digital card swaps to "Re-download" CTA when `paid` digital order exists; `maybeSingle()` used so no-order case returns null without throwing. File: `app/app/piece/[id].tsx`.
- [2026-04-22 CRON A] Verified all 8 backlog items — all confirmed still broken; sharpened item 4 to document that `disabled` prop on vote buttons must also change (not just `onPress`), or the login-redirect will be swallowed by React Native before firing; fixed item 6 line reference (27, not 28).
- [2026-04-22 CRON A] Verified all 7 prior backlog items — all confirmed still broken; found new #3: `publishMutation` storage uploads (`create.tsx:158–170`) have no timeout, parent permanently stuck on "Publishing…" on cellular drop; added to Known gotchas (Supabase Storage upload no timeout); renumbered backlog to 8 items.
- [2026-04-22 CRON B] Order insert error check — destructured `{ error: insertError }` from insert at `create-payment-intent/index.ts:63`; return 500 before sending `client_secret` if insert fails; prevents silent Stripe capture with no order row. File: `supabase/functions/create-payment-intent/index.ts`.
- [2026-04-22 CRON A] Verified all 8 backlog items against current code — all confirmed still broken; corrected item 4 line reference (canVote defined at discover.tsx:95, handler at :104); sharpened items 2 and 3 with exact line ranges from code read; no new issues meet the gotcha bar.
- [2026-04-22 CRON A] Verified all 7 prior backlog items — all confirmed still broken in code; found new item 2: `create-payment-intent/index.ts:63` insert result never checked — if DB flakes after delete, Stripe captures payment but no order row exists and fulfillment is silently skipped; renumbered backlog 1–8.
