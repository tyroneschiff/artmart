# Draw Up — iOS App Store Submission Readiness

**App:** Draw Up · **Bundle ID:** `art.drawup.app` · **ASC App ID:** `6762963488`
**Assessed:** 2026-06-25 · **Repo:** `/Users/tyschiff/artmart`
**Version in `app/app.json`:** `1.1.7` / build `26`

> **Overall:** Compliance fundamentals (account deletion, privacy/terms, signature-verified
> payments) are **in place and verified in code**. Submission is blocked by **two code defects**
> (placeholder Apple Team ID in `apple-app-site-association`; missing iOS add-to-Photos usage
> string for `expo-media-library`) plus a **business-config decision** (Stripe still in test mode)
> and a **large block of App Store Connect dashboard work** (screenshots, privacy nutrition
> label, age rating, metadata) that only the human can do.

---

## 1. Code / Compliance Status

| Requirement | Status | Evidence |
|---|---|---|
| **Account deletion** edge function exists | ✅ Done | `supabase/functions/delete-account/index.ts` — JWT-verified, service-role `auth.admin.deleteUser(userId)`, cascades via FK |
| **Account deletion** in-app flow (Apple 5.1.1(v)) | ✅ Done | `app/app/(tabs)/profile.tsx:165-221` — two-tap Alert chain → POST to `/functions/v1/delete-account` with bearer token → `signOut()` → redirect to login. Button at `:386-397` |
| **Privacy Policy** page exists | ✅ Done | `web/privacy.html` (brand-styled, COPPA section at `:101-104`, AI processors disclosed `:83-89`) |
| **Terms of Service** page exists | ✅ Done | `web/terms.html` (18+ requirement `:64`, AI/content/acceptable-use sections) |
| **Privacy/Terms linked from app** | ✅ Done | `profile.tsx:357-372` — rows open `https://drawup.ink/privacy` and `/terms` |
| **Privacy/Terms routing resolves** | ✅ Done | `web/vercel.json` `cleanUrls:true` serves `/privacy` + `/terms` from the `.html` files (no rewrite needed) |
| **Push permission prompt disabled** (don't ask for unused permission) | ✅ Done | `app/app/_layout.tsx:161-185` — the `registerForPushNotificationsAsync` `useEffect` is fully commented out; helper kept for one-line re-enable |
| **Stripe webhook signature verification** | ✅ Done | `supabase/functions/stripe-webhook/index.ts:16` — `stripe.webhooks.constructEvent(body, signature, webhookSecret)`, returns 400 on failure |
| **Comment moderation present** (UGC safety) | ✅ Done (⚠ doc drift) | `supabase/functions/moderate-comment/index.ts` — **uses Gemini 2.5 Flash**, not Claude Haiku as CLAUDE.md claims. 300-char cap `:55`, 30s rate limit `:69`, pre-insert moderation `:108` |
| **Camera + Photo (read) usage strings** | ✅ Done | `app/app.json:48-54` — `expo-image-picker` plugin sets `photosPermission` + `cameraPermission`. Used in `app/app/(tabs)/create.tsx:107,120,122` |
| **Encryption declaration** (ITSAppUsesNonExemptEncryption) | ✅ Done | `app/app.json:36-38` — `"ITSAppUsesNonExemptEncryption": false` (avoids per-build export-compliance prompt) |
| **`supportsTablet` set** | ✅ Done (intentional) | `app/app.json:30` — `false` (iPhone-only; matches "iPad after launch" strategy). No iPad screenshots required |
| **App icon asset** | ✅ Done | `app/assets/icon.png` (171 KB) |
| **Universal Links / `apple-app-site-association`** | ❌ **BLOCKING** | `web/.well-known/apple-app-site-association` — `appIDs` and `webcredentials.apps` are literal `"REPLACE_WITH_TEAM_ID.art.drawup.app"`. Until the real Apple Team ID is substituted, `applinks:drawup.ink` (declared in `app.json:32-35`) **does not work** — tapped share links won't open the app, breaking the share→open loop |
| **Add-to-Photos usage string** (`NSPhotoLibraryAddUsageDescription`) | ❌ **BLOCKING / risk** | `app/lib/preservation.ts:46-78` calls `MediaLibrary.requestPermissionsAsync` + `createAssetAsync`/`createAlbumAsync` (writes to Photos). But `app/app.json` has **no `expo-media-library` plugin** and **no `NSPhotoLibraryAddUsageDescription`** — only the image-picker *read* string. iOS add-only prompt with no purpose string → crash or Guideline 5.1.1 rejection. "Save all originals to Photos" is reachable from `profile.tsx:277-296` |
| **Stripe live mode** | ⚠ Risk (business decision) | `app/eas.json:10,23` — both preview + production profiles use `pk_test_…`. A public-store build that takes real money must use `pk_live_…` (and live `STRIPE_SECRET_KEY` + webhook secret in Supabase). See §3 |
| **Version/build bumped for new features** | ⚠ Risk | `app/app.json` = `1.1.7` / `26`. CLAUDE.md (2026-05-09) says all marathon features shipped to `main` but the next build should be `1.1.8` / `27`; current live TestFlight is `1.1.7 (26)`. Must bump `version` + `buildNumber` before archiving, or the upload collides |
| **Review-prompt (`expo-store-review`)** | ⚠ Minor (not blocking) | No `store-review` usage anywhere (`grep` clean); not in `app/package.json`. Ratings never solicited — leaves install-to-rating lift on the table (ASO) |
| **Microphone permission** | ⚠ Minor | `app/app.json:23-26` declares Android `RECORD_AUDIO`; no iOS mic usage string and no recording code (TTS only plays audio). Harmless on iOS but the Android permission is unused — clean up before Android build |

**Net:** 2 hard code blockers, 1 payments-config blocker for a money-taking launch, 1 version bump, plus doc/minor items.

---

## 2. App Store Connect Metadata Gaps (Dashboard work — human must do)

None of this lives in the repo; all of it is required (or strongly expected) in App Store Connect before the build can pass review and be sold.

**Visual assets**
- [ ] **6.7" screenshots** (iPhone 15/16 Pro Max, 1290×2796) — required. Lead with the magic moment (drawing → world reveal, read-aloud).
- [ ] **6.5" screenshots** (1284×2778 / 1242×2688) — required as a separate set.
- [ ] *(5.5" 1242×2208 is no longer mandatory for new apps; skip unless targeting older devices.)*
- [ ] **App preview video** (optional but high-leverage for this product — the before→after reveal is the pitch). 15–30s, portrait. Note: the auto-MP4 reveal feature is still un-built (CLAUDE.md backlog), so this must be recorded manually for now.

**Text metadata**
- [ ] **App name** (30 char) — "Draw Up" (confirm availability/branding).
- [ ] **Subtitle** (30 char) — e.g. "Kids' art into magical worlds".
- [ ] **Promotional text** (170 char, editable without resubmit).
- [ ] **Description** (4000 char) — lead with delight, not preservation (per product positioning).
- [ ] **Keywords** (100 char, comma-separated) — kids art, drawing, AI art, children, gallery, keepsake, etc.
- [ ] **Support URL** — `https://drawup.ink` (or a `/support` page). In-app support is `hello@drawup.ink` (`profile.tsx:355`); ASC requires a *URL*, not just an email.
- [ ] **Marketing URL** (optional) — `https://drawup.ink` (landing page exists: `web/index.html`, title confirmed).
- [ ] **Privacy Policy URL** — `https://drawup.ink/privacy` (page verified to exist).

**Age rating questionnaire**
- [ ] Complete the rating questionnaire. UGC is present (comments + public Discover) → Apple will push toward **12+** and require the standard UGC safeguards declaration (moderation + report + block). Moderation exists (`moderate-comment`) and reports exist (`reports` table per CLAUDE.md) — confirm a **block-user** path before claiming the full UGC safeguard set.

**App Privacy "nutrition label" (Data collection declaration)** — must match what the code actually does:
- [ ] **Contact Info → Email address** — collected, linked to identity (sign-in). Evidence: auth + `profiles`.
- [ ] **User Content → Photos** — drawings + AI outputs uploaded to Supabase Storage. Evidence: `create.tsx` upload flow.
- [ ] **User Content → Other (child's first name, piece titles, comments)** — Evidence: `stores.child_name`, `pieces.title`, `comments`.
- [ ] **Identifiers / Usage Data** — analytics events (votes, opens, follows). Evidence: `app/lib/analytics.ts` (`track(...)` used throughout).
- [ ] **Purchases** — Stripe transaction IDs (no card data). Evidence: `stripe-webhook`, `orders`.
- [ ] **Do NOT declare push tokens** as collected — the prompt is disabled, so no tokens are gathered. ⚠ `web/privacy.html:65` still lists "Push notification tokens (if you allow)" — update the policy text so it doesn't claim a collection that no longer happens.
- [ ] Third-party processors to keep in mind when answering "data shared with third parties": **Supabase** (host), **Anthropic** (Claude vision), **fal.ai** (image), **ElevenLabs** (TTS), **Gemini** (comment moderation), **Stripe** (payments), **Resend** (email). The privacy policy discloses Anthropic/fal.ai/ElevenLabs but **omits Gemini and Resend** — align before submitting.

**Other ASC requirements**
- [ ] **Sign-in–required → demo account** for App Review (app gates most flows behind auth). Provide test credentials + note in "App Review Information."
- [ ] **Sign in with Apple** — `expo-apple-authentication` is a plugin (`app.json:46`). If Apple sign-in OR any third-party/social sign-in is offered, Apple requires Sign in with Apple to be present (it is) — just confirm it's wired in the auth screen.
- [ ] Export compliance is pre-answered via `ITSAppUsesNonExemptEncryption:false` — no per-build action needed.

---

## 3. Risks Specific to This App

1. **AI-generated image output with no human review (reputational).** fal.ai Flux can produce off-tone scenes from a child's drawing, and there is no human-in-the-loop review of *outputs* (only comment-text moderation exists; image *inputs/outputs* are unmoderated). For a kids/family brand this is a low-probability, high-blast-radius risk. Apple may also probe AI-content safety for an app positioned around children. Mitigation before scale: an output safety pass or a fast user-report→takedown path for published pieces. (CLAUDE.md already flags this under "What we're not thinking about.")

2. **Kids / COPPA positioning.** The app is *for parents about children*, and the policy is written that way (`web/privacy.html:101-104`, Terms 18+ at `terms.html:64`). To stay out of the Kids Category (and its hard COPPA constraints): keep store listing audience as parents/adults, keep age rating 12+ (driven by UGC anyway), and never market the app as for-children-to-use. The only child PII stored is the first name (parent-provided) — keep it that way. **Do not** opt into the Kids Category, which would force removal of third-party analytics and external links.

3. **Comment moderation depends on a third-party LLM at request time.** `moderate-comment` blocks insert if Gemini is unreachable (`:103` throws → 500), which fails safe (no unmoderated comment gets in) but means a Gemini outage = no commenting. Acceptable for launch. Note the **doc drift**: CLAUDE.md and Terms imply Claude/Haiku; the code uses **Gemini 2.5 Flash** with `GOOGLE_GENERATIVE_AI_API_KEY`. Reconcile so the App Privacy "third parties" answer is truthful.

4. **Stripe test mode.** `eas.json` ships `pk_test_…` in both profiles. Two implications: (a) a public App Store build in test mode cannot take real money — purchases will silently use test rails; (b) per CLAUDE.md's 2026-05-08 crash post-mortem, the swap to `pk_live_…` must be done in **both** profiles or the production build SIGSEGVs on launch (Stripe native init throws on `undefined`/mismatch). Also flip `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` to live in Supabase secrets and re-point the live webhook endpoint. **Separately:** digital-download purchases of the user's *own* content via Stripe may draw Apple IAP scrutiny (Guideline 3.1.1) — credits/downloads consumed in-app can be required to use Apple IAP. Worth pre-deciding the answer before review.

5. **`drawup.ink` dependency.** Privacy, Terms, support, deep-link verification (AASA), OG previews, and the web gallery all depend on `drawup.ink` being live on Vercel with correct routing. If DNS/hosting lapses, **App Review can reject for an unreachable Privacy Policy URL**, and Universal Links break. CLAUDE.md notes a prior DNS/WHOIS hold on the domain — confirm it's resolving and stable before submitting. The AASA placeholder (§1) is part of this surface.

---

## 4. Path to Submit (ordered)

### CODE — must fix in the repo (engineering)

1. **[BLOCKING] Replace the Apple Team ID placeholder.** `web/.well-known/apple-app-site-association` — swap both `REPLACE_WITH_TEAM_ID` for the real 10-char Team ID (`<TEAMID>.art.drawup.app`), redeploy `drawup.ink`, and verify `applinks:drawup.ink` opens `/piece/*` + `/gallery/*` in the app. *(Not a config file — editable.)*
2. **[BLOCKING] Add the iOS add-to-Photos permission.** Add `expo-media-library` to `app/app.json` plugins with `savePhotosPermission`/`photosPermission`, OR add `NSPhotoLibraryAddUsageDescription` to `ios.infoPlist`, so "Save all originals to Photos" (`app/lib/preservation.ts`) doesn't crash / get rejected under Guideline 5.1.1. *(Requires editing `app.json` — out of CRON B scope; human or explicit task.)*
3. **[BLOCKING for paid launch] Move Stripe to live.** `app/eas.json` — `pk_live_…` in **both** preview and production `env` blocks; set live `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` in Supabase; re-point webhook. Pre-decide the Apple-IAP-vs-Stripe question (§3.4) first.
4. **[REQUIRED] Bump version/build.** `app/app.json` — `version` → `1.1.8` (or higher), `buildNumber` → `27`+, so the archive doesn't collide with the existing `1.1.7 (26)` and ships the marathon features.
5. **[SHOULD] Reconcile docs/policy with reality.** Fix `web/privacy.html` to (a) drop the push-token collection claim (`:65`) and (b) add Gemini + Resend to disclosed processors; correct the "Claude Haiku" → Gemini moderation references in CLAUDE.md/Terms. (Doc-only; do not change moderation behavior.)
6. **[OPTIONAL] Add `expo-store-review`** and trigger a rating prompt after the 3rd successful publish (ASO lift). Not a blocker.
7. **Build + archive:** `eas build --platform ios --profile preview` (CLAUDE.md's tested path), validate launch on a real device, then `eas submit --platform ios`.

### DASHBOARD — App Store Connect (human only, cannot be done from the repo)

8. Create/confirm the app record (App ID `6762963488`), set **subtitle**, **promo text**, **description**, **keywords**.
9. Upload **6.7"** and **6.5"** screenshot sets; optionally the **app preview video**.
10. Set **Support URL** (a real URL, e.g. `drawup.ink`), **Marketing URL**, **Privacy Policy URL** (`drawup.ink/privacy`).
11. Complete the **Age Rating** questionnaire (expect 12+ from UGC) and the **App Privacy** nutrition label per §2 — make it match the code, not the marketing.
12. Provide **App Review demo account** + reviewer notes (the app is auth-gated). Confirm **Sign in with Apple** is live.
13. Confirm **`drawup.ink` is reachable and stable** (Privacy/Terms/AASA) at submission time.
14. Submit for review.

---

### Evidence index (paths cited)
- `supabase/functions/delete-account/index.ts` · `app/app/(tabs)/profile.tsx`
- `web/privacy.html` · `web/terms.html` · `web/vercel.json`
- `app/app/_layout.tsx` (push disabled) · `app/app.json` · `app/eas.json`
- `supabase/functions/stripe-webhook/index.ts` · `supabase/functions/moderate-comment/index.ts`
- `web/.well-known/apple-app-site-association` · `app/lib/preservation.ts` · `app/app/(tabs)/create.tsx`
