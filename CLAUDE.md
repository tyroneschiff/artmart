# Draw Up — Claude Code Project Context

## What this is

Parents photograph their children's artwork, AI transforms it into a vivid scene from the world the child imagined, and it publishes to a personal gallery. The core job-to-be-done is **guilt-free disposal** — a child brings home 200 drawings before they turn 10, and parents can't keep them all. This app lets them preserve each one beautifully before throwing it away. The transformation is the keepsake. Sharing with family and occasional print purchases are bonuses, not the primary driver.

## Core user flows

1. **Create** — Snap photo → AI describes & transforms → name & publish piece
2. **Share** — Each child gets a gallery link (drawup.art/store/emma) parents send to family
3. **Purchase** — Family visits link, buys digital download
4. **Discover** — Browse all galleries, vote on pieces, most-loved rise in ranking
5. **Social** — Share to WhatsApp/iMessage; every piece has a public URL with OG preview

## Social & sharing strategy

Every share is a free acquisition channel:
- Each piece and gallery has a shareable URL with rich OG preview
- In-app share sheet (WhatsApp, native, copy link) on every piece and gallery
- Post-publish prompt: pre-written message to family WhatsApp group
- Post-vote notification: tell the parent when their piece gets love (not yet built)
- Instagram Stories export: 9:16 card with branded watermark (not yet built)

## Tech stack (locked for MVP)

| Layer | Tool | Notes |
|---|---|---|
| Mobile | Expo (React Native) | iOS-first; Android after App Store launch |
| Backend / DB | Supabase | Postgres + Auth + Storage + Edge Functions |
| AI — description | Claude API (claude-sonnet-4-6, vision) | Server-side via Edge Function |
| AI — transform | fal.ai (Flux Kontext img2img) | Server-side via Edge Function; pay-per-use |
| Payments | Stripe | Digital purchases |
| Print fulfillment | Printful API | Configured but hidden until Printful account verified |
| Landing page | Single HTML file | Deployed to Vercel/Netlify |

## Database schema (core tables)

- `profiles` — display name, avatar, credits (extends Supabase Auth users)
- `stores` — one per child; slug, child_name, owner_id
- `pieces` — store_id, original_image_url, transformed_image_url, title, ai_description, price_digital, price_print
- `votes` — user_id, piece_id, unique constraint
- `orders` — user_id, piece_id, type (digital|print), stripe_payment_intent, printful_order_id, status
- `comments` — piece_id, user_id, content, created_at
- `reports` — comment_id, reporter_id, reason

## AI pipeline

Client sends image URI → Edge Function compresses → Claude vision generates description + image prompt → fal.ai Flux Kontext transforms → both URLs returned to client → client downloads transformed image locally → publishes both to Supabase Storage on confirm.

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

Aesthetic: ucals.com layout discipline + tincan.kids warmth. Premium but approachable.

## Platform strategy

- Bundle ID: `art.drawup.app`, ASC App ID: `6762963488`
- TestFlight: `eas build --platform ios --profile preview`
- App Store: `eas submit --platform ios`
- Android: after iOS App Store launch

## Key constraints

- API keys in Supabase secrets only — never in app bundle or eas.json
- Stripe webhooks must verify signature; Supabase RLS must be set before any table goes live
- Prompt caching headers on all Claude API calls
- Physical print flow exists in code but is hidden from all users — Printful variant ID and API key must be verified before enabling
- Comments are built with Claude Haiku moderation — auth-only, 300 char limit, 1-per-5min rate limit
- "Gallery" is the correct term for a child's collection — not "Store". Route paths use `/store/[slug]` but all UI copy says "Gallery"

## Coding conventions

- TypeScript everywhere
- Expo Router (file-based routing)
- Supabase client initialized once in `lib/supabase.ts`
- React Query for all data fetching and cache invalidation
- Zod for runtime validation at API boundaries
- No comments unless WHY is non-obvious
- No mocking in tests — use real Supabase local dev instance

## Definition of "done" for MVP

- [x] Sign up, create a gallery for a child
- [x] Photograph art, receive AI-transformed version
- [x] Publish piece to gallery
- [x] Visitor can vote on a piece
- [x] Visitor can purchase digital download (Stripe + signed URL)
- [x] Top-voted pieces discoverable in browse screen
- [x] Credits system — spend on transform, refund on failure
- [x] Comments with Claude Haiku moderation
- [ ] Gallery accessible via public shareable URL (web routes not deployed)
- [ ] Landing page live on drawup.art
- [ ] Physical print flow verified end-to-end (Printful account + variant ID)
- [ ] Android APK deployable via EAS Build

---

## Product empathy

The crons must reason from user experience, not code. These are the three people using this app:

**Parent (creator)** — Time-poor, emotionally invested, and quietly guilty about throwing drawings away. They photographed the drawing because they couldn't keep it but couldn't bring themselves to bin it either. This app resolves that tension — once it's transformed and saved, they can let go. The "wow" moment is seeing the transformation and knowing it's preserved beautifully. If Transform fails, they feel embarrassed and give up. If it works, they feel relief and delight, and share immediately. Friction = they Instagram the photo instead and the app loses them forever.

**Family member (viewer)** — Grandparent, aunt, uncle. Gets a WhatsApp link from the parent. Not tech-savvy. Has 90 seconds of attention. They're here to see the child's world, feel something, maybe vote. A print purchase is possible but not the primary expectation — don't design the experience around selling to them.

**Child (the artist)** — The drawing is theirs. They are eagerly waiting to see their world come to life and to hear someone describe it back to them. The description read aloud is a magic moment — it must speak directly to them, name specific things they drew, and make them feel seen. If the transformation looks nothing like their drawing or the description feels generic, the magic is gone. This is as much for them as for the adults.

**Visitor (voter)** — Another parent on Discover. Casual, zero commitment. Votes if it's beautiful and one tap. Won't scroll past a broken or empty screen.

---

## Decision filter

Before implementing or recommending anything, answer all three:
1. Does this make it more likely a parent completes a transform?
2. Does this make it more likely a family member buys or shares?
3. Does this increase emotional impact at a moment that matters?

If the answer to all three is "no" or "unclear", don't do it. This prevents polishing things that are already good enough while real friction goes unresolved.

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
- RLS policies must explicitly include DELETE — Supabase silently drops deletes with no error if no DELETE policy exists, calling onSuccess as if it worked.

**Platform / third-party:**
- `Linking.canOpenURL('whatsapp://')` returns false on iOS without `LSApplicationQueriesSchemes`. Use `wa.me/?text=` universal link instead.
- Stripe idempotency keys lock for 24 hours. A failed payment with the same key returns the same failed intent — user cannot retry.
- Supabase Edge Function CORS headers must be returned on OPTIONS preflight or all app requests fail silently.
- `supabase.storage.from('bucket').upload()` has no built-in timeout and exposes no AbortController in the JS v2 API. A 4–15MB original image upload on 3G can hang indefinitely — wrap with `Promise.race` against a timeout rejection to prevent a permanent pending state.
- `btoa(String.fromCharCode(...new Uint8Array(buffer)))` throws stack overflow on audio/image buffers in Deno. Use a for-loop: `for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])`.

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
- **Empty database** — new user, no galleries, no pieces
- **Returning user** — has purchases, prior votes, existing galleries
- **Non-tech user** — grandparent on a WhatsApp link with no account

### 3. Hunt for silent failures
The most dangerous bugs look like success but do nothing:
- `.update()` with no matching row → 0 rows changed, no error
- `fetch()` on `file://` URI on iOS → empty blob uploaded to storage
- React Query cache showing deleted DB records as if present
- fal.ai URL expired before user taps Publish
- Edge Function returning HTTP 200 with `{ "error": "..." }` in body
- RLS DELETE policy missing → delete silently no-ops, onSuccess fires anyway

### 4. Prioritize by real user impact
1. Permanently loses user's photo or payment — fix first
2. Create flow broken (photo → transform → publish) — fix first
3. Purchase funnel broken (grandparent can't buy) — fix first
4. Empty/error states on high-traffic screens (Discover, Gallery, Piece detail)
5. Design consistency, copy, edge cases

### 5. Before recommending or implementing
- Read `## Recent session notes` first — user-reported issues outrank code analysis
- Read `## Known gotchas` — don't re-solve understood problems
- Check `## Strategic Backlog` — is it already tracked? If yes, verify the description is still accurate
- Apply the `## Decision filter` — if the change doesn't pass, don't make it

---

## Recent session notes

*(Maintained by Claude at end of each conversation — newest first. Ground truth from real device use.)*

**2026-04-24:**
- Physical print flow hidden from ALL users pending Printful account verification. Do not re-add print cards for any user — see `## What we've tried and rejected`.
- "Store" renamed to "Gallery" throughout UI. Route paths (`/store/[slug]`) unchanged in code. Do not revert copy back to "Store" — the rename is intentional.
- Sort labels: "Most loved" / "Newest" — not "Top worlds" / "New worlds".
- Vote badge moved to image overlay (consistent across Discover and Gallery pages).
- Gallery page bottom nav added (Discover / Create / My Galleries / Profile).
- Autonomous crons migrated from Gemini to Claude Code CLI. Supabase auto-deploy removed. Migrations and edge functions off-limits for CRON B.
- Delete piece added (owner-only). RLS DELETE policy added in `012_pieces_delete_policy.sql`.
- Digital download CTA added for non-owners/non-buyers on piece detail page.
- CLAUDE.md had unresolved merge conflicts from Gemini sync — cleaned up 2026-04-24.

**2026-04-23 — BUSINESS MODEL PIVOT:**
- **Product reframe: "Step inside your child's drawing"** — the drawing IS the vision; the AI is the door. Never say "elevate," "improve," "gallery-worthy," or treat the original as raw material.
- **Monetization: credits.** 3 free transforms on signup → credit packs ($9.99 / 12 credits). ~92% gross margin after API costs.
- **Core use case reframed (credit to Evan):** The parent is the buyer, not the grandparent. They're paying to preserve drawings guilt-free before throwing them away. Credits = permission to let go. Print purchases are a secondary bonus.

**2026-04-22:**
- Transform failing: iPhone photos 4–15MB, Claude rejects >5MB. Fixed with `expo-image-manipulator` compression.
- Profile display name silently failing for new users: `.update()` on non-existent row. Fixed with `.upsert()`.
- Crons hitting 30k TPM rate limit at 3-minute cadence. Slowed; upgraded model; rewrote prompts.

---

## Standing instructions for Claude

**At the end of every response:**
1. Update `## Current task queue` — what just completed, what's next, ≤8 bullets total
2. If anything was learned from real device use this session, prepend a dated entry to `## Recent session notes`

**Response style:** Maximum signal, minimum words. Code over prose.

---

## Autonomous improvement system

**Two automated Claude cron processes read this file every 2 hours.** Each must read the full file first, follow its instructions, update the relevant sections, then exit.

**Meta-principle:** Every run should leave the system smarter, not just the codebase. If CLAUDE.md is inaccurate, fix it. If backlog items are too vague to implement, sharpen them. If a previous decision turned out to be wrong, log it in `## What we've tried and rejected`. This compounds in quality over time.

---

### CRON A — Strategic Reviewer

**Job: think, not code.** Read the codebase, find real problems, update the knowledge base.

**Process:**
1. Read `## Known production errors` — real failures outrank hypotheses
2. Read `## Recent user feedback` — actual user confusion outranks code analysis
3. Read `## What we've tried and rejected` — never re-suggest these
4. Read the current `## Strategic Backlog` — verify every line reference still exists in code
5. Audit the create → transform → publish flow end to end
6. Audit the credits purchase flow end to end
7. Apply `## Decision filter` to any candidate improvements

**May update:**
- `## Strategic Backlog` — rewrite entirely each run, max 8 items
- `## Current task queue` — mark done if codebase confirms it
- `## Definition of "done" for MVP` — check off verifiably complete items
- `## Known gotchas` — hard cap 12; add only silent platform-specific failures; remove stale items to make room
- `## Improvement Log` — prepend one line per run, trim to 10

**Never change:** tech stack, design system values, bundle IDs, product vision, `## Product empathy`, `## Recent session notes`, `## What we've tried and rejected`, `## Known production errors`, `## Recent user feedback`

---

### CRON B — Implementer

**Job: ship one small, complete, correct change per run.**

**Priority order:**
1. Broken create → publish flow (permanent user loss)
2. Broken purchase flow (lost revenue)
3. Design system violations on high-traffic screens
4. Copy improvements on empty states and share messages
5. Error handling and edge case recovery
6. Everything else

**Hard constraints — never violate:**
- Never create or modify files in `supabase/migrations/`
- Never create or modify files in `supabase/functions/`
- Never modify `app.json`, `eas.json`, `package.json`, or any config files
- Never modify `CLAUDE.md` directly — that is CRON A's job
- Maximum 3 files changed per run, `app/` directory only
- Never start what you can't finish — a button with no handler is worse than nothing
- Use only tokens from `app/lib/theme.ts`, never raw hex values
- Apply `## Decision filter` before implementing — if it doesn't pass, pick the next backlog item
- Read `## What we've tried and rejected` before implementing — do not re-add rejected features

**After implementing:**
1. Move completed item to `## Current task queue` Done ✅ with one-line summary
2. If split, add remainder back to backlog at appropriate rank
3. Prepend one line to `## Improvement Log`: timestamp, "CRON B", what changed, which files. Trim to 10.

---

## Strategic Backlog

*(Rewritten each run by CRON A — Implementer reads this to pick next task)*

1. **[CONFIRMED] Discover vote tap loses vote after login** — `discover.tsx` vote button routes unauthenticated users to `{ pathname: '/(auth)/login', params: { returnTo: '/(tabs)/discover' } }`. After login, user lands on Discover — no auto-vote fires. Fix: change `returnTo` to `` `/piece/${item.id}` `` and add `vote: '1'` param. `piece/[id].tsx:109-114` already has the auto-vote mechanism on mount. Impact: converts the highest-intent anonymous action into a real vote after signup.

---

## What we've tried and rejected

*(Maintained by Claude — log any revert or deliberate decision not to implement, with reason. Prevents re-suggesting the same ideas.)*

- **Subscription model (monthly)** — Rejected in favour of credit packs. Not enough usage data to price a subscription. Revisit after month 2.
- **"Imagination Credits" as label** — Replaced with plain "Credits". "Imagination" felt decorative on transactional UI; reserved for emotional moments (descriptions, share messages, empty states).
- **"Top worlds / New worlds" sort labels** — Replaced with "Most loved / Newest". Less forced; "worlds" earns its place as the noun for pieces, not as a sort filter.
- **Compare labels ("The Drawing" / "The World")** — Removed entirely. Two images side by side is self-explanatory; any label risked implying the drawing isn't a world too.
- **Physical print card visible to any user** — Hidden pending Printful variant ID verification. Showing a purchasable option that can't fulfil is worse than not showing it. Do not re-add for any user until Printful is configured.
- **Auto-deploy Supabase functions from cron** — Removed from GitHub Actions. A bad edge function deploying automatically breaks production transforms for all users. Manual deploy only.
- **Reverting "Gallery" back to "Store"** — The rename to "Gallery" is intentional. Route paths use `/store/[slug]` but all UI copy must say "Gallery". Do not revert.

---

## Known production errors

*(Paste Supabase edge function errors or crash logs here — CRON A reads this first. Highest-signal input.)*

*(Empty — no known production errors at time of writing)*

---

## Recent user feedback

*(Raw notes from real device testing — paste reactions directly. CRON A weights decisions against this.)*

*(Empty — TestFlight not yet distributed to external testers)*

---

## Current task queue

**Done (recent):**
- ✅ Product reframe — Claude system prompt rewritten; app copy updated throughout
- ✅ Transform JWT fix — ES256 JWKS verification in edge function
- ✅ Upload timeouts — 90s Promise.race on both storage uploads in publishMutation
- ✅ Transformed image download timeout — 30s AbortController in create.tsx
- ✅ Re-download path + column fix — piece/[id].tsx queries existing digital orders, correct field names
- ✅ Credits system — spend_credit RPC, refund on failure, balance returned to client
- ✅ Read Aloud — OpenAI TTS nova voice via edge function, expo-av playback
- ✅ Delete piece — owner-only, confirmation alert, RLS DELETE policy migration
- ✅ Gallery rename — "Store" → "Gallery" throughout UI
- ✅ Gallery bottom nav — Discover / Create / My Galleries / Profile
- ✅ Vote badge overlay — consistent image overlay on Discover and Gallery pages
- ✅ Physical print hidden — removed from piece detail pending Printful verification
- ✅ Digital download CTA for non-owners — `piece/[id].tsx` shows purchase section to visitors
- ✅ Autonomous crons migrated to Claude Code CLI
- ✅ CLAUDE.md merge conflicts resolved

**Pending:**
- [ ] Discover vote → login redirect to piece (backlog item 1)
- [ ] Grandparent guest checkout — buy from gallery without login
- [ ] Web gallery deployment — drawup.art domain + public routes
- [ ] OG meta tags for piece/gallery public URLs

---

## Improvement Log

*(One line per run, newest first)*

- [2026-04-24 Human] Resolved CLAUDE.md merge conflicts from Gemini sync; added Gallery/Store rename protection and print card rejection to What we've tried and rejected; fixed piece/[id].tsx Gallery→Store revert and print card re-add from cron run.
- [2026-04-24 CRON B] Digital download CTA for grandparents + Gallery copy fix — added `{!isOwner && !myDigitalOrder}` block with digital card; fixed "Gallery"→"Store" revert. File: `app/app/piece/[id].tsx`.
- [2026-04-24 CRON A] Marked 7 task queue items ✅; found cron had re-added print card and reverted Gallery→Store; confirmed discover vote redirect sends to discover not piece (vote lost); rewrote backlog.
- [2026-04-24 Human] Migrated cron system to Claude Code CLI; added Decision filter, What we've tried and rejected, Known production errors, Recent user feedback sections to CLAUDE.md.
- [2026-04-22 CRON B] Reframe pass 2 & critical UX fixes — updated 5 screens with "step inside" copy; fixed write-only profile name; added network error retry UI; improved store empty state.
- [2026-04-22 CRON B] Re-download column fix — `fetchMyDigitalOrder` corrected from `user_id`/`type` to `buyer_id`/`order_type`.
- [2026-04-22 CRON B] Upload timeouts — `withUploadTimeout` wraps both storage uploads; 90s Promise.race prevents permanent "Publishing…" state.
- [2026-04-22 CRON B] Transformed image download timeout — 30s AbortController; AbortError → user-readable message.
- [2026-04-22 CRON A] Found column mismatch in fetchMyDigitalOrder; re-download CTA was silently broken.
- [2026-04-22 CRON B] Order insert error check — return 500 before sending client_secret if insert fails.
