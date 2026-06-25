# Draw Up — App Store Connect metadata (paste-ready)

*Authored 2026-06-25. Everything here is ready to paste into App Store Connect. The App Privacy answers are grounded in the actual data flows in this repo (cited). The screenshots / preview video / actually entering these in the dashboard are human-only steps — see the checklist at the bottom.*

---

## Listing copy

**App name:** Draw Up

**Subtitle** (30 char max): `Kids' art, brought to life`  *(26)*

**Promotional text** (170 char max — editable anytime without review):
`Snap a photo of your child's drawing and watch AI bring it to life as a vivid world — read aloud in a warm voice, and kept forever in a gallery you can share.`

**Keywords** (100 char max, comma-separated, no spaces, don't repeat words in the name/subtitle):
`kids drawing,children art,AI art,kids art app,drawing,child artwork,keepsake,storybook,toddler,memories`

**Description:**
```
Your kid hands you a drawing. You can't keep them all — but you can't bear to throw them away either. Draw Up fixes that.

Snap a photo of any drawing and watch AI bring it to life as a vivid, storybook world that reflects exactly what your child imagined — their characters, their colors, their wobbly suns and wild dragons. A warm voice reads the scene back to them by name, so the drawing isn't just saved — it's celebrated. Then every piece lives in a personal gallery you can keep forever and share with the people who love them.

HOW IT WORKS
• Photograph your child's drawing
• AI reimagines it as a vivid world, true to what they drew
• Hear it read aloud in a warm voice you can choose
• Publish it to your child's gallery and share a private link

WHY PARENTS LOVE IT
• Stop choosing between memory and clutter — keep every drawing without the paper mountain
• Save the original drawings straight to your Photos
• A beautiful, private gallery for each child
• Your first three drawings are on us

Draw Up is made for parents who want to preserve their children's artwork and celebrate it — not file it away in a drawer that never gets opened again.
```

**What's New in 1.1.8:**
```
• Read Aloud descriptions are more varied and surprising
• A cleaner, warmer look across the app
• Pick your favorite Read Aloud voice
• Move a piece between galleries, choose a gallery cover
• Faster, more reliable transforms
• Lots of polish and fixes
```

**Support URL:** https://drawup.ink
**Marketing URL:** https://drawup.ink
**Privacy Policy URL:** https://drawup.ink/privacy

---

## App Privacy ("nutrition label") — grounded in code

For each type: whether it's collected, linked to the user's identity, and used for tracking (cross-app/IDFA-style). **Nothing in this app is used for tracking** — there is no ad SDK and no third-party analytics; the only analytics is the first-party `events` table (`supabase/migrations/014_events.sql`, written by `app/lib/analytics.ts`).

| Data type | Collected? | Linked to user? | Tracking? | Purpose / evidence |
|---|---|---|---|---|
| Contact Info → Email address | Yes | Yes | No | Account auth (Supabase). |
| User Content → Photos | Yes | Yes | No | The drawings + rendered worlds, in Storage bucket `artwork`. App Functionality. |
| User Content → Other (comments, child name, titles) | Yes | Yes | No | Comments (`004_comments.sql`), gallery `child_name`, piece titles. |
| Identifiers → User ID | Yes | Yes | No | Supabase auth user id; stored on rows + `events`. |
| Usage Data → Product Interaction | Yes | Yes | No | First-party `events` table (transform/vote/share/etc.). Analytics + App Functionality. |
| Purchases → Purchase History | Yes | Yes | No | `orders` rows (piece_id, type, Stripe payment-intent id). Card data handled by Stripe, not stored by us. |
| Diagnostics → Crash/Performance | Yes | No | No | Via Apple/Expo. |

Notes for the form:
- **Push token: do NOT declare** — the prompt is disabled and we no longer write `expo_push_token` (`app/app/_layout.tsx`, registration commented out). Re-declare only if push ships.
- **No location, contacts, health, browsing history, search history, sensitive info.**
- **Third-party processors** (disclose in the privacy policy, already done in `web/privacy.html`): Anthropic (Claude, description), fal.ai (Flux + future video), ElevenLabs (Read Aloud), Google Gemini (comment moderation), Resend (email), Stripe (payments), Supabase (hosting/DB/auth).

---

## Age rating questionnaire

- Made for Kids / Kids Category: **No** — do not enroll in the Kids Category. The app has user-generated content (comments, shared galleries) and is operated by parents; the Kids Category's restrictions + UGC rules make it the wrong fit. Position as a parenting/utility app.
- User-Generated Content: **Yes** — comments + shareable galleries. Mitigations to cite: auth-only, AI-moderated before posting (Gemini), reportable, deletable, no private messaging/DMs. Expect Apple to land this around **9+/12+** given unrestricted-ish UGC; that's fine.
- Unrestricted web access: **No.**
- Cartoon/fantasy violence, mature themes, gambling, contests: **None.**

---

## Human-only dashboard steps (not code)
1. **Screenshots** — 6.7" (iPhone 15/16 Pro Max) and 6.5" sets. Show the magic moment: a real before→after, the gallery grid, the Read Aloud screen, the share. This is the single biggest conversion lever; make them great.
2. **App preview video** (optional but high-impact) — 15–30s of a drawing becoming a world.
3. Paste the listing copy above into App Store Connect → enter the App Privacy answers → complete the age-rating questionnaire.
4. Provide a **demo account** for App Review (reviewer login) with credits, and review notes explaining the AI transform + that originals are user-supplied children's drawings.
5. **Decision before a live launch (not a blocker for review):** Stripe is in **test mode** (`pk_test_…` in `app/eas.json` both profiles; `sk_test`/test webhook in Supabase secrets). For real purchases, swap to `pk_live_…`/`sk_live_…` in BOTH eas.json profiles + Supabase secrets and rebuild. Forgetting one profile re-triggers the launch-crash class from 2026-05-08.

## Still-open code/compliance notes (from app-store-readiness.md)
- AASA Team ID + media-library Photos permission: ✅ fixed (build 27 carries them).
- Universal Links only fully work once build 27 (with the matching team id entitlement) is installed.
- Account deletion, privacy/terms links, disabled push prompt: ✅ in code.
