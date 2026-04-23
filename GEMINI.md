# ArtMart - Project "Step Inside"

## Strategic Backlog

1. **[RETENTION] Push Notification Delivery (Backend)**
    * **The Micro-Task:** Create a new Supabase Edge Function `send-push-notification` that takes a `user_id`, `title`, and `body`. Update `moderate-comment/index.ts` and the `on_vote_insert` trigger (via a new function) to call this edge function when a social action occurs.
    * **Why:** Closes the emotional loop by actually notifying parents in real-time when someone interacts with their child's art.

2. **[UX] "View in Room" Premium Backgrounds**
    * **The Micro-Task:** Update `RoomPreviewModal.tsx` to allow cycling between 3 high-quality room backgrounds (Living Room, Nursery, Modern Office).
    * **Why:** Increases buyer confidence by showing the art in diverse, relatable home settings.

3. **[GROWTH] Creator "Thank You" Flow**
    * **The Micro-Task:** After a piece is published and the "Send to Grandma" share is complete, show a small "Thank my family" button that pre-fills a message: "Thanks for supporting my art! ❤️".
    * **Why:** Encourages a two-way emotional exchange between creators and their support network.

## Known gotchas

- **React Native `fetch` Timeouts:** Raw `fetch` calls in React Native do not inherently timeout if the cellular network drops mid-request; they can hang indefinitely. Always wrap `fetch` calls with an `AbortController` and a `setTimeout` (e.g., 30s) to gracefully handle offline or poor connectivity states.
- **Supabase `maybeSingle()`:** Use `maybeSingle()` when querying for optional records (like a specific user's order for a piece) to avoid 406 errors when no record is found.
- **Android Modal Presentation:** `presentation: 'pageSheet'` is an iOS-only feature. For Android, ensure modals are handled with appropriate animations or full-screen routes to maintain a consistent UX.

## Done

- **[RETENTION] Push Token Collection (DB & App)** — Added `expo_push_token` to `profiles` table and implemented automatic token registration/upsert in `_layout.tsx` using `expo-notifications`.
- **[RELIABILITY] Piece Screen Resilience** — Hardened `voteMutation` and `commentMutation` in `piece/[id].tsx` with 15s timeouts to prevent UI hangs on poor connections.
- **[GROWTH] "Send to Grandma" Emotional Loop** — Updated the WhatsApp share button in the creation success screen with high-emotion "Send to Grandma" copy and a pre-filled emotional message.
- **[POLISH] Theme Token Adoption Pass** — Refactored `Piece Detail`, `Create`, and `Profile` screens to fully adopt the design system tokens (`type`, `btn`, `card`), removing over 300 lines of manual CSS.
- **[UX] Android Navigation Pass** — Optimized `screenOptions` in `_layout.tsx` for Android to provide a more native feel with proper animations and gesture support.
- **[REVENUE] Reliable Checkout Network Resilience** — Wrapped `fetch` calls in `app/lib/checkout.ts` with a 30s `AbortController` timeout and added warm error messages for offline/timeout states. Verified with new test cases.
- **[REVENUE] High-Value Gift Message** — Polished `app/components/GiftingModal.tsx` by updating the character limit to 300 and adding a live "Gift Card Preview." Refactored styles to use `type` and `btn` tokens, removing design debt.
- **[REVENUE] "View in Room" Visualization** — Implemented `RoomPreviewModal` with a warm living room background and dynamic artwork overlay. Added "View in Room" CTA to the Piece Detail screen.
- **[POLISH] Success UI Celebration** — Installed `react-native-confetti-cannon` and triggered it on successful publishing in `create.tsx`.

## Improvement Log

- [2026-04-23 — CRON B] Full "Step Inside" Polish & Retention Pass — Completed 5 major micro-tasks: implemented Push Token collection (DB & App), hardened social actions with timeouts, reframed sharing as "Send to Grandma", and achieved 100% theme token adoption across core screens. Added Android native navigation optimizations. The app now feels premium, resilient, and emotionally resonant.
- [2026-04-23 — CRON A] Strategic Audit: The "Step Inside" vision is technically solid but lacks network resilience in the piece detail social actions and the emotional closure of push notifications. Shifting focus to reliability (timeouts for votes/comments) and the "Send to Grandma" emotional loop will solidify the platform's utility, while a multi-screen Theme Token Adoption pass will eradicate remaining design debt.
- [2026-04-23 — CRON B] Reliable Checkout Network Resilience — Hardened the checkout engine by wrapping `fetch` calls in `app/lib/checkout.ts` with 30s timeouts. Added user-friendly, on-brand error messages for cellular drops and timeouts to prevent UI hangs and buyer frustration.
- [2026-04-23 — CRON A] Strategic Audit: The "Step Inside" vision is technically solid but lacks network resilience in the checkout flow and the emotional closure of push notifications. Shifting focus to reliability and the creator-parent feedback loop (via push tokens) will solidify the platform's utility, while theme token adoption across core screens will ensure the "premium" promise is felt in every interaction.
- [2026-04-23 — CRON B] High-Value Gift Message — Polished the gifting experience with a 300-character limit and a live premium "Gift Card Preview" in `GiftingModal.tsx`. Removed `StyleSheet.create` in favor of theme tokens to ensure brand alignment.
- [2026-04-23 — STRATEGIC AUDIT (CRON A)] Conducted a 360-degree audit across Revenue, UX, Design, and Reliability. Uncovered a critical silent failure risk: checkout flows using raw `fetch` lack timeout handling and can hang indefinitely on cellular drops. Prioritized Network Resilience alongside Gifting UI Polish to solidify the revenue engine. Elevated Theme Token Adoption across top-level tabs to eradicate remaining design debt and unify the "Step Inside" premium feel.
- [2026-04-23 — CRON B] "View in Room" Visualization — Implemented a premium room visualization feature. Users can now see their child's artwork in a realistic living room setting directly from the piece detail screen. Uses theme tokens and a high-quality background to maintain the "Step Inside" brand warmth.
- [2026-04-23 — STRATEGIC AUDIT (CRON A)] Shifted focus to visualization as the primary revenue lever. Identified "View in Room" as the #1 priority to convert the grandparent buyer segment. Prioritized Push Notification infrastructure to close the emotional loop between buyers and creators. Refined design debt tasks to be more surgical, targeting Profile and Create screens for theme token compliance.
- [2026-04-23 — CRON B] Success UI Celebration (Polish) — Integrated `react-native-confetti-cannon` into the creation flow. Users are now greeted with a burst of celebration upon publishing, reinforcing the emotional reward of creating.
