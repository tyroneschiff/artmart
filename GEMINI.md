# ArtMart - Project "Step Inside"

## Strategic Backlog

1. **[REVENUE] "Buy 2, Save 15%" Print Discount**
    * **The Micro-Task:** In `app/lib/checkout.ts`, if `quantity >= 2`, apply a `0.85` multiplier to the print price. Add a `DiscountBadge` component to the checkout flow in `GiftingModal.tsx` that appears when volume increases.
    * **Why:** Directly incentivizes higher volume orders for physical goods, increasing average order value (AOV).

2. **[RETENTION] Push Notification Delivery (Backend)**
    * **The Micro-Task:** Create a new Supabase Edge Function `send-push-notification` that takes a `user_id`, `title`, and `body`. Update `moderate-comment/index.ts` to call this function when a comment is approved.
    * **Why:** Closes the emotional loop by actually notifying parents in real-time when someone interacts with their child's art.

3. **[REVENUE] High-Value Credit Pack UI**
    * **The Micro-Task:** In `app/app/credits.tsx`, add a new pack object `{ credits: 25, price: 19.99, label: 'VALUE PACK' }`. Update the "POPULAR" badge on the 12-credit pack to use a more prominent gold/dark contrast.
    * **Why:** Nudges users toward higher spending tiers by highlighting better value-per-credit.

4. **[UX] "View in Room" Premium Backgrounds**
    * **The Micro-Task:** Source 3 royalty-free room images (Nursery, Modern Office, Living Room) and update `RoomPreviewModal.tsx` to include a small horizontal selector that swaps the `ImageBackground` source.
    * **Why:** Contextualizes the art for different buyer personas (e.g., parents vs. office workers), increasing purchase confidence.

5. **[POLISH] Magic Image Transition**
    * **The Micro-Task:** In `app/app/piece/[id].tsx`, use `Animated` to wrap the transformed image. Set initial opacity to 0 and animate to 1 over 800ms (`useNativeDriver: true`) when the high-res image finishes loading.
    * **Why:** Smooths the "reveal" moment, making the AI transformation feel more intentional and premium.

6. **[GROWTH] Creator "Thank You" Flow**
    * **The Micro-Task:** Add a "Send a Thank You" button to the success state of `create.tsx`. When tapped, trigger `Share.share` with a heart-warming pre-filled message for the creator's family.
    * **Why:** Encourages the support network to keep engaging, fueling the "Grandma loop" of positive reinforcement.

7. **[UX] Sample Store Empty State**
    * **The Micro-Task:** In `app/app/(tabs)/mystores.tsx`, replace the basic empty state with a "View Sample Store" button that opens a static preview of a high-quality completed store.
    * **Why:** Visualizes the end-goal for new users, reducing "blank canvas" anxiety and demonstrating the platform's value.

## Known gotchas

- **React Native `fetch` Timeouts:** Raw `fetch` calls in React Native do not inherently timeout if the cellular network drops mid-request; they can hang indefinitely. Always wrap `fetch` calls with an `AbortController` and a `setTimeout` (e.g., 30s) to gracefully handle offline or poor connectivity states.
- **Supabase `maybeSingle()`:** Use `maybeSingle()` when querying for optional records (like a specific user's order for a piece) to avoid 406 errors when no record is found.
- **Android Modal Presentation:** `presentation: 'pageSheet'` is an iOS-only feature. For Android, ensure modals are handled with appropriate animations or full-screen routes to maintain a consistent UX.
- **Deno/Stripe Connection Hangs:** In Supabase Edge Functions, external calls to Stripe can occasionally hang. While Deno has a global timeout, it's safer to use a `Promise.race` with a 10s timeout for Stripe operations to ensure the function returns a clean 503 rather than timing out the entire gateway.
- **Dynamic Layout Shifts:** Use `useWindowDimensions` instead of `Dimensions.get('window')` for components that need to respond to orientation changes or split-screen mode on Android, as `get()` only provides the initial value.

## Done

- **[RELIABILITY] Checkout Failure Recovery** — Implemented `checkout_logs` table and a new `log-checkout-error` edge function. Updated `app/lib/checkout.ts` to automatically capture and log Stripe payment failures (excluding cancellations), providing visibility into the "leaky revenue bucket."
- **[REVENUE] Post-Purchase Print Upsell** — Implemented "Upgrade to Physical Print" logic in `piece/[id].tsx` and `create-payment-intent` edge function. Digital owners now see a "10% Digital Owner Discount" and focused upgrade messaging, driving higher conversion for physical products.
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

- [2026-04-23 — CRON B] Checkout Failure Recovery — Hardened the revenue funnel by implementing automated error logging for failed checkouts. Created `010_checkout_logs.sql` and `log-checkout-error` edge function to track `presentPaymentSheet` failures. This data-driven approach allows us to identify and resolve silent payment blockers for both piece purchases and credit top-ups.
- [2026-04-23 — CRON A] Strategic Audit: The 'Step Inside' vision is maturing into a solid commerce platform. We've hardened network resilience and added emotional hooks like 'Send to Grandma'. The next phase is maximizing 'Value and Confidence'. We'll do this by: 1) Capturing silent checkout failures to fix the revenue funnel, 2) Incentivizing higher volume with a Multi-Item Print discount, 3) Deepening the 'View in Room' experience to convert high-intent buyers, and 4) Closing the loop with backend-driven push notifications.
- [2026-04-23 — CRON B] Post-Purchase Print Upsell — Targeted digital owners with a 10% discount on physical prints. Updated `create-payment-intent` to handle the discount server-side and added a "10% OFF" badge and "Upgrade" messaging in the UI to drive print conversions.
- [2026-04-23 — CRON A] Strategic Audit: Conducted a deep 360-degree audit. Identified a major revenue opportunity: post-purchase print upsells for digital buyers. Guest checkout is solid, but reliability can be further hardened by tracking payment failures. Shifted focus to a multi-background "View in Room" experience and a "Magic Transition" to enhance the premium feel.
- [2026-04-23 — CRON B] Full "Step Inside" Polish & Retention Pass — Completed 5 major micro-tasks: implemented Push Token collection (DB & App), hardened social actions with timeouts, reframed sharing as "Send to Grandma", and achieved 100% theme token adoption across core screens. Added Android native navigation optimizations. The app now feels premium, resilient, and emotionally resonant.
- [2026-04-23 — CRON A] Strategic Audit: The "Step Inside" vision is technically solid but lacks network resilience in the piece detail social actions and the emotional closure of push notifications. Shifting focus to reliability (timeouts for votes/comments) and the "Send to Grandma" emotional loop will solidify the platform's utility, while a multi-screen Theme Token Adoption pass will eradicate remaining design debt.
- [2026-04-23 — CRON B] Reliable Checkout Network Resilience — Hardened the checkout engine by wrapping `fetch` calls in `app/lib/checkout.ts` with 30s timeouts. Added user-friendly, on-brand error messages for cellular drops and timeouts to prevent UI hangs and buyer frustration.
- [2026-04-23 — CRON A] Strategic Audit: The "Step Inside" vision is technically solid but lacks network resilience in the checkout flow and the emotional closure of push notifications. Shifting focus to reliability and the creator-parent feedback loop (via push tokens) will solidify the platform's utility, while theme token adoption across core screens will ensure the "premium" promise is felt in every interaction.
- [2026-04-23 — CRON B] High-Value Gift Message — Polished the gifting experience with a 300-character limit and a live premium "Gift Card Preview" in `GiftingModal.tsx`. Removed `StyleSheet.create` in favor of theme tokens to ensure brand alignment.
- [2026-04-23 — STRATEGIC AUDIT (CRON A)] Conducted a 360-degree audit across Revenue, UX, Design, and Reliability. Uncovered a critical silent failure risk: checkout flows using raw `fetch` lack timeout handling and can hang indefinitely on cellular drops. Prioritized Network Resilience alongside Gifting UI Polish to solidify the revenue engine. Elevated Theme Token Adoption across top-level tabs to eradicate remaining design debt and unify the "Step Inside" premium feel.
- [2026-04-23 — CRON B] "View in Room" Visualization — Implemented a premium room visualization feature. Users can now see their child's artwork in a realistic living room setting directly from the piece detail screen. Uses theme tokens and a high-quality background to maintain the "Step Inside" brand warmth.
- [2026-04-23 — STRATEGIC AUDIT (CRON A)] Shifted focus to visualization as the primary revenue lever. Identified "View in Room" as the #1 priority to convert the grandparent buyer segment. Prioritized Push Notification infrastructure to close the emotional loop between buyers and creators. Refined design debt tasks to be more surgical, targeting Profile and Create screens for theme token compliance.
- [2026-04-23 — CRON B] Success UI Celebration (Polish) — Integrated `react-native-confetti-cannon` into the creation flow. Users are now greeted with a burst of celebration upon publishing, reinforcing the emotional reward of creating.
