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
| AI — description | Gemini API (gemini-2.5-flash) | Server-side via Edge Function |
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

Client sends image URI → Edge Function compresses → Gemini 2.0 Flash vision generates gallery prompt → fal.ai Flux Kontext transforms → both URLs returned to client → client downloads transformed image locally → publishes both to Supabase Storage on confirm.

## Design system

All values live in `lib/theme.ts`. Use tokens, never raw hex.

| Token | Value | Use |
|---|---|---|
| `cream` | `#FEFAF3` | All screen backgrounds |
| `gold` | `#E8A020` | Primary accent, active states |
| `dark` | `#1C1810` | Primary text, dark buttons |
| `mid` | `#6B5E4E` | Secondary text, labels |
| `muted` | `#A89880" | Placeholders, hints |
| `border` | `#EDE4D0" | Card borders, dividers |
| `white` | `#FFFFFF" | Card backgrounds only |

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
- GOOGLE_GENERATIVE_AI_API_KEY must be set in Supabase secrets for transforms to work

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

**2026-04-23 — GEMINI MODEL UPGRADE:**
- Upgraded Gemini model from `gemini-2.0-flash` to `gemini-2.5-flash` in `moderate-comment` and `transform-artwork` edge functions.
- Root cause: `gemini-2.0-flash` was returning 404/400 errors via v1beta API; `gemini-2.5-flash` is the current stable version.
- Verified API key functionality with `gemini-2.5-flash` using manual curl tests.

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
- CLAUDE.md restructured: added Product empathy, Known gotchas, Reasoning protocols, Recent session notes — so crons have ground truth instead of any static code analysis.

---

## Standing instructions for Claude

**At the end of every response:**
1. Update `## Current task queue` — what just completed, what's next, ≤8 bullets total
2. If anything was learned from real device use this session, prepend a dated entry to `## Recent session notes`

**Response style:** Maximum signal, minimum words. Code over prose.

## Current task queue

**Done (recent):**
- ✅ Digital Retirement & Creator Ownership — Retired per-piece digital pricing from creator flow; hidden digital download option for non-owners; granted free digital access to owners.
- ✅ "Step Inside" Narrative Polish — Reframed purchase section to "Bring this world home"; renamed digital product to "Keep the high-res vision"; added "✨ Step inside... imagination" magic label.
- ✅ Guest Checkout for Prints — Implemented seamless guest checkout for print orders, allowing unauthenticated users to purchase physical prints and include a gift message.
- ✅ Prepare for iOS Release (v1.1.0) — audited codebase for "Step Inside" theme alignment; performed TypeScript sanity check; removed unused Anthropic SDK; bumped app version to 1.1.0 and build number to 10.
- ✅ Global ES256 JWT fix — applied manual `jose` JWT verification to all authenticated edge functions (`create-payment-intent`, `download-piece`, `purchase-credits`, `moderate-comment`); bypasses default gateway 401 error on asymmetric JWT projects.
- ✅ Moderated comments — added `comments` and `reports` tables; implemented `moderate-comment` edge function with Gemini 2.0 Flash moderation and 5-min rate limiting; added comments section to `piece/[id].tsx` with real-time updates and report flow.
- ✅ Credits system & paywall — added `credits` and `credit_transactions` to schema; implemented `purchase-credits` edge function; added `CreditsScreen` modal and `ProfileScreen` integration; `transform-artwork` now handles atomic credit deduction and 402 out-of-credits state.
- ✅ Anonymous vote conversion — `discover.tsx` and `piece/[id].tsx` now redirect unauthenticated voters to login instead of silently no-oping; `disabled` state updated so button remains clickable for guests.

**Pending (reframe + monetization pivot — see Recent Session Notes 2026-04-23):**
- [ ] EPIC: "Send Print as Gift" Email Flow — Micro-Task 1: Add gift columns to `orders` table.
- [ ] Prominent "Buy Credits" CTA & UX Polish — Micro-Task 1: persistent "Out of Credits" card.
- [ ] Android compatibility audit — test all core flows on Android.
- [ ] OG meta tags for piece/store public URLs


---

## Autonomous improvement system

**Two automated Gemini cron processes read this file.** Each must read the full file first, follow its instructions, update the relevant sections, then exit.

**Meta-principle:** Break large holistic objectives (Epics) down into manageable, bite-sized micro-tasks. Every run should take a 360-degree view, but execute surgically. Drive Revenue or add Polish.

---

### Syncing with the Autonomous Team
Because the autonomous team runs 24/7 on GitHub Actions, your local Mac will fall out of sync. **Always run `./scripts/sync-local.sh` before you start working** to pull the team's latest code.

---

### CRON A — Strategic Product Lead (runs every 15 minutes)

**Job: Think holistically, plan surgically.** Audit the app from a 360-degree view, find the 'leaky buckets', and define the micro-tasks.

**Priorities:**
1. **Revenue:** Where is the buy path broken or hidden?
2. **UX Clarity:** Is the 'Step Inside' magic obvious to a new user?
3. **Design Debt:** Where are we violating the `lib/theme.ts` standards?

**Mandates:**
- `## Strategic Backlog` — You MUST break Epics down into numbered micro-tasks. Never put "Build Comments Feature" in the backlog. Put "1. Add Comments schema", "2. Build Comment Edge Function", "3. Create UI". Rank by business impact.
- `## Current task queue` — Mark items done if verified in code.
- `## Known gotchas` — Platform-specific silent failures only.

---

### CRON B — Principal Product Engineer (runs every 15 minutes)

**Job: Ship one high-polish, revenue-driving micro-task.**

**Execution rules:**
1. **Bite-Sized Action:** Take exactly ONE micro-task from the Strategic Backlog.
2. **Surgical Strike:** Implement the change in 1-3 files max. Ensure it is fully tested and visually polished using `lib/theme.ts` tokens.
3. **No Dead Ends:** Every CTA must have a success state or error handler. Handle network timeouts.
4. **Log the Win:** Move the completed micro-task to 'Done' and state the NEXT required micro-task in the backlog if the Epic continues.

---

## Strategic Backlog

*(Rewritten each run by CRON A — Implementer reads this to pick next task)*

1. **[REVENUE] EPIC: "Send Print as Gift" Email Flow**
    *   **Micro-Task 1 (Database):** Add `gift_recipient_email` and `gift_message` columns to the `orders` table in a new migration to support gift-specific metadata.
    *   **Micro-Task 2 (Edge Function):** Update `supabase/functions/stripe-webhook/index.ts` to extract `gift_recipient_email` and `gift_message` from the Stripe metadata and save them to the `orders` table.
    *   **Micro-Task 3 (Integration):** Integrate an email service (e.g., Resend) in the webhook to send a "A gift is coming!" email to the recipient with the parent's message upon successful payment.

2. **[REVENUE] Prominent "Buy Credits" CTA & UX Polish**
    *   **Micro-Task 1 (UI/UX):** Replace the standard `Alert` for `OutOfCreditsError` in `app/app/(tabs)/create.tsx` with a persistent, styled "Out of Credits" card in the UI that includes a "Buy Credits" button.
    *   **Micro-Task 2 (UI/UX):** Add a "Buy Credits" pill/button to the `CreditsScreen` header or balance card if balance is 0, ensuring the path to purchase is always one tap away.

3. **[UX] Android Full Compatibility Audit & Fixes**
    *   **Micro-Task 1 (Audit):** Test the full camera → transform → publish flow on an Android emulator or device, specifically checking if `FileSystem.readAsStringAsync` and `ImageManipulator` behave as expected with `file://` URIs.
    *   **Micro-Task 2 (Fixes):** Apply Android-specific fixes identified in the audit to `app/lib/transformArtwork.ts` and `app/app/(tabs)/create.tsx`.

4. **[UX] Public Store & Piece OG Meta Tags**
    *   **Micro-Task 1 (Edge Function):** Create a simple Edge Function or update the landing page to serve dynamic OG tags (image, title) for piece URLs so they look stunning when shared on WhatsApp/Instagram.

5. **[RETENTION] Post-Publish Share Prompts**
    *   **Micro-Task 1 (UI/UX):** After a successful publish in `app/app/(tabs)/create.tsx`, show a specific "Share to Family WhatsApp" button with a pre-filled emotional message ("Look at the world [Name] imagined!").

## Improvement Log

*(One line per run, newest first)*

- [2026-04-23 CRON B] Digital Retirement & "Step Inside" Polish — Removed creator-facing prices from `create.tsx`; retired per-piece pricing in `store/[slug].tsx`; hidden digital downloads for non-owners and granted free creator access in `piece/[id].tsx`; reframed UI to "Bring this world home" and added "✨ Step inside... imagination" label.
- [2026-04-23 CRON A] Performed 360-degree audit; identified legacy digital pricing as a "leaky bucket" for the new "Step Inside" value prop; prioritized retirement of per-piece digital sales and granting ownership to creators; refined gifting and credits tasks for tighter execution.
- [2026-04-22 CRON A] Performed a comprehensive audit of the product backlog against the recent business model pivot, refining existing micro-tasks to be more surgical and prioritizing them for maximum revenue and UX impact, particularly focusing on credit purchase flow and Android compatibility.
- [2026-04-22 CRON B] Guest Checkout for Prints — Implemented seamless guest checkout for print orders, allowing unauthenticated users to purchase physical prints and include a gift message. Files: `app/app/piece/[id].tsx`, `app/lib/checkout.ts`, `app/components/GuestPrintInfoModal.tsx`, `supabase/functions/create-payment-intent/index.ts`.
- [2026-04-22 CRON B] Version bump & Sanity Check — bumped to v1.1.0; removed Anthropic SDK; updated Credits UI logic to navigate to modal. Files: `app.json`, `package.json`, `create.tsx`.
- [2026-04-22 CRON A] Strategic Backlog rewritten to align with "Step Inside" reframing and credit-based monetization; prioritized Grandparent Guest Checkout and Gifting, Prominent "Buy Credits" UX, Android Compatibility, OG Meta Tags, "Step Inside" UI Consistency, and Notifications/Share Prompts.
- [2026-04-22 CRON B] Guest Checkout for Prints — Implemented UI for guest info collection, updated `create-payment-intent` edge function, and `purchasePiece` to support guest orders. Files: `app/app/piece/[id].tsx`, `app/lib/checkout.ts`, `app/components/GuestPrintInfoModal.tsx`, `supabase/functions/create-payment-intent/index.ts`, `supabase/migrations/005_guest_checkout.sql`.
- [2026-04-22 CRON B] Moderated comments — added schema, moderation edge function, and UI for Piece detail screen. Files: `piece/[id].tsx`, `moderate-comment/index.ts`, `004_comments.sql`.
- [2026-04-22 CRON B] Credits system & Monetization — implemented credits schema, purchase flow, and UI; integrated into profile and transform pipeline. Files: `credits.tsx`, `profile.tsx`, `purchase-credits/index.ts`, `stripe-webhook/index.ts`, `transform-artwork/index.ts`.
- [2026-04-22 CRON B] Vote funnel & returnTo redirect — fixed silent vote no-op for guests; implemented `returnTo` logic in login to keep users in the funnel. Files: `discover.tsx`, `piece/[id].tsx`, `login.tsx`.
- [2026-04-22 CRON B] Reframe pass 2 & critical UX fixes — updated 5 screens with "step inside" copy; fixed write-only profile name; added network error retry UI; improved store empty state. Files: `mystores.tsx`, `discover.tsx`, `store/[slug].tsx`, `profile.tsx`, `piece/[id].tsx`.
- [2026-04-22 CRON B] Re-download column fix — `fetchMyDigitalOrder` corrected from `user_id`/`type` to `buyer_id`/`order_type`; paying customers can now re-download. File: `app/app/piece/[id].tsx`.
- [2026-04-22 CRON B] Upload timeouts — `withUploadTimeout` wraps both `supabase.storage.upload()` calls in `publishMutation`; 90s `Promise.race` prevents permanent "Publishing…" state on cellular drop. File: `app/app/(tabs)/create.tsx`.
- [2026-04-22 CRON B] Transformed image download timeout — 30s AbortController wraps `fetch`+`arrayBuffer()` at `create.tsx:107–120`; AbortError → user-readable message via existing error box; spinner no longer hangs forever on CDN drop. File: `app/app/(tabs)/create.tsx`.
- [2026-04-22 CRON A] Found column mismatch: `fetchMyDigitalOrder` queries `user_id`/`type` but Edge Function inserts `buyer_id`/`order_type`; re-download CTA marked ✅ done is silently broken; added as backlog #3; all 7 prior items verified still broken; line refs updated.
- [2026-04-22 CRON B] Re-download path — added `fetchMyDigitalOrder` query and `handleRedownload` to `piece/[id].tsx`; digital card swaps to "Re-download" CTA when `paid` digital order exists; `maybeSingle()` used so no-order case returns null without throwing. File: `app/app/piece/[id].tsx`.
