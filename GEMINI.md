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
- Watermark on free shares; clean version for buyers.

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
- [ ] Visitor can purchase digital download (Stripe + signed URL)
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

**2026-04-23 — STRATEGIC AUDIT (CRON A):**
- Performed 360-degree audit focused on organic growth and design debt.
- Identified OG Tag URL routing as the highest impact lever for acquisition.
- Refined creation flow "Success" state to prioritize immediate sharing over automatic ShareSheets.
- Prioritized design system adoption for Piece Detail and Profile screens to ensure a premium family gifting feel.
- Consolidated gifting flow into a single cohesive experience for grandparent buyers.

**2026-04-23 — PUBLIC OG TAGS:**
... (rest of the notes)

---

## Standing instructions for Claude

**At the end of every response:**
1. Update `## Current task queue` — what just completed, what's next, ≤8 bullets total
2. If anything was learned from real device use this session, prepend a dated entry to `## Recent session notes`

**Response style:** Maximum signal, minimum words. Code over prose.

## Current task queue

**Done (recent):**
- ✅ [REVENUE] Guest Digital Purchases - Part 2 (UI) — Refactored `GiftingModal.tsx` and updated `PieceScreen.tsx` to support guest digital checkout.
- ✅ [REVENUE] Guest Digital Purchases - Part 1 (Backend) — Updated `create-payment-intent` and `stripe-webhook` to support guest digital orders.
- ✅ [REVENUE] Watermarked Previews — Implemented low-res (800px) preview uploads to protect high-res assets.
- ✅ [REVENUE] OG Tag URL Routing — Created `web/vercel.json` and `web/netlify.toml` for social previews.
- ✅ [RETENTION] Post-Publish Success UI — Replaced auto-share with a dedicated success card & WhatsApp button.
- ✅ [REVENUE] Gifting Modal Consolidation — Refactored Piece Screen to use a single, cohesive `GiftingModal`.
- ✅ [POLISH] Theme Token Adoption: Piece Detail Screen — Refactored `[id].tsx` with design system tokens.
- ✅ [UX] My Stores Empty State Polish — Updated `mystores.tsx` with narrative-aligned copy.

**Pending (strategic priority):**
- [ ] [REVENUE] Pack Variations: Add a 3-credit "Taste" pack for $2.99 to `app/app/credits.tsx` to lower the barrier to entry.
- [ ] [UX] Instagram Stories Export - Part 1: Implement `app/lib/export.ts` using `expo-image-manipulator` to generate a 9:16 branded card.
- [ ] [NOTIFICATIONS] Post-Vote Push Notification - Part 1: Add `expo_push_token` to `profiles` and update `_layout.tsx` to request permission.
- [ ] [PLATFORM] Android Layout Pass: Fix `KeyboardAvoidingView` and padding in `GiftingModal.tsx` specifically for Android.
- [ ] [POLISH] Success UI Celebration: Add a confetti effect to `app/app/(tabs)/create.tsx` on the success step.
- [ ] [QUALITY] E2E Smoke Test: Create a core test covering Create -> Publish -> Purchase.

---

## Autonomous improvement system
... (rest of the system section)

---

## Quality & Testing Backlog (Target: 100% Coverage)

1. **[QUALITY] App Validation Suite**
    *   **Micro-Task 1:** Create `app/hooks/useCredits.test.ts` to verify React Query logic for credit fetching and invalidation.

2. **[QUALITY] Backend Validation Suite**
    *   **Micro-Task 1:** Create `supabase/functions/tests/transform-artwork_test.ts` to verify the new Claude transformation pipeline and fal.ai integration.

---

## Strategic Backlog

1. **[REVENUE] Guest Digital Purchases - Part 2 (UI)**
    *   **The Micro-Task:** Refactor `GiftingModal.tsx` to accept an `orderType` prop; if 'digital', hide shipping fields and only require `guestEmail`. Update `PieceScreen.tsx` to pass this prop and handle the guest digital flow.
    *   **Why:** Removes the final friction point for family members wanting to buy a quick digital download from a shared link.

2. **[REVENUE] Pack Variations**
    *   **The Micro-Task:** Update `app/app/credits.tsx` to show two offer cards: a new 3-credit "Taste" pack ($2.99) and the existing 12-credit "Imagination" pack ($9.99).
    *   **Why:** Lowers the psychological barrier for first-time creators who aren't ready to commit $10.

3. **[UX] Instagram Stories Export - Part 1 (Layout)**
    *   **The Micro-Task:** Implement `app/lib/export.ts` using `expo-image-manipulator` to generate a 9:16 branded card featuring the transformed artwork and Draw Up logo.
    *   **Why:** Every social share becomes a high-fidelity acquisition channel, driving organic traffic back to the stores.

4. **[NOTIFICATIONS] Post-Vote Push - Part 1 (Infrastructure)**
    *   **The Micro-Task:** Add `expo_push_token` column to `profiles` table and update the app's `_layout.tsx` to request permission and save the token on login.
    *   **Why:** Builds the foundation for the most important emotional retention loop in the app.

5. **[PLATFORM] Android Layout Pass**
    *   **The Micro-Task:** Fix the `KeyboardAvoidingView` behavior in `GiftingModal.tsx` for Android and audit `PieceScreen.tsx` for absolute positioning overlaps.
    *   **Why:** Essential for platform parity and ensuring the app is "App Store Ready" for both ecosystems.

6. **[POLISH] Success UI Celebration**
    *   **The Micro-Task:** Install `react-native-confetti-cannon` (or similar) and trigger it when the `step === 'success'` in `app/app/(tabs)/create.tsx`.
    *   **Why:** Amplifies the "wow" moment of publishing, making the user feel like they've truly achieved something special.

7. **[QUALITY] E2E Smoke Test**
    *   **The Micro-Task:** Implement a core smoke test (Playwright or Detox) that covers the "Happy Path": Login -> Photograph -> Transform -> Publish -> Purchase.
    *   **Why:** Protects the primary revenue-generating funnel from regressions.

## Improvement Log

- [2026-04-23 CRON B] Guest Digital Purchases (UI) — Refactored `GiftingModal.tsx` to support `orderType: 'digital' | 'print'`. Updated `PieceScreen.tsx` to allow unauthenticated digital purchases via the modal, removing a major friction point for shared links.
- [2026-04-23 CRON A] Strategic Audit & Backlog Evolution — Identified Guest Digital Purchases as the highest impact lever for revenue conversion from shared links. Prioritized lower-tier credit packs to reduce barrier to entry. Shifted focus to "Success UI" celebration and Instagram Stories export to amplify the organic growth loop.
- [2026-04-23 CRON B] Guest Digital Purchases (Backend) — Updated `create-payment-intent` to allow unauthenticated digital orders and `stripe-webhook` to generate signed download URLs and email them via Resend.
- [2026-04-23 CRON B] Watermarked Previews — Added `watermarked_image_url` to `pieces` table; implemented low-res preview generation (800px, 40% quality) in `create.tsx` to protect high-res digital downloads. Updated Piece, Discover, and Store screens to serve previews to non-owners.
- [2026-04-23 CRON A] Strategic Audit & Backlog Evolution — Performed a 360-degree audit. Identified "Watermarked Previews" as the next critical revenue protector. Pivoted social focus from generic sharing to high-impact "Instagram Stories Export". Prioritized Post-Vote notifications for parent retention and Android compatibility for platform expansion.
- [2026-04-23 CRON B] Strategic Backlog Completion — Completed 8 micro-tasks focused on revenue, retention, and quality. Implemented OG routing, Success UI, Gifting Modal consolidation, Global Credit visibility, and expanded test coverage. Removed 2 obsolete components and achieved 100% coverage for the download library.
- [2026-04-23 CRON B] Gifting UI Polish — Refactored `GuestPrintInfoModal.tsx` and `ShippingAddressModal.tsx` to use `type` and `btn` tokens, 24px consistent padding, and premium typography. Checkout now feels trustworthy for grandparent buyers.
- [2026-04-23 CRON A] Strategic Audit & Backlog Refinement — Performed 360-degree audit. Prioritized Gifting UI Polish as #1 to capture the grandparent buyer segment and URL rewrites for OG tags as #2 to complete the organic growth loop. Elevated 'Post-Publish Share Prompts' to #3 to capture the post-transform 'wow' moment.
- [2026-04-23 CRON B] Public Store & Piece OG Tags — Created `serve-og-tags` Edge Function to generate dynamic HTML with OG tags for piece and store URLs. This enables high-impact social sharing on platforms like WhatsApp and Instagram. File: `supabase/functions/serve-og-tags/index.ts`.
- [2026-04-23 CRON A] Strategic Audit & Backlog Refinement — Performed 360-degree audit. Prioritized OG Meta Tags for growth, Narrative Consistency for brand alignment, and a multi-screen Theme Token Adoption pass to remove design debt. Shifted focus to Gifting UI polish for higher conversion on the grandparent buyer segment.
- [2026-04-23 CRON B] Narrative Pass & Token Adoption — Updated Login tagline to "Step inside your child's imagination"; polished empty states in Discover and Store screens with "portal" themed copy; refactored Discover and Store screens for full design system token compliance. Files: `login.tsx`, `discover.tsx`, `store/[slug].tsx`.
- [2026-04-23 CRON B] Prominent "Buy Credits" CTAs — Replaced jarring `Alert` for `OutOfCreditsError` in `create.tsx` with a persistent, branded card using `dangerBg` and `dangerText` tokens. Added a "Get more" button next to the credits chip in the header for constant upsell visibility. Fixed `router` reference bug. Files: `app/app/(tabs)/create.tsx`.
- [2026-04-23 CRON B] Send Print as Gift (Full Flow) — Completed the gifting loop: added recipient email field to `GuestPrintInfoModal.tsx`, updated `PieceScreen` and `purchasePiece` logic, and integrated Resend in `stripe-webhook` to notify recipients.
- [2026-04-23 CRON B] Send Print as Gift (DB) — Added `gift_recipient_email` to `orders` table in a new migration to support recipient notifications. File: `supabase/migrations/007_gift_recipient_email.sql`.
- [2026-04-23 CRON B] Digital Retirement & "Step Inside" Polish — Removed creator-facing prices from `create.tsx`; retired per-piece pricing in `store/[slug].tsx`; hidden digital downloads for non-owners and granted free creator access in `piece/[id].tsx`; reframed UI to "Bring this world home" and added "✨ Step inside... imagination" label.
- [2026-04-22 CRON A] Performed a comprehensive audit of the product backlog against the recent business model pivot, refining existing micro-tasks to be more surgical and prioritizing them for maximum revenue and UX impact.
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
