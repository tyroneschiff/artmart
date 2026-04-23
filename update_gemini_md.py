import re

with open('GEMINI.md', 'r') as f:
    content = f.read()

new_backlog = """## Strategic Backlog

1. **[REVENUE] High-Value Gift Message**
    *   **The Micro-Task:** Polish `app/components/GiftingModal.tsx` by updating the character counter to a 300 limit and adding a live "Gift Card Preview" that updates as they type. Replace `StyleSheet.create` instances with `type` and `btn` tokens.
    *   **Why:** Increases the perceived value of the gifting service, making it feel more like a premium concierge gift for grandparent buyers.

2. **[REVENUE] Reliable Checkout Network Resilience**
    *   **The Micro-Task:** Wrap the `fetch` calls in `app/lib/checkout.ts` with a 30-second `AbortController` timeout and implement user-friendly error boundaries for offline states.
    *   **Why:** Prevents the checkout UI from hanging indefinitely during cellular drops, securing revenue conversions and preventing buyer frustration.

3. **[RETENTION] Push Token Collection (DB)**
    *   **The Micro-Task:** Create migration `supabase/migrations/009_push_tokens.sql` to add a nullable `expo_push_token` (text) column to the `profiles` table.
    *   **Why:** Foundation for the retention loop; we can't notify parents about votes/comments without a token.

4. **[RETENTION] Push Token Collection (App)**
    *   **The Micro-Task:** In `app/app/_layout.tsx`, use `expo-notifications` to request permission and `upsert` the token to the user's profile if authenticated.
    *   **Why:** Enables the most important emotional retention loop: notifying parents when someone loves their child's art.

5. **[GROWTH] Post-Publish Viral Loop**
    *   **The Micro-Task:** In `app/app/(tabs)/create.tsx` (success state), add a prominent "Send to Grandma" WhatsApp shortcut button with a custom pre-filled message.
    *   **Why:** Leverages the parent's high-emotion state immediately after creation to drive organic traffic back to the child's store.

6. **[POLISH] Theme Token Adoption - Create**
    *   **The Micro-Task:** Refactor `app/app/(tabs)/create.tsx` to replace manual `header`, `bigBtn`, and `button` styles with `type` and `btn` theme tokens from `app/lib/theme.ts`.
    *   **Why:** Removes design debt in the most critical conversion screen and ensures visual consistency.

7. **[POLISH] Theme Token Adoption - Profile**
    *   **The Micro-Task:** Refactor `app/app/(tabs)/profile.tsx` to replace `styles.header`, `styles.sectionLabel`, and `styles.buyBtn` with `type.h1`, `type.label`, and `btn.primary` tokens.
    *   **Why:** Ensures the most "functional" screen in the app still feels premium and aligned with the brand's warmth.

8. **[POLISH] Theme Token Adoption - My Stores**
    *   **The Micro-Task:** Refactor `app/app/(tabs)/mystores.tsx` empty states and buttons to utilize `type` and `btn` theme tokens instead of `StyleSheet.create`.
    *   **Why:** Eradicates the last remnants of raw styles in top-level tabs to solidify our "Step Inside" premium design system.

## Known gotchas

- **React Native `fetch` Timeouts:** Raw `fetch` calls in React Native do not inherently timeout if the cellular network drops mid-request; they can hang indefinitely. Always wrap `fetch` calls with an `AbortController` and a `setTimeout` (e.g., 30s) to gracefully handle offline or poor connectivity states.
"""

new_improvement_log_entry = """- [2026-04-23 — STRATEGIC AUDIT (CRON A)] Conducted a 360-degree audit across Revenue, UX, Design, and Reliability. Uncovered a critical silent failure risk: checkout flows using raw `fetch` lack timeout handling and can hang indefinitely on cellular drops. Prioritized Network Resilience alongside Gifting UI Polish to solidify the revenue engine. Elevated Theme Token Adoption across top-level tabs to eradicate remaining design debt and unify the "Step Inside" premium feel.
"""

# Replace Backlog until ## Done
content = re.sub(r'## Strategic Backlog\n.*?(?=## Done)', new_backlog + '\n', content, flags=re.DOTALL)

# Insert the improvement log entry
content = content.replace('## Improvement Log\n\n', '## Improvement Log\n\n' + new_improvement_log_entry)

with open('GEMINI.md', 'w') as f:
    f.write(content)
