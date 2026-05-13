# Draw Up — Claude Code Project Context

## What this is

Parents photograph their children's artwork, AI transforms it into a vivid scene from the world the child imagined, and it publishes to a personal gallery. The magic moment is the child seeing their drawing come to life and hearing it described back to them. Underlying value: parents accumulate hundreds of drawings they can't keep — this lets them preserve each one beautifully. Don't lead with preservation; lead with delight. The guilt-free disposal is a side effect, not the pitch.

## Core user flows

1. **Create** — Snap photo → AI describes & transforms → name & publish piece
2. **Share** — Each child gets a gallery link (drawup.ink/store/emma) parents send to family
3. **Purchase** — Family visits link, buys digital download
4. **Discover** — Browse all galleries, vote on pieces, most-loved rise in ranking
5. **Social** — Share to WhatsApp/iMessage; every piece has a public URL with OG preview

## Acquisition strategy

At ~$42 LTV, paid ads do not work. The product must be viral by design or it does not grow. All acquisition planning lives in `growth/` — see `growth/README.md`.

**Kill criterion:** if shares-per-completed-transform stays below 0.10 OR signups-per-share stays below 0.10, no marketing channel will save it. Fix the product first.

**Channels ranked by leverage (do them in this order):**

1. **Viral-by-design product surfaces** — every transform must produce a share artifact someone can't help posting. Auto-MP4 of the before→after reveal with watermark + URL; 9:16 IG Story export; watermarked free-tier downloads; OG-rich gallery URLs. This is engineering work in the `app/` and `supabase/functions/` codebases — drives every other channel.
2. **Mom-influencer seeding** — micro-tier (5–50k followers, parenting niche), free credits not cash. ~15% post organically because the kid lights up.
3. **TikTok / Instagram organic** — "AI turned my kid's drawing into THIS" is an existing proven format. Make our own and prime parents to make theirs.
4. **ASO** — keywords, screenshots showing the magic moment, video preview. Compounds for free.
5. **Holiday bursts** — Mother's Day, Father's Day, end-of-school-year, Christmas, Grandparents Day. Build 4 holiday landing pages a year.
6. **Schools & teachers** — verified teachers get unlimited credits; one teacher email = 25 high-intent signups.
7. **Reddit + parenting communities** — r/Parenting, r/Mommit, r/Daddit. ONE genuine post, never spam.

**Do not bother with:** Meta/TikTok paid ads (LTV math fails), Google Ads (no search intent), TechCrunch (wrong audience), Product Hunt (wrong audience).

**In-product share surfaces (built or planned):**
- Each piece and gallery has a shareable URL with rich OG preview
- In-app share sheet (WhatsApp, native, copy link) on every piece and gallery
- Post-publish prompt: pre-written message to family WhatsApp group
- Post-vote notification: tell the parent when their piece gets love (not yet built)
- Instagram Stories export: 9:16 card with branded watermark (not yet built)
- Auto before→after MP4 reveal export (not yet built — highest-leverage acquisition feature)

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
- [ ] Landing page live on drawup.ink
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

**React Query:**
- Two `useQuery` calls with the same `queryKey` but different `select(...)` shapes will overwrite each other's cache, producing flicker between fields-present and fields-missing renders. Always namespace the key by data shape (e.g. `['mystores', uid]` for the rich shape vs `['stores-picker', uid]` for the slim shape) and invalidate both keys together when the underlying rows change.

**EAS Build:**
- `eas.json` build profiles do NOT inherit env from each other. The app's `EXPO_PUBLIC_*` env vars (Supabase URL, anon key, Stripe publishable key) must be defined explicitly in EVERY profile that ships an actual build (preview AND production). Missing env on the production profile produced a launch-time SIGSEGV in `convertNSExceptionToJSError` — Stripe's native init throws an NSException when constructed with `undefined`, which propagates through TurboModule and crashes the app on splash. Symptom looks like a native dep regression; cause is one missing config block. **Always diff eas.json profiles before blaming pods.**

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

**2026-05-09 (marathon):**
- All P0 cleared (account deletion, privacy/terms, push prompt deferred). P1 email notification loop activated end-to-end: `notify-new-piece` fires on publish, `notify-vote` fires on vote, both debounced and authored against Resend (key in Supabase secrets, drawup.ink verified). P1 real gallery rendering at `drawup.ink/gallery/<slug>` live (grid of 24 pieces). P1 share→signup click attribution via `?ref=` + crawler split into `og_preview` event type. P2 onboarding sheet + comment polish (author diff + delete-own + skeleton). P3 gallery cover customization, vote notification email, threaded replies. P4 follower count loading state + per-category transform error icons.
- All shipped on `main` but NOT yet in a TestFlight build — current live TestFlight is 1.1.7 build 26 from earlier today (lightbox + sort fix). Next build should be 1.1.8 build 27, includes everything above.
- Resend API key was pasted in plaintext in conversation — rotate after testing.
- DNS hold on drawup.ink resolved earlier today (WHOIS verification email).

**2026-05-08:**
- Production EAS profile in `eas.json` was missing the three `EXPO_PUBLIC_*` env vars (Supabase URL, anon key, Stripe publishable key) that the preview profile had. Builds 22 and 24 (shipped via `--profile production`) crashed on launch with SIGABRT/SIGSEGV in `convertNSExceptionToJSError` on the TurboModule queue — Stripe's native init throws an NSException when handed `undefined`, and that propagates as the launch crash. Logged in `## Known gotchas → EAS Build`.
- **Always build via `eas build --platform ios --profile preview`** for now; both profiles work but preview is the user's tested path. Both have the env vars.
- Recovery sequence: 1.1.4 (22) crashed → 1.1.5 (23, attempted Path B with `newArchEnabled: false`) failed CocoaPods install → 1.1.5 (24, full revert to 1.1.3 baseline) still crashed → diagnosed eas.json env var diff → 1.1.6 (25) shipped via preview profile with all features re-introduced and launches cleanly.
- **Open question for tomorrow:** when Stripe is moved to live mode, swap `pk_test_…` for `pk_live_…` in BOTH eas.json profiles. Forgetting one will repeat today's crash.

**2026-04-30:**
- **Email confirmation DISABLED in Supabase Dashboard for the beta.** Authentication → Sign In / Providers → Email → "Confirm email" = OFF. Re-enable before public launch + build a "verify your email" gate in the app at that time. Trade-off accepted: simpler beta UX > spam protection.
- New users now: signUp → session returned immediately → ensureProfile() runs in `_layout.tsx` auth listener → credits + profile queries invalidated → 3 credits visible on first paint.
- `lib/ensureProfile.ts` is the belt-and-suspenders for the `handle_new_user` trigger race. Idempotent upsert with `ignoreDuplicates: true`. Always called on every `SIGNED_IN` event.
- Profile screen has a hard auth gate now — redirects to /(auth)/login if session is null. Stops the old "Cannot read property user of null" crash on save name.
- `web/auth/confirmed.html` exists for the email-confirm flow (when re-enabled). Auto-deep-links to drawup:// on iPhone, shows Email-confirmed messaging + TestFlight CTA on desktop. Vercel needs `cleanUrls: true` in vercel.json.
- TestFlight build 20 stuck "Waiting for Review" >3 days at session end. Build 21 needed for splash-screen-on-cream fix; do not extend wait.

---

## Standing instructions for Claude

**At the end of every response:**
1. Update `## Current task queue` — what just completed, what's next, ≤8 bullets total
2. If anything was learned from real device use this session, prepend a dated entry to `## Recent session notes`
3. **Always close with a "Next most optimal move" line.** Single concrete action that will most directly turn this experimental app into a profitable business — not a list, not a roadmap. Apply the Decision filter and the Acquisition strategy ranking. If two moves are tied, pick the one that unlocks measurement (instrumentation, share telemetry, dad-feedback loop) over the one that polishes existing surface. The line must be specific enough to act on within 24 hours — file path or domain action, not "think about pricing."

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
- `## Current task queue` — mark done if codebase confirms it; trim Done list to 10 (remove oldest)
- `## Definition of "done" for MVP` — check off verifiably complete items
- `## Known gotchas` — hard cap 12; add only silent platform-specific failures; remove stale items to make room
- `## Recent session notes` — keep max 3 entries; trim oldest to make room
- `## What we've tried and rejected` — keep max 10 items; trim least-relevant to make room
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

*(Rewritten each run by CRON A — Implementer reads this to pick next task. Larger forensic plan lives in `## Tomorrow's polish & feature plan` below.)*

1. **[PENDING] Subscription email notifications** — Edge function on `pieces.insert` where `published=true`: query `subscriptions` for that store_id, fan-out email via Resend with subject like "{Child} drew a new world" and a deep link. Debounce: 1 email/gallery/6h (collapse multi-piece bursts). Exclude the owner from recipients. Files: new `supabase/functions/notify-new-piece/index.ts`, new `supabase/migrations/020_pieces_publish_trigger.sql` (db trigger calling pg_net to invoke the function), `RESEND_API_KEY` env. Cannot implement via CRON B.

2. **[PENDING] Account deletion flow** — Apple App Store mandatory. Profile screen → "Delete account" → 2-tap confirm → calls edge function that deletes auth user + cascades stores/pieces/subscriptions/votes/comments via FK `on delete cascade` (verify all FKs are cascading). Files: new `supabase/functions/delete-account/index.ts`, `app/app/(tabs)/profile.tsx`. Cannot implement via CRON B.

3. **[PENDING] Privacy Policy + Terms in app** — Apple App Store mandatory. Add two link rows under "App" section in profile, pointing to `https://drawup.ink/privacy` and `https://drawup.ink/terms`. Generate static pages (e.g. termsfeed.com → `web/privacy.html` + `web/terms.html`).

4. **[PENDING] Grandparent guest checkout** — `GiftingModal` collects guest email when `isGuest=true`; `checkout.ts:purchasePiece` accepts optional `userToken`. Client-side looks complete. Needs end-to-end test: edge function `create-payment-intent` must accept unauthenticated requests.

5. **[PENDING] Web gallery rendering** — Currently `drawup.ink/gallery/<slug>` returns the OG-card preview HTML, not an actual gallery view. Family members tapping a shared link see a mini-card and a CTA, not the kid's worlds. Build a real web view that loads the gallery's published pieces from Supabase via PostgREST, similar styling to `web/api/og.js` body.

---

## Tomorrow's polish & feature plan

*(Authored 2026-05-01 from a forensic audit. Use this as the working doc for the next focused session. Items below the priority tiers are open questions, not commitments.)*

### P0 — App Store launch blockers

These prevent public launch, regardless of how good the product feels.

- **Account deletion** — Apple Section 5.1.1(v). Profile → "Delete account" → 2-tap confirm → edge function deletes auth user + cascades. Verify every FK from profiles/stores/pieces is `on delete cascade`. Without this, the next App Store submission gets rejected.
- **Privacy Policy + Terms in app** — Linked from profile, hosted at drawup.ink/privacy and /terms. Generate via termsfeed.com or similar — no need to author from scratch.
- ~~**Push notification token unused**~~ → Resolved 2026-05-09 by disabling the permission prompt entirely. See `## What we've tried and rejected`. Re-enable when the first push trigger ships.

### P1 — Activate the acquisition loop

The kill criteria from `## Acquisition strategy` (>0.10 shares/transform, >0.10 signups/share) won't move until these ship.

- **Subscription email notifications** — The Following feed is built but dormant. Without the email/push trigger, "follow" is a passive bookmark that never re-opens the app. **This is the single highest-leverage feature in the queue.** Resend API + edge function on `pieces.insert published=true`, debounced per gallery per 6h.
- **Web gallery rendering** — A grandparent who taps the WhatsApp link from a parent currently sees the OG preview HTML *as the page*, not a real gallery. The conversion happens in the next 30 seconds — they need to see the kid's worlds and the "Get the app" CTA, not a single card. Highest-friction step in the share→signup funnel right now.
- **Auto-MP4 before/after reveal** — CLAUDE.md `## Acquisition strategy` calls this "highest-leverage acquisition feature." A 6s portrait MP4 (drawing → wipe → world → child name + watermark) saved to camera roll on publish, ready for parent to share to TikTok/IG without editing. Native `expo-video-thumbnails` + ffmpeg-kit OR server-side `ffmpeg` Lambda. Out of scope for one session but needs to be on the radar.
- **Share → signup attribution** — `signups_per_share` on the metrics dash is currently misleading because there's no causal link. Add a UTM-style `?ref=<piece_id>` to all share URLs and write that to a column in the events table on signup. Without this, you can't tell which channel/piece/gallery is driving conversions.

### P2 — Friction in the core flow

- **Onboarding context** — A new user is dropped straight into `/(tabs)/create` with no orientation. They have 3 free credits but don't know it. Add a 2-screen onboarding (or single bottom sheet) on first session: "You start with 3 credits. Each turns one drawing into a world. Tap below to start." Track `onboarding_dismissed`.
- **Comment author differentiation** — `piece/[id].tsx:289-343` shows all comments identically. Highlight your own with a "You" pill or subtle bg tint. Current state feels like a guestbook with no self-presence.
- **Delete own comment** — Long-press on own comment → confirm delete. Required for any user-generated-content surface.
- **Comments loading skeleton** — Empty list flashes during fetch. Add a skeleton row matching the comment layout.
- **Transform error retry preserves image** — already does (verified in audit). Make sure that stays true after any future refactor — it's the single most important UX in the create flow.
- **Gallery cover + count after first publish** — Verify the cache invalidation path (queryKey collision was fixed today, but a fresh smoke test on a brand-new account + first piece publish is overdue).

### P3 — Engagement & retention

- **"Someone loved your piece" notification** — When a vote lands on the owner's piece, fire a push (low-priority, batched daily). Highest-converting re-engagement event for a creator app.
- **Reply to comments** — Threaded replies, 1 level deep. Tap a comment → "Reply." Not urgent for MVP but raises engagement floor on pieces with traction.
- **Gallery banner / customization** — Owner picks one of their pieces as the "cover" for their gallery's web URL preview, instead of always-most-recent. Small but high-control polish.
- **Vote streak** — In Discover, show "🔥 3 in a row" when the same gallery has multiple top-voted pieces. Light gamification for the discovery side.

### P4 — Visual & micro-polish

- **Empty state for gallery with 0 pieces** — Audit didn't read the file but it exists; verify it matches the warmth of other empty states.
- **Loading state for `useSubscriberCount`** — Currently shows nothing while fetching, then pops in. Render `… following` placeholder while loading.
- **Haptics on locked Read Aloud** — Already wired to `Haptics.selectionAsync()`. Verify it fires on iPhone (Expo Go ignores).
- **Friendly transform error icon variety** — Currently all errors show the same UI shell. Tiny icon per category (camera-off for "not a drawing", wifi-off for network) would humanize the failure.

### P5 — Future bets (don't pull forward, just track)

- **Android build** — EAS Build supports it; currently iOS-only. Wait until iOS App Store launch + 100 signups before pulling.
- **iPad layout** — Currently scales poorly. Easy win after iOS phone launch.
- **Spanish localization** — Big hispanophone parent market for kids' creative apps.
- **Print fulfillment** — Hidden pending Printful variant verification. See `## What we've tried and rejected`.
- **Co-parent gallery access** — Divorced/separated parents both wanting to manage one kid's gallery. Real demand once the app scales.

### What we're not thinking about (but should before launch)

- **App Store Optimization (ASO)** — Screenshots, video preview, keywords, description copy. None polished beyond the TestFlight build. Free organic install lift if done well.
- **Account recovery without email** — A parent loses their email account (e.g. school address closed). Currently no path to recover the gallery.
- **Image moderation of generated worlds** — fal.ai Flux can occasionally produce something off-tone. No human-in-loop review of *outputs* (only inputs). Risk = small but reputationally large if a parent shares a weird AI-generated scene to family.
- **AI-generated description tone for sensitive drawings** — Kid draws something dark (which kids do). Claude's description should be empathetic, not pathologizing. Worth a system prompt audit.
- **Backup / export for parents** — When this matters, it'll be too late. Even a "download all my originals" zip would soothe a lot of long-term anxiety. (Save All to Photos partially solves this.)
- **Reviews/ratings prompt** — `expo-store-review` after the 3rd successful publish, not before. Currently never asked.
- **Accessibility** — VoiceOver labels, dynamic type. Not a P0 but every screen needs at least an audit pass before scale.
- **Co-watching the read-aloud moment** — Currently the parent triggers Read Aloud, audio plays from speaker. Consider AirPlay-friendly playback so a grandparent watching over FaceTime can hear it too. Niche but emotionally huge.
- **Gallery handoff to the kid when they're older** — In ~10 years a Draw Up kid will be 13 and may want to take ownership of their own gallery. No mechanism. Worth thinking about now even if not building.

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
- **Push permission prompt at launch (re-enabling)** — `registerForPushNotificationsAsync()` was disabled in `app/app/_layout.tsx` on 2026-05-09 because we never sent to the tokens we collected. Asking for permission and never delivering is a trust hit and a likely App Store review flag. The helper function and the commented-out useEffect are kept in place so re-enabling is a one-line change. **Do not re-enable until at least one server-side push trigger is shipping notifications** (e.g. "someone loved your piece" or "new piece in a followed gallery"). Tracked in `## Strategic Backlog` notifications item.

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

**Done (recent — through 2026-05-09 marathon):**
- ✅ P0 Account deletion (Apple Section 5.1.1(v)) — new `delete-account` edge function (JWT-verified, service-role admin.deleteUser), two-tap Alert confirm in Profile. FK cascades already correct.
- ✅ P0 Privacy Policy + Terms in app — `web/privacy.html` + `web/terms.html` (boilerplate, brand-styled), link rows in Profile → App section.
- ✅ P0 Push prompt disabled — `_layout.tsx` useEffect commented out; helper kept for one-line re-enable when first trigger ships. Logged in `## What we've tried and rejected`.
- ✅ P1 Subscription email notifications — `notify-new-piece` edge function (JWT-verified, owner-check, 6h debounce per gallery, excludes owner). Sends styled "{Child} drew a new world ✨" via Resend. Fire-and-forget from `create.tsx` publish flow.
- ✅ P1 Real gallery view at drawup.ink/gallery/<slug> — `web/api/og.js` now renders a real grid of up to 24 pieces for human visitors (preview crawlers still get OG card via head meta).
- ✅ P1 Share→signup click attribution — `?ref=piece-<id>` / `?ref=gallery-<slug>` on share URLs; `og_view` events capture ref; crawler/previewer hits routed to `og_preview` event_type so human clicks aren't drowned; metrics dash shows "Top sharing links."
- ✅ P2 Onboarding sheet — first-run welcome modal explains 3 free credits, gated on `hasSeenOnboarding()` AsyncStorage flag + 0 galleries. Tracks `onboarding_shown` / `onboarding_dismissed`.
- ✅ P2 Comment polish — "You" pill + gold-tint own comments; long-press own comment → confirm Alert → delete; `CommentsSkeleton` while loading; Report hidden on own comments.
- ✅ P3 Gallery cover customization — migration `022_stores_cover_piece.sql` (nullable, on delete set null). Owner can "Make this the gallery cover" from piece footer. Used by mystores list + og.js gallery grid.
- ✅ P3 "Someone loved your piece" email — `notify-vote` edge function (24h debounce per piece). Wired fire-and-forget from both vote callsites.
- ✅ P3 Threaded replies (1 level deep) — migration `023_comments_parent_id.sql` (self FK, on delete cascade); `moderate-comment` validates parent on same piece; inline reply input under top-level comments. Replies indented; Reply hidden on replies.
- ✅ P4 Follower count loading placeholder — `… following` while subscriberCount fetches, no header reflow.
- ✅ P4 Friendly transform error icons — per-category Ionicons in gold bubble above error title (camera-reverse, hourglass, cloud-offline, refresh-circle, color-palette, alert-circle).
- ✅ Lightbox crash fix — `runOnJS` wrap in `ZoomableImage` singleTap.
- ✅ Most visited sort tiebreaker — secondary sort by view_count/vote_count/created_at; migration `021_view_count_skip_owner.sql` excludes owner self-views.
- ✅ User-selectable Read Aloud voice — migration `018` (`tts_voice_id` on profiles); `app/lib/voices.ts` curated 6-voice catalog (Charlotte default + Bella, Adam, Rachel, Antoni, Crofty); `tts` edge function accepts `voice_id` with allowlist; `VoicePicker` component with sample preview.
- ✅ Owners auto-follow own gallery — migration `017_subscriptions_allow_self.sql` (drop self-block + backfill).
- ✅ Comment rate limit 5min → 30s.
- ✅ Gallery cover flicker bug fixed — queryKey shape collision. Logged in `## Known gotchas → React Query`.
- ✅ Gallery subscriptions (Follow + Following feed) — migration `016_subscriptions.sql`.
- ✅ Operator metrics dashboard — `/metrics?key=...`.

**Pending (sorted by leverage):**
- [ ] **P1** — Auto-MP4 before/after reveal export (multi-day; biggest remaining acquisition feature)
- [ ] **P3** — Vote streak indicator on Discover (light gamification)
- [ ] **P5** — Android build, iPad layout, Spanish localization, Printful, co-parent access (defer until iOS App Store launch + 100 signups)
- [ ] **App Store metadata** — screenshots, video preview, description, keywords, age rating, App Privacy declarations (App Store Connect dashboard work, not code)
- [ ] **Resend domain verification** — done (drawup.ink verified). API key set in Supabase secrets. Rotate the key once tested.

---

## Improvement Log

*(One line per run, newest first)*

- [2026-05-01 Human] Forensic audit of the app — captured P0–P5 plan in `## Tomorrow's polish & feature plan`. Top blockers: account deletion + privacy links (App Store mandatory), notification fan-out (loop activation), web gallery rendering (share→signup conversion). Push token wiring exists but is unused — must ship a trigger or stop asking permission.
- [2026-05-01 Human] Locked Read Aloud teaser shipped — owner-only active button; non-owner viewers see locked pill that branches: viewer-with-gallery → "Open my galleries" / viewer-without-gallery → "Create a gallery." Subscriber count fix: SECURITY DEFINER RPC (`subscriber_count`) so non-owner visitors see the public follower count without leaking subscriber identities. Migration 019 applied.
- [2026-05-01 Human] User-selectable TTS voice shipped — migration 018 (`tts_voice_id` on profiles), 5-voice curated catalog, on-demand sample preview cached client-side, profile picker section. Files: `supabase/migrations/018_profiles_tts_voice.sql`, `supabase/functions/tts/index.ts`, `app/lib/voices.ts`, `app/components/VoicePicker.tsx`, `app/components/ReadAloudButton.tsx`, `app/app/(tabs)/profile.tsx`.
- [2026-05-01 Human] Owners auto-follow own gallery — migration 017 + backfill applied. Comment rate limit 5min → 30s, edge function deployed. Gallery cover flicker bug root-caused (queryKey shape collision) and fixed.
- [2026-04-30 Human] Gallery subscriptions shipped (schema + Follow + Discover segmented control). Migration applied to remote Supabase. Notifications deferred. Files: `supabase/migrations/016_subscriptions.sql`, `app/lib/subscriptions.ts`, `app/app/gallery/[slug].tsx`, `app/app/(tabs)/discover.tsx`, `app/lib/analytics.ts`.
- [2026-04-30 Human] Operator metrics dashboard at `/metrics` shipped — token-gated, server-rendered, multi-user exclude. Files: `web/api/metrics.js`, `web/vercel.json`.
- [2026-04-30 Human] Read Aloud gated to owner only on piece detail — visitors no longer see it (cost + product alignment, description is written *to* the child). File: `app/app/piece/[id].tsx`. Added voice-picker backlog item for v1.2.
- [2026-04-25 CRON B] Vote button "already voted" state fixed — `myVote` query + `hasVoted` disables and dims button; cache invalidated on vote success. File: `app/app/piece/[id].tsx`.
- [2026-04-25 CRON A] Confirmed items 1 & 2 done in code; found vote button on piece detail always tappable even after voting (error alert breaks delight moment); rewrote backlog with 1 new item + 2 pending.
- [2026-04-24 CRON B] Vote-after-login fixed in both flows — `?vote=1` encoded into returnTo URL so login.tsx carries it through. Files: `app/(tabs)/discover.tsx`, `app/piece/[id].tsx`.
- [2026-04-24 CRON A] Found vote param silently dropped by login.tsx in both discover and piece flows; found 5 "Store"→"Gallery" copy violations in create.tsx; updated backlog item 1 with correct 2-file fix, added item 2.
- [2026-04-24 Human] Resolved CLAUDE.md merge conflicts from Gemini sync; added Gallery/Store rename protection and print card rejection to What we've tried and rejected; fixed piece/[id].tsx Gallery→Store revert and print card re-add from cron run.
- [2026-04-24 CRON B] Digital download CTA for grandparents + Gallery copy fix — added `{!isOwner && !myDigitalOrder}` block with digital card; fixed "Gallery"→"Store" revert. File: `app/app/piece/[id].tsx`.
- [2026-04-24 CRON A] Marked 7 task queue items ✅; found cron had re-added print card and reverted Gallery→Store; confirmed discover vote redirect sends to discover not piece (vote lost); rewrote backlog.
- [2026-04-24 Human] Migrated cron system to Claude Code CLI; added Decision filter, What we've tried and rejected, Known production errors, Recent user feedback sections to CLAUDE.md.
- [2026-04-22 CRON B] Reframe pass 2 & critical UX fixes — updated 5 screens with "step inside" copy; fixed write-only profile name; added network error retry UI; improved store empty state.
- [2026-04-22 CRON B] Re-download column fix — `fetchMyDigitalOrder` corrected from `user_id`/`type` to `buyer_id`/`order_type`.
- [2026-04-22 CRON B] Upload timeouts — `withUploadTimeout` wraps both storage uploads; 90s Promise.race prevents permanent "Publishing…" state.
