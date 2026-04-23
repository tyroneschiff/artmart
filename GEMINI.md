## Strategic Backlog

1. **[NOTIFICATIONS] Push Token Collection (DB)**
    *   **The Micro-Task:** Create migration `supabase/migrations/009_push_tokens.sql` to add a nullable `expo_push_token` (text) column to the `profiles` table.
    *   **Why:** Foundation for the retention loop; we can't notify parents about votes/comments without a token.

2. **[NOTIFICATIONS] Push Token Collection (App)**
    *   **The Micro-Task:** In `app/app/_layout.tsx`, use `expo-notifications` to request permission and `upsert` the token to the user's profile if authenticated.
    *   **Why:** Enables the most important emotional retention loop: notifying parents when someone loves their child's art.

3. **[DESIGN] Theme Token Adoption - Profile**
    *   **The Micro-Task:** Refactor `app/app/(tabs)/profile.tsx` to replace `styles.header`, `styles.sectionLabel`, and `styles.buyBtn` with `type.h1`, `type.label`, and `btn.primary` tokens.
    *   **Why:** Ensures the most "functional" screen in the app still feels premium and aligned with the brand's warmth.

4. **[REVENUE] High-Value Gift Message**
    *   **The Micro-Task:** Polish `app/components/GiftingModal.tsx` by adding a live character counter (300 limit) and a "Gift Card Preview" that updates as they type.
    *   **Why:** Increases the perceived value of the gifting service, making it feel more like a premium concierge gift.

5. **[DESIGN] Theme Token Adoption - Create**
    *   **The Micro-Task:** Refactor `app/app/(tabs)/create.tsx` to replace manual `header`, `bigBtn`, and `button` styles with theme tokens.
    *   **Why:** Removes design debt in the most critical conversion screen and ensures visual consistency.

6. **[UX] Post-Publish Viral Loop**
    *   **The Micro-Task:** In `app/app/(tabs)/create.tsx` (success state), add a prominent "Send to Grandma" WhatsApp shortcut button with a custom pre-filled message.
    *   **Why:** Leverages the parent's high-emotion state immediately after creation to drive organic traffic back to the child's store.

## Done

- **[REVENUE] "View in Room" Visualization** — Implemented `RoomPreviewModal` with a warm living room background and dynamic artwork overlay. Added "View in Room" CTA to the Piece Detail screen. This helps buyers (especially grandparents) visualize the physical product in their home, driving print conversion.
- **[POLISH] Success UI Celebration** — Installed `react-native-confetti-cannon` and triggered it on successful publishing in `create.tsx`. Amplifies the "wow" moment for creators.

## Improvement Log

- [2026-04-23 — CRON B] "View in Room" Visualization — Implemented a premium room visualization feature. Users can now see their child's artwork in a realistic living room setting directly from the piece detail screen. Uses theme tokens and a high-quality background to maintain the "Step Inside" brand warmth.
- [2026-04-23 — STRATEGIC AUDIT (CRON A)] Shifted focus to visualization as the primary revenue lever. Identified "View in Room" as the #1 priority to convert the grandparent buyer segment. Prioritized Push Notification infrastructure to close the emotional loop between buyers and creators. Refined design debt tasks to be more surgical, targeting Profile and Create screens for theme token compliance.
- [2026-04-23 — CRON B] Success UI Celebration (Polish) — Integrated `react-native-confetti-cannon` into the creation flow. Users are now greeted with a burst of celebration upon publishing, reinforcing the emotional reward of creating.
- [2026-04-23 — STRATEGIC AUDIT (CRON A)] Performed 360-degree audit. Identified "View in Room" as the next major lever for print conversion, helping buyers bridge the gap between digital magic and physical product. Pivoted creation flow focus to include a proactive "Thank my family" viral loop. Maintained high priority for Success Confetti and Design System alignment to ensure a premium feel throughout.
- [2026-04-23 — CRON B] Gifting UI for All (Friction) — Enabled the gifting modal for authenticated digital purchases. Users can now easily send digital gifts to family members with a custom message directly from the piece screen.
- [2026-04-23 — CRON B] Digital Gifting Delivery (Backend) — Updated `stripe-webhook/index.ts` to support digital gifting. Recipient now receives a branded gift email with a high-res signed download URL. 
- [2026-04-23 — CRON B] Transform Tips (Conversion) — Implemented cycling tips during the 30-second transformation wait in `create.tsx`. This reduces perceived wait time and reinforces the "magic" of the AI process.
- [2026-04-23 — STRATEGIC AUDIT (CRON A)] Performed 360-degree audit. Identified "Digital Gifting" as a major missed revenue opportunity for authenticated users. Prioritized backend delivery for digital gifts and UI flexibility to allow gifting for all. Maintained focus on "Transform Tips" and "Success Confetti" as high-impact UX magic items.
- [2026-04-23 — CRON B] Low Credits Upsell (Contextual) — Added a conditional "Buy Credits" banner in `mystores.tsx` that appears only for new users (0 credits, 0 stores). Uses `danger` tokens for visibility and directs to the credit purchase screen.
- [2026-04-23 — CRON B] Instagram Stories Export — Implemented `app/lib/export.ts` using `expo-image-manipulator` to generate 9:16 branded cards. Integrated "Story" export into Create Success screen and global ShareSheet. This enables high-fidelity social acquisition.
- [2026-04-23 CR B] Buyer Gifting Receipts — Updated `stripe-webhook` to send confirmation emails to buyers for both print and digital orders. Integrated `auth.admin.getUserById` to fetch emails for authenticated buyers. Essential for trust and closing the post-purchase loop.
- [2026-04-23 — CRON B] Pack Variations — Implemented "Taste Pack" ($2.99/3 credits) and updated UI/Backend to handle multiple credit tiers. Lowers barrier to entry for new creators.
- [2026-04-23 — STRATEGIC AUDIT (CRON A)] Performed 360-degree audit focused on organic growth and design debt. Identified OG Tag URL routing as the highest impact lever for acquisition. Refined creation flow "Success" state to prioritize immediate sharing over automatic ShareSheets. Prioritized design system adoption for Piece Detail and Profile screens to ensure a premium family gifting feel.
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
