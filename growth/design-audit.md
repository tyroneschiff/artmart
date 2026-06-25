# Draw Up — Design / UX Audit

*Authored 2026-06-25 from a screen-by-screen read of 14 surfaces. Design system reference: `app/lib/theme.ts`. Aesthetic target: ucals.com layout discipline + tincan.kids warmth, "premium but approachable." All file:line citations are to the version read on this date.*

**How to read priorities:**
- **P1** — Inconsistency or off-token value a user will feel, OR a flow-critical state (empty/error/loading) that undercuts trust at a moment that matters. Fix first.
- **P2** — Visible polish gap; hierarchy, spacing, or token drift that a designer would flag but a user tolerates.
- **P3** — Refinement; nice-to-have consistency, micro-copy, dead code.

A recurring theme worth stating once: the token file (`theme.ts`) is genuinely good — `radius`, `opacity`, `type`, `btn`, `card` are all centralized — but **most screens predate it and redeclare the same values as local literals.** The single highest-leverage design move is to make every screen consume `type.*` / `btn.*` / `radius.*` rather than re-typing `fontWeight: '900', letterSpacing: -1` etc. Per-screen items below call out the specific offenders.

---

## `app/lib/theme.ts` — token source of truth

**What's working:** Genuinely strong foundation — radius scale is documented with intent (`theme.ts:1-10`), `opacity.disabled` is centralized with a comment explaining the 0.4/0.5 consolidation (`theme.ts:12-16`), and `type` / `btn` / `card` give every screen a shared vocabulary.

- **P2 — Color palette in `theme.ts:18-34` has grown well past the 7 tokens documented in CLAUDE.md.** The file now defines `creamDark`, `goldDark`, `goldLight`, `goldMid`, `danger`, `dangerText`, `dangerBg`, `dangerBorder` — none of which appear in the CLAUDE.md design-system table. These are used and useful (skeleton shimmer, gold accents, error cards), but the table is now stale, so any contributor cross-checking against CLAUDE.md will think `goldLight`/`goldMid` are off-system and either avoid them or re-invent hexes. Action: this is a docs-sync issue, not a code one — flag to whoever owns CLAUDE.md that the palette table needs the gold/danger families added. (Not editable here per task scope; noting for the doc.)
- **P2 — No spacing scale.** Radius, opacity, type, and buttons are tokenized, but spacing is freehand everywhere (`paddingHorizontal: 20` vs `24` vs `28` vs `16` across screens; `marginBottom: 16` vs `20` vs `24` vs `32`). A `space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 }` token would let the per-screen padding inconsistencies below (login 28, discover 20, profile 24, credits 20) converge. This is the root cause of ~40% of the items in this audit.
- **P3 — `type.h3` color is `dark` but several screens override its `fontSize` inline** (e.g. discover card title `...type.h3, fontSize: 13` at `discover.tsx:345`, gallery title `...type.h3, fontSize: 13` at `[slug].tsx:376`). Consider a `type.cardTitle` token (13px, weight 700, dark) since this 13px-titled-card pattern repeats on Discover and Gallery. Reduces the "spread `type.h3` then stomp it" smell.
- **P3 — No shadow/elevation token.** Card shadows are re-specified per screen with subtly different values: create's `takePhotoBtn` uses `shadowOpacity: 0.18` (`create.tsx:566`), its `successCard` uses `0.05` (`create.tsx:665`), mystores `emptyPortal` uses `0.05` (`mystores.tsx:268`), credits `packCardFeatured` uses `0.08` (`credits.tsx:181`). A `shadow.sm/md/lg` token set would make elevation feel intentional rather than per-author.

---

## `app/app/(auth)/login.tsx` — first impression

**What's working:** Clean, centered, confident. The wordmark + tagline + form rhythm is the most "premium" screen in the app, and password-reveal eye toggle (`login.tsx:116-127`) plus correct `textContentType`/`autoComplete` show care.

- **P2 — Login does not use `btn.primary` / `btn.primaryText`.** The CTA at `login.tsx:181-189` re-declares the dark pill button (`backgroundColor: colors.dark, borderRadius: radius.pill, paddingVertical: 17`) instead of spreading `btn.primary`. Note `paddingVertical: 17` vs the token's `16` — a 1px drift that means this button is subtly taller than every other primary button in the app. Switch to `...btn.primary` (override only what's intentional).
- **P2 — Inputs use `borderRadius: radius.md` (14) and `borderWidth: 1.5`** (`login.tsx:161-169`) which matches create.tsx and mystores inputs — good — but profile's input uses a bottom-border-only style (`profile.tsx:432`) and the comment input uses `card` radius. Input styling is forked 3 ways across the app. Login is the correct reference; the divergence is profile's problem (see below), but worth noting the canonical input lives here.
- **P3 — `tagline` (`login.tsx:159`) is `fontSize: 17, fontWeight: '500'` with `letterSpacing: -0.3`.** This is a bespoke type ramp not in `type`. It reads fine, but it's the kind of one-off that, multiplied across screens, is why there's no consistent "lede/subhead" style. Candidate for a `type.lede` token (also used by onboarding `lede` and credits `subhead`).
- **P3 — Logo `letterSpacing: -2.5` at 48px (`login.tsx:157`)** is tighter than `type.h1`'s `-1`. Intentional for the wordmark and looks good; just flag that the wordmark is its own thing and shouldn't be tokenized as h1.

---

## `app/app/(tabs)/discover.tsx` — highest-traffic visitor surface

**What's working:** Empty states are warm and branched (following vs discover, `discover.tsx:252-272`), the sort dropdown is tidy, and the optimistic-vote + "already voted" dimming is handled. Error state has a real retry (`discover.tsx:150-160`).

- **P1 — Card title spread-then-stomped and visually weak.** `discover.tsx:345` does `title: { ...type.h3, fontSize: 13, letterSpacing: -0.2 }`. `type.h3` is weight 700 / 18px; overriding to 13px keeps weight 700 but the result is a cramped 13px bold title above a 12px uppercase-muted child name (`childName: { ...type.label }`, `discover.tsx:346`). On a 2-up grid the child's name — the emotional payload ("this is Emma's world") — is the faintest text on the card. Recommend: child name should be at least as prominent as the title, in `colors.mid` not `colors.muted`, weight 600. This is the screen visitors judge the whole product on.
- **P1 — Vote badge contrast / token drift.** The vote badge background is a raw `'rgba(0,0,0,0.45)'` literal (`discover.tsx:341`), repeated identically in gallery (`[slug].tsx:373`). It's a translucent black pill floating on AI imagery that can be light or dark — on a pale transformed image the 0.45 black is fine, but it's an un-tokenized magic value used in two files. Add a `colors.overlay` / `colors.scrim` token (e.g. `'rgba(0,0,0,0.45)'`) and reference it. Also: the badge is the only tap target to vote from Discover, and at `paddingHorizontal: 9, paddingVertical: 4` (`discover.tsx:341`) with a 12px icon it's a small hit area for a one-tap delight action — bump to satisfy the ~44px touch guideline (hitSlop at minimum).
- **P2 — Two different dropdown vertical offsets, both magic numbers.** Discover's sort dropdown backdrop is `paddingTop: 140` (`discover.tsx:325`); gallery's is `paddingTop: 220` (`[slug].tsx:389`). Both are hardcoded guesses at where the trigger sits, and both will drift on different device heights / with the segmented control shown vs hidden. The discover one is especially fragile because the segmented control conditionally adds ~46px above the sort button, but the `140` is fixed — so on accounts with subscriptions the menu floats detached from its trigger. Anchor the menu to the trigger (measure, or use a popover lib) rather than a fixed top inset.
- **P2 — `segmentTextActive` uses `colors.cream` as text-on-dark (`discover.tsx:323`)** while the matching pattern elsewhere uses `colors.white` on dark (e.g. `btn.primaryText`). Cream-on-dark vs white-on-dark is a subtle warmth choice and arguably correct here, but it's inconsistent with every other dark-pill label in the app. Pick one (cream is the warmer, more on-brand choice — if so, apply it to `btn.primaryText` too, or document the exception).
- **P3 — Header gap rhythm.** `headerBlock` marginBottom 20, `headerRow` marginBottom 10, segmented marginBottom 10, then the sort button — produces an uneven stack when the segmented control is present (10+10) vs absent (just 10 before sort). Tighten to a single consistent vertical gap.
- **P3 — Empty-state CTA re-declares button.** `emptyCta: { ...btn.primary, paddingHorizontal: 28, paddingVertical: 14 }` (`discover.tsx:351`) — fine, it spreads the token, but the 14 paddingVertical (vs token 16) is a recurring "slightly smaller primary" that appears ~6 times across the app with no shared name. Consider a `btn.primarySm` for the 14/24 variant used in empties and retries.

---

## `app/app/(tabs)/create.tsx` — the magic moment; most important flow

**What's working:** The step machine (pick → transform → publish → success) is coherent, the success screen with confetti + AI description + Read Aloud + share is genuinely delightful (`create.tsx:325-381`), and the transform error card with category icon (`create.tsx:430-450`) is thoughtful. Transform-error retry preserves the image — the single most important create-flow UX.

- **P1 — Largest concentration of dead / duplicated style code in the app.** The `StyleSheet` (`create.tsx:547-702`) contains many styles that are never referenced because the JSX uses inline objects or `btn.*` instead: `header` (550, JSX uses `type.h1`), `prompt` (579), `bigBtn`/`bigBtnSecondary`/`bigBtnIcon`/`bigBtnText` (580-583), `button`/`buttonText` (585, 587), `transformingText`/`transformingSubtext` (590-591), `upsellBtn`/`upsellBtnText` (614-624 — the actual upsell button uses `btn.primary`), `storePickerText` (641), `inlineStoreBtn`/`inlineStoreBtnText` (646-647), and the entire success-screen block `successTitle`/`successSubtitle`/`whatsappBtn`/`whatsappBtnText`/`instagramBtn`/`instagramBtnText`/`nativeShareBtn`/`nativeShareBtnText`/`startOverBtn`/`startOverBtnText` (670-701) — the success screen is built entirely from inline styles + `btn.*`, so all 12 of those are orphaned. This is a real maintenance hazard: a contributor editing `whatsappBtn` would change nothing. Delete the unused styles; move the success screen's inline objects into named styles.
- **P1 — Success-screen body is heavily inline-styled, hurting consistency.** The success card content (`create.tsx:336-377`) uses inline objects for the description box (`backgroundColor: colors.goldLight, borderRadius: radius.md, padding: 16, borderWidth: 1, borderColor: colors.goldMid` at line 343) — which is the exact same "gold info card" recipe as create's `inlineStoreCreate` (642), mystores `upsellCard` (230-241), and credits `balancePill`/featured pack. This gold-bordered-light-card is a de-facto component appearing 5+ times with copy-pasted values. Extract a `goldCard` style token (or component). High impact because it's the app's most-repeated visual unit.
- **P2 — "The drawing" / "The world" compare labels were explicitly removed per CLAUDE.md `## What we've tried and rejected`, but they are still present.** `create.tsx:465` renders `The drawing` and `create.tsx:469` renders `The world` above the compare images, styled by `compareLabel` (`create.tsx:637`). CLAUDE.md says: *"Compare labels ('The Drawing' / 'The World') — Removed entirely. Two images side by side is self-explanatory."* Either the removal regressed or the doc is stale. Flag for reconciliation — if the rejection still stands, these two labels should come out.
- **P2 — `radius.xl` (24) on the take-photo button (`create.tsx:558`) vs `radius.lg`/`md` elsewhere for big tappables.** The hero "Take Photo" block is the app's biggest CTA and uses xl radius + a heavy shadow (opacity 0.18) — good, it should feel like the hero. But the `successCard` also uses `radius.xl` (665) with a much softer shadow, and the publish-step primary button uses pill. The radius language for "big surface" isn't consistent (xl card vs pill button vs lg). Decide: cards = xl/lg, buttons = pill. Currently mostly true but the take-photo button blurs it (it's a button shaped like a card).
- **P2 — Transform loading state is bare.** `create.tsx:424-428`: a spinner + rotating tip + "This takes about 30 seconds." The rest of the app has shimmer skeletons (`Skeleton.tsx`), but the single most-anticipated wait in the product — the transform — gets a plain `ActivityIndicator`. For the emotional peak ("is my kid's drawing working?"), consider a richer treatment (progress shimmer over the source image, or the before-image with an animated sweep). Decision-filter pass: this directly affects whether a parent completes a transform (item 1).
- **P3 — `'✨ Step Inside'` (`create.tsx:452`) and `'Publish to Gallery'` button copy** mix an emoji CTA with a plain one. Fine, but the success screen's "Send to Grandma via WhatsApp" is a tiny muted `type.label` link (`create.tsx:375`) — the single highest-leverage acquisition action (share) is the visually quietest element on the success screen. Per the Acquisition strategy (shares/transform is a kill metric), the WhatsApp share should be a real button, not a muted footnote. (Flagging as design-priority; it borders on product.)
- **P3 — `webNotice` radius is `radius.sm` (`create.tsx:633`)** while every other info card uses `radius.md`. Minor; align to md.

---

## `app/app/(tabs)/mystores.tsx` — "My Galleries"

**What's working:** Gallery cards with cover image + initial badge (`mystores.tsx:131-150`) are attractive and on-brand; the warm copy ("First world coming soon", "X worlds") and the portal empty state (`mystores.tsx:153-164`) land the tone well. Owner-picked cover fallback logic is sound.

- **P1 — Loading state is a bare centered spinner, inconsistent with the rest of the app.** `mystores.tsx:89`: `if (isLoading) return <View style={styles.center}><ActivityIndicator .../></View>`. Discover, Gallery, and Piece all use shimmer skeletons (`DiscoverSkeleton`, `GallerySkeleton`, `PieceSkeleton`). My Galleries is a primary tab and should have a `MyStoresSkeleton` (card-shaped rows) for visual consistency. The spinner reads as lower-fidelity than the screen it precedes.
- **P2 — Dead styles + inconsistent input token.** `storeSlug` (`mystores.tsx:229`) is defined but never rendered (the card shows `storeMeta` only). The modal input at `mystores.tsx:282` is `{ ...card, padding: 16, borderWidth: 1.5 }` — spreading `card` (which is `borderRadius: radius.md, borderWidth: 1`) then overriding borderWidth to 1.5. Works, but it's a different construction than login/create inputs (which set borderColor/radius explicitly). Unify input styling app-wide (see login item).
- **P2 — `slugPreview` uses `colors.gold` for text (`mystores.tsx:283`).** Gold (`#E8A020`) as a text color on cream fails contrast for small text and is used nowhere else as body text — every other "accent text" in the app uses `goldDark` (`#8B5E00`), e.g. credits `packPerPiece`, profile `buyBtnText`. Change `slugPreview` color to `colors.goldDark`.
- **P2 — Modal button re-declares instead of fully using token.** `button: { ...btn.primary, marginBottom: 12 }` (`mystores.tsx:284`) is correct, but `buttonText: { ...btn.primaryText }` (286) and `buttonDisabled` (285) are spread one-liners that exist only because the JSX references `styles.button`/`styles.buttonText`. Could reference `btn.primary` / `btn.primaryText` directly in JSX and drop the local aliases — same pattern repeats in 4 files and adds noise.
- **P3 — `addBtn` is a shrunk primary** (`...btn.primary, paddingVertical: 9, paddingHorizontal: 16`, `mystores.tsx:218`) — same "small primary" pattern flagged on Discover. Another vote for a `btn.primarySm` token.
- **P3 — Header `paddingTop: 56` (`mystores.tsx:213`)** is the app's de-facto top inset, repeated as a literal in discover (280), gallery (348), create content (549), and the skeletons. This should be a `layout.screenTop` token; it's currently copy-pasted into ~7 files and any safe-area adjustment requires editing all of them.

---

## `app/app/(tabs)/profile.tsx` — account & collection

**What's working:** Clean sectioned-card layout with `type.label` section headers; the collection stat block (galleries / worlds, `profile.tsx:251-297`) is a nice touch; destructive actions (sign out, delete) are appropriately de-emphasized with the loudness in the Alert chain. The `—` placeholder for stats-while-loading (`profile.tsx:258,263`) avoids reflow.

- **P1 — Input style diverges from the rest of the app.** `profile.tsx:432`: the name input is `borderBottomWidth: 1` only (underline style), whereas every other text input (login, create, mystores, comments) is a full bordered box at `radius.md` / borderWidth 1.5. Inside a `card`, the underline input looks like an unstyled afterthought. Either make it a proper bordered input or lean into a consistent "inline editable row" pattern — but don't have one screen use a Material-style underline when nothing else does.
- **P2 — `creditsValue` is `colors.gold` (`profile.tsx:428`)** — same gold-as-text contrast issue as mystores `slugPreview`. The credits number is important and should be high-contrast; use `goldDark` (matches the `balancePillText` and `buyBtnText` already on this same screen, creating an internal inconsistency: the credit *count* is `gold` but the *Buy credits* label right below it is `goldDark`).
- **P2 — Section padding inconsistency within one screen.** `identityHeader` is `paddingHorizontal: 24` (`profile.tsx:406`) but every `section` is `paddingHorizontal: 20` (`profile.tsx:410`). The identity name therefore hangs 4px further left than every card below it — a visible misalignment on the most-scrutinized vertical edge. Unify to one value (20 to match the cards).
- **P2 — `buyBtn` inside the Credits card (`profile.tsx:429`) uses `radius.sm` and a gold-light fill**, but it's a CTA — every other CTA is a pill. It reads as a "tag" more than a button. Either make it the standard pill primary, or accept it's a secondary affordance and ensure the visual weight matches its intent (right now it competes with the "Buy credits" row pattern in an odd middle ground).
- **P3 — Mixed casing for section headers.** Section labels are hardcoded uppercase strings (`'YOUR COLLECTION'`, `'CREDITS'`, `'YOUR NAME'`, `'READ ALOUD VOICE'`, `'APP'`) AND `type.label` already applies `letterSpacing: 0.5` but NOT `textTransform: 'uppercase'`. So the uppercasing is done by hand in the string. mystores does it correctly via `textTransform: 'uppercase'` on the style (`mystores.tsx:281`). Pick one mechanism; manual uppercase strings are error-prone (one lowercase slips through and it's inconsistent).
- **P3 — `rowValue` for "Support" shows `hello@drawup.ink` as static text (`profile.tsx:355`)** while Privacy/Terms rows are tappable with chevrons. A support email a user can't tap to compose is a small dead end; make it a `mailto:` TouchableOpacity to match the row pattern directly below it.

---

## `app/app/(tabs)/_layout.tsx` — tab bar

**What's working:** Correct per spec — white bar, gold active tint, muted inactive, outline→filled icon swap (`_layout.tsx:7-11`) is a tasteful warm touch. Label type matches the system. Nothing structurally wrong.

- **P3 — Inactive tint is `colors.muted` (`#A89880`).** Against a white tab bar this is on the low side for contrast on the inactive labels (11px text, `_layout.tsx:24`). Consider `colors.mid` (`#6B5E4E`) for inactive icons/labels to improve legibility while keeping gold as the clear active signal. Minor, but it's the persistent bottom chrome on every screen.
- **P3 — No explicit `tabBarStyle` height / safe-area handling shown.** Relies on defaults. Fine on most devices; worth a one-line verification that the bar respects the home-indicator inset on notched devices (not visible from this file alone). Not a defect, just untested-from-here.

---

## `app/app/gallery/[slug].tsx` — the shared link destination

**What's working:** This is where a grandparent lands from WhatsApp — and it's solid: avatar + gallery name + world/follower count header (`[slug].tsx:236-252`), owner vs visitor empty-state branching (`[slug].tsx:280-298`), follower-count loading placeholder to prevent reflow, and a real skeleton. Good warmth in copy ("dreaming up their first world").

- **P1 — Three header action buttons compete and can overflow.** The header row (`[slug].tsx:197-228`) renders, for an owner with pieces: "Save all" + "Follow/Following" + "Share" — three pill buttons in a row alongside the back button. At `gap: 8` (`[slug].tsx:352`) with the "Saving 3/5…" progress text expanding the first button, this row is at real risk of crowding/wrapping on smaller devices (SE width). The Save-all is owner-only utility; consider moving it into an overflow menu or below the header so the primary actions (Follow = retention, Share = acquisition) have room. Both kill-metric actions deserve breathing room.
- **P2 — `voteBadge` raw `rgba(0,0,0,0.45)` literal again (`[slug].tsx:373`)** — identical to discover. Same `colors.scrim` token fix covers both.
- **P2 — Card title `...type.h3, fontSize: 13` (`[slug].tsx:376`)** with no child name (correct — it's the child's own gallery) — but the title alone at 13px on a 2-up grid is thin. Same `type.cardTitle` token candidate as Discover. Note the gallery card has *no* secondary line, so the card body is just a single cramped 13px title; a touch more padding or a 14px title would give the grid more presence.
- **P2 — `avatar` borderRadius 20 (`[slug].tsx:362`) vs `galleryAvatar` 14 on piece detail (`piece/[id].tsx:662`) vs `initialBadge` 12 on mystores (`mystores.tsx:224`).** The "child initial in a gold circle" is a recurring brand element rendered at 3+ different radii/sizes (64/20, 28/14, 24/12). Standardize the avatar component (one component, size prop) so the child's identity mark is consistent across Discover→Gallery→Piece.
- **P3 — `pieceCount` em-dash placeholder reads `' · … following'` (`[slug].tsx:247`)** — the leading ` · ` is rendered even while loading, so a brand-new gallery with 0 followers briefly shows "1 world · … following" then collapses to "1 world". Minor reflow still exists (the ` · … following` disappears entirely when count resolves to 0). Acceptable, but the placeholder doesn't fully achieve its stated no-reflow goal.
- **P3 — Delete-gallery "danger zone" is an underlined muted text link in the list footer (`[slug].tsx:299-312`, style 385-386).** Consistent with piece-detail's delete pattern — good. Just confirm it's far enough below the grid that a fast scroll-to-bottom can't fat-finger it; currently `paddingTop: 24` (`[slug].tsx:385`) which is reasonable.

---

## `app/app/piece/[id].tsx` — the emotional peak (description + read-aloud)

**What's working:** The richest screen, and mostly well-built: big image → bold title → gallery chip + vote chip meta row (`piece/[id].tsx:354-389`), the AI description block with owner-gated Read Aloud (`piece/[id].tsx:391-398`), threaded comments with "You" pill + own-comment tint (`piece/[id].tsx:450-503`), lightbox with zoom, and cover/move/delete owner tools. Comments skeleton + empty state are warm.

- **P1 — Title block has no `type` token and re-declares h1-ish values.** `piece/[id].tsx:659`: `title: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5, ... }`. This is `type.h1` minus 4px and with looser letter-spacing (-0.5 vs -1). The piece title is *the* heading on the most emotional screen; it should derive from `type.h1` (or a named `type.pieceTitle`) so heading scale stays consistent with profile's identity name (28/900/-0.8) and create's success "Published!" (`type.h1` = 32). Right now there are at least four different "big bold heading" specs (32/-1, 28/-0.5, 28/-0.8, 26/900) across screens with no shared source.
- **P1 — Vote chip uses `goldDark` icon always, even when not voted (`piece/[id].tsx:381`).** The heart icon `color={colors.goldDark}` is hardcoded regardless of `hasVoted`, so an un-voted heart-outline is already gold — it looks pre-selected/active before the user taps. The affordance to vote is muddied: nothing visually changes the *icon* on vote (only chip opacity drops to 0.55 via `voteChipDone`). For the core delight tap, the un-voted state should read as "tap me" (e.g. muted/dark outline) and the voted state as filled gold. Currently it's gold→faded-gold, which is backwards-feeling (faded = done).
- **P2 — Comment input spreads `card` then fights it.** `commentInput: { padding: 12, ..., minHeight: 80, textAlignVertical: 'top' }` applied to a `[card, styles.commentInput]` (`piece/[id].tsx:407,677`). `card` brings borderWidth 1 / radius.md, which is fine, but this is yet another input construction distinct from the bordered-box inputs elsewhere. Consolidate with the app-wide input style.
- **P2 — `editLink` actions ("Make this the gallery cover", "Move to another gallery") and `dangerZone` ("Delete this piece") are all near-identical muted underlined links** (`piece/[id].tsx:649-650, 655-656`). Three stacked underlined gray links at the bottom of the piece read as a flat list with no hierarchy — the destructive delete looks the same as the benign "set cover." Give delete a subtly distinct treatment (e.g. `colors.danger` text, still quiet) so the irreversible action is at least color-differentiated from the reversible ones. (The Alert confirms, but visual differentiation is cheap insurance.)
- **P2 — Lightbox close button uses raw `'rgba(255,255,255,0.15)'` (`piece/[id].tsx:674`) and backdrop `'rgba(0,0,0,0.95)'` (672).** Two more un-tokenized overlay colors. Roll into the `colors.scrim` / add `colors.scrimStrong` family.
- **P3 — Dead styles.** `galleryChipArrow` (`piece/[id].tsx:665`), `reportLabel` (702), `deleteBtn`/`deleteBtnText` (703-704) are defined but unreferenced (JSX uses `actionLabel` for report, inline chevron for the arrow). Remove.
- **P3 — Indentation in source is irregular (`piece/[id].tsx:62-309` uses 4-space inside a 2-space file).** Cosmetic/source-only, but this file's hooks block is double-indented relative to the rest, which will fight any formatter. Worth a Prettier pass.
- **P3 — `actionLabel` for Reply/Report is `type.label` 11px uppercase (`piece/[id].tsx:690`).** Tiny uppercase tappable text is a small touch target and low-affordance for "Reply," which you actively want people doing (engagement). Consider non-uppercase, slightly larger, for the Reply action specifically.

---

## `app/app/credits.tsx` — the revenue surface

**What's working:** The best-converting screen in the app, design-wise: balance pill, clear "Each credit turns one drawing into a world" framing (`credits.tsx:67-69`), three packs with a featured "Most popular" tier that's visually elevated (`credits.tsx:173-183`), per-drawing unit pricing, and trust copy ("Credits never expire. Refunded automatically if a transform fails," `credits.tsx:83-85`). This is strong.

- **P2 — Header title is `fontSize: 17` (`credits.tsx:147`)** — a modal header, but at 17px/800 it's smaller than `type.h3` (18) and far from the screen-title scale used elsewhere. For a purchase screen, "Keep the magic going" could carry more weight; at minimum it's another bespoke heading size (17/800/-0.4) adding to the heading-scale sprawl. Consider `type.h3` or a dedicated modal-title token shared with the create/mystores modals (which use 26/900 — yet another value).
- **P2 — `buyBtnFaded` uses raw `opacity: 0.4` (`credits.tsx:201`)** instead of `opacity.disabled` (0.5) from the token. CLAUDE.md / theme.ts explicitly consolidated disabled opacity to 0.5 ("Was split 0.4/0.5 across 6 files," `theme.ts:12-13`). This is a 0.4 straggler — exactly the case the token was created to eliminate. Use `opacity.disabled`.
- **P2 — Pack card radius inconsistency on the featured tier.** Regular packs use `...card` (radius.md), featured uses `...card` + `borderWidth: 1.5` + shadow (`credits.tsx:168-183`) — good elevation — but the featured card keeps radius.md while gaining a prominent shadow; the success card and onboarding sheet use radius.xl for "elevated" surfaces. Minor, but the "this is the premium option" card could read more premium at a larger radius to match the app's other hero surfaces.
- **P3 — `packDot` is a `·` rendered as its own `<Text>` (`credits.tsx:112,197`).** Fine, but the same dot-separator pattern is hand-built differently in `[slug].tsx` pieceCount (inline ` · ` in a string) and gallery follower count. Trivial, but a tiny `<Dot />` or consistent inline approach would dedupe.
- **P3 — No loading skeleton / the screen renders instantly with `…` balance.** Acceptable (it's a short fetch), and the `…` placeholder (`credits.tsx:63`) prevents a flash. No action; noting completeness.

---

## `app/components/ShareSheet.tsx` — the acquisition surface

**What's working:** Clean bottom-sheet with three clear actions (native / WhatsApp / copy), grab handle, OG-card pre-warm on open (`ShareSheet.tsx:41-49`), and proper per-channel analytics. WhatsApp uses brand green (`#25D366`). This is the most important component for the viral loop and it's tidy.

- **P1 — Hardcoded radii instead of tokens, in the one component where consistency with the system matters most.** `ShareSheet.tsx:133-134` uses `borderTopLeftRadius: 24 / borderTopRightRadius: 24` (should be `radius.xl`), `actionIcon` `borderRadius: 18` (135 → `radius.lg` is 20; 18 is off-scale entirely), `cancelBtn` `borderRadius: 14` (189 → `radius.md`). The sheet visually compares directly against OnboardingSheet (which correctly uses `radius.xl`), so side-by-side the two bottom sheets have subtly different corner radii. Tokenize all three.
- **P2 — `import { colors } from '../lib/theme'` only — no `type`, `radius`.** Every text style in the sheet is bespoke (`title` 17/800, `url` 12/muted, `actionLabel` 12/600). None map to `type`. The sheet title (`ShareSheet.tsx:146-153`) is yet another 17/800/-0.3 heading — same value as credits header, defined independently. Pull from `type`.
- **P2 — `#25D366` WhatsApp green is a raw hex (`ShareSheet.tsx:105`).** Defensible (it's a brand color, not a theme color), but it's the kind of raw hex that CLAUDE.md's "never use raw hex" rule targets. Add `colors.whatsapp = '#25D366'` so the rule holds literally and the brand green is reusable (create.tsx's WhatsApp footnote could use it too).
- **P2 — `Clipboard` imported from `react-native` (`ShareSheet.tsx:2`) is deprecated.** Not a design issue per se, but it'll warn/break; `expo-clipboard` is the supported path. Flagging since it sits in the acquisition-critical component.
- **P3 — Three actions are centered with `gap: 24` (`ShareSheet.tsx:160-165`)** which on a wide screen leaves them clustered in the middle. `justifyContent: 'space-around'` would feel more balanced edge-to-edge, matching iOS share-sheet conventions grandparents expect.

---

## `app/components/OnboardingSheet.tsx` — first-run

**What's working:** This is the most token-disciplined file in the set — uses `type.h1`, `type.body`, `btn.primary`, `radius.xl`, gold-bubble icons. Three benefit rows with numbered/icon bullets (`OnboardingSheet.tsx:46-74`) are clear and warm. It's a good template for what the other screens should look like after refactor.

- **P2 — Backdrop is not dismissible by tap.** The `<Pressable style={styles.backdrop}>` (`OnboardingSheet.tsx:31`) has no `onPress`, so tapping the dimmed area does nothing — the user must hit "Let's start" or "I'll look around first." Minor friction; iOS users expect tap-outside-to-dismiss on a bottom sheet. Wire backdrop press to `onDismiss` (it's already a Pressable, just missing the handler) — and consider whether a first-run sheet *should* be that easily dismissed (arguably the explicit skip is intentional; if so, leave it but the dead Pressable is confusing).
- **P3 — `iconBubble` radius 24 / `bullet` radius 14 (`OnboardingSheet.tsx:102,111`)** map to `radius.xl`/`radius.md` — good — but they're written as literals (24, 14) not the tokens, despite the file importing `radius` and using it for the sheet corners. Inconsistent even within the one well-behaved file. Swap the literals for `radius.xl`/`radius.md`.
- **P3 — `lede` (`OnboardingSheet.tsx:108`) and credits `subhead` and login `tagline`** are three near-identical "centered muted intro paragraph" styles. Strongest argument yet for a `type.lede` token (15/mid/center/lineHeight 22).

---

## `app/components/Skeleton.tsx` — loading states

**What's working:** A clean, reusable shimmer primitive (`Skeleton.tsx:14-33`) composed into screen-shaped skeletons for Discover, Gallery, Piece, Comments. Uses `colors.creamDark` for the shimmer — warm and on-brand. This is exactly the right pattern; the gap is that not every screen uses it (see mystores P1).

- **P2 — Skeleton card uses `width: '48%'` (`Skeleton.tsx:137`) but the real Discover/Gallery cards use `flex: 1` with `gap: 10` in a `columnWrapperStyle`.** `48%` of the row width + the parent `gap: 10` won't perfectly match the `flex: 1` two-column layout (48%+48%=96%, leaving 4% that the gap then adds to — so skeleton columns are slightly narrower than real cards). The skeleton→content transition will visibly nudge card widths. Match the skeleton grid to `flex: 1` + identical gap so there's zero shift on load.
- **P2 — Default `borderRadius = 8` (`Skeleton.tsx:14`) is off the radius scale** (sm=10 is the nearest). Most call sites override it (to 100, 6, 10, 0), but the 8 default and the various `borderRadius={6}` / `borderRadius={4}` (e.g. comment skeleton lines, `Skeleton.tsx:119-123`) are off-token magic numbers. Pull defaults from `radius` (e.g. default to `radius.sm`).
- **P3 — Skeleton card image height is a fixed `170` (`Skeleton.tsx:51,78,96 uses 170/360`)** while real cards use `aspectRatio: 1`. On a 2-up grid the real image is `(screenWidth/2 - padding)` tall, which won't equal 170 on most devices — another source of load-time shift. Use aspectRatio in the skeleton too.
- **P3 — `PieceSkeleton` main image is `height={360}` (`Skeleton.tsx:96`) but the real piece image is `aspectRatio: 1`** (`piece/[id].tsx:657`, i.e. full-width square ≈ screen width, ~390+). The skeleton is shorter than the real image, so the title/meta below jump up then down. Same aspectRatio fix.

---

## `app/components/VoicePicker.tsx` — profile sub-component

**What's working:** Well-structured list with per-voice play/stop preview, on-demand sample caching, active-voice gold check (`VoicePicker.tsx:122-165`). Token usage is decent (`colors`, `radius` imported and `goldLight`/`goldMid`/`gold` used consistently for the gold accent system). Loading and playing states are handled per-row.

- **P2 — `previewBtn` (32×32, radius 16) and `checkBubble` (22×22, radius 11) use literal radii (`VoicePicker.tsx:182,189`)** = perfect circles by `size/2`, which is fine for circles but should be `borderRadius: 16`/`11` documented as "circle" or use a `radius.full`/`9999` convention. Minor; the broader point is these circular-control sizes (32, 22) and the check-bubble pattern also appear in mystores `initialBadge` (24/12) and the gold avatars — another vote for a shared circular-badge/avatar component.
- **P2 — `import { Audio } from 'expo-av'` (`VoicePicker.tsx:12`) is deprecated** in recent Expo SDKs (superseded by `expo-audio`). Not a design issue, but it will emit deprecation warnings and is a latent break. Flag for the maintainer (out of design scope, but noticed while reading).
- **P3 — Row active state is `goldLight` background (`VoicePicker.tsx:177`)**, matching the comment-mine tint, dropdown-active, and pack-featured — good, consistent gold-selected language. No change; calling out the one place the gold-selected pattern is applied correctly and consistently as the reference for the others.
- **P3 — `name` 15/700 and `desc` 12/mid (`VoicePicker.tsx:179-180`)** are a clean row-item type pair that recurs (profile rows, mystores meta). Candidate for `type.rowTitle` / `type.rowSub` (onboarding already hand-rolls the same 15/800 + 13/mid pair at `OnboardingSheet.tsx:118-119`).

---

## Cross-cutting themes (the patterns behind the per-screen items)

1. **Token under-adoption.** The system exists; screens written before it inline the same values. ShareSheet, login, create, piece-detail all redeclare radii/type/buttons that `theme.ts` already provides. ~half the audit collapses if these spread `type.*` / `btn.*` / `radius.*`.
2. **No spacing or layout tokens.** `paddingTop: 56` (screen top) and freehand paddings (20/24/28) are copy-pasted into ~8 files. A `space` + `layout.screenTop` token set would unify alignment and make safe-area changes one-line.
3. **Raw overlay/scrim hexes.** `rgba(0,0,0,0.45)` (×2 vote badges), `rgba(0,0,0,0.95)`, `rgba(255,255,255,0.15)`, `rgba(0,0,0,0.2/0.25/0.4/0.5)` (dropdowns, sheets) are all un-tokenized. A `colors.scrim*` family fixes a class of "almost the same black" drift.
4. **The gold-bordered light card is an un-extracted component.** `goldLight` bg + `goldMid` border + `radius.md` appears 5+ times (create description box, create inline-store, mystores upsell, credits balance/featured, onboarding bubbles). Extract once.
5. **Heading scale sprawl.** At least five "big bold heading" specs (32/-1, 28/-0.5, 28/-0.8, 26/900, 17/800) live independently. Everything should ladder from `type.h1/h2/h3` or named additions.
6. **Loading-state fidelity is uneven.** Discover/Gallery/Piece have shimmer skeletons; My Galleries and the transform wait (the two highest-stakes waits) have bare spinners. And the skeletons that exist don't dimensionally match their real layouts, causing load-time shift.
7. **Avatar/initial mark rendered at 3+ sizes/radii.** The child's identity circle should be one component.

---

## Top 10 highest-impact fixes

Ranked by user-visible impact × effort, weighted toward the create→share→convert path and the surfaces a visitor/grandparent judges. Items 1–4 are flow-critical or trust-affecting; 5–10 are consistency wins that compound.

1. **Discover card hierarchy + child-name prominence** (`discover.tsx:345-346`). The child's name is the emotional payload and is currently the faintest text on the most-judged screen. Make child name ≥ title weight, `colors.mid` not `muted`. *(P1 — first impression for every visitor; decision-filter: drives sharing/voting.)*
2. **Vote affordance is backwards on piece detail** (`piece/[id].tsx:381,667`). Un-voted heart is already gold (looks done); voted state just fades. Make un-voted read "tap me," voted read filled/active. *(P1 — the core one-tap delight action across Discover + Piece.)*
3. **Add `MyStoresSkeleton`; replace the bare spinner** (`mystores.tsx:89`). Primary tab using a lower-fidelity loader than its neighbors. *(P1 — consistency on a core tab; the skeleton primitive already exists.)*
4. **Fix skeleton dimensions to eliminate load-time layout shift** (`Skeleton.tsx:51,78,96,137`). Cards at `48%` vs real `flex:1`; image heights fixed (170/360) vs real `aspectRatio:1`. Content visibly jumps on every load. *(P1 — perceived quality on all three skeletoned screens.)*
5. **Extract the gold-bordered light card** (create description box `create.tsx:343`, inline-store `642`, mystores upsell `230`, credits `balancePill`/featured, onboarding). One `goldCard` token/component kills the app's most-duplicated visual unit. *(P1/P2 — touches 5 screens.)*
6. **Tokenize ShareSheet radii + type** (`ShareSheet.tsx:133-134,170,189,146-153`). The acquisition-critical sheet uses raw `24/18/14` and bespoke type, visibly mismatching OnboardingSheet beside it. *(P1 on the viral surface.)*
7. **Delete dead styles in create.tsx and piece/[id].tsx** (`create.tsx:579-701` ~12 orphans incl. the entire success-screen style block; `piece/[id].tsx:665,702-704`). Real maintenance hazard — editing them changes nothing. *(P1/P2 — code health on the two biggest files.)*
8. **Fix off-token opacity and gold-as-text contrast.** `credits.tsx:201` `opacity: 0.4`→`opacity.disabled`; `profile.tsx:428` `creditsValue` and `mystores.tsx:283` `slugPreview` `gold`→`goldDark`. Small, exactly the drift the tokens were created to prevent. *(P2 — quick, high-consistency.)*
9. **Reconcile the "The drawing / The world" compare labels** (`create.tsx:465,469`). CLAUDE.md lists these as explicitly removed; they're still rendering. Either the removal regressed or the doc is stale — resolve. *(P2 — documented decision vs reality mismatch.)*
10. **Introduce `space` + `layout.screenTop` tokens and a `colors.scrim*` family**, then sweep the worst offenders (`paddingTop: 56` ×8 files; `rgba(0,0,0,*)` overlays). The structural fix that makes future consistency cheap. *(P2 — foundational; unblocks dozens of minor alignment items.)*

---

*Scope note: per the audit brief, no code was changed — this document is the only deliverable. Items tagged for CLAUDE.md (palette table staleness, compare-label reconciliation) are flagged for the file's owner since this audit does not edit CLAUDE.md or app code.*
