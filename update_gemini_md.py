import re
from datetime import datetime

with open('GEMINI.md', 'r') as f:
    content = f.read()

# Replace Strategic Backlog
new_backlog = """## Strategic Backlog

1. **[REVENUE] Public Store & Piece OG Meta Tags - Part 2**
    *   **The Micro-Task:** In `web/index.html`, add client-side script or Netlify/Vercel rewrite rules to ensure `/store/*` and `/piece/*` routes resolve to the Edge Function `serve-og-tags`.
    *   **Why:** The Edge Function is built, but without the front-end routing pointing to it, WhatsApp won't fetch the dynamic previews. This completes the most critical organic growth loop.

2. **[REVENUE] Checkout UI Polish: Premium Aesthetic**
    *   **The Micro-Task:** Refactor `app/components/GuestPrintInfoModal.tsx` and `app/components/ShippingAddressModal.tsx` to use `type` tokens for typography, add consistent padding (24px), and use `btn.primary` for CTAs.
    *   **Why:** Grandparents are the primary buyers; the checkout experience must feel trustworthy and high-end to convert.

3. **[RETENTION] Post-Publish Share Prompt in Create Flow**
    *   **The Micro-Task:** In `app/app/(tabs)/create.tsx`, replace the automatic `ShareSheet` popup with a dedicated success card featuring a prominent, gold "Share to Family WhatsApp" button.
    *   **Why:** Encourages immediate sharing while the emotional "wow" of the transformation is still fresh.

4. **[UX] Narrative Consistency: My Stores Empty State**
    *   **The Micro-Task:** Update the `ListEmptyComponent` in `app/app/(tabs)/mystores.tsx` to use `type.h2` for the title and `btn.primary` for the "Create first store" button.
    *   **Why:** The first-run experience for parents should be warm, inviting, and clearly on-brand.

5. **[POLISH] Theme Token Adoption: Piece Detail Screen**
    *   **The Micro-Task:** Refactor `app/app/piece/[id].tsx` to replace all raw `colors` and inline styles with `type`, `btn`, and `card` tokens from `lib/theme.ts`.
    *   **Why:** Removes design debt on the most important screen in the app, ensuring it feels premium and intentional.

6. **[POLISH] Theme Token Adoption: My Stores & Profile**
    *   **The Micro-Task:** Refactor `app/app/(tabs)/mystores.tsx` and `app/app/(tabs)/profile.tsx` for full design system token compliance (`type`, `btn`, `card`).
    *   **Why:** Consistency in design reinforces the emotional value and professional quality of the platform.

7. **[QUALITY] Backend Validation: Moderate Comment Tests**
    *   **The Micro-Task:** Replace the stub in `supabase/functions/tests/moderate-comment_test.ts` with real tests mocking Gemini and verifying DB persistence.
    *   **Why:** Kid safety is critical; we need automated assurance that moderation works as intended.

8. **[QUALITY] App Validation: Download Library Coverage**
    *   **The Micro-Task:** Create `app/lib/download.test.ts` to achieve 100% coverage for the download library, mocking `FileSystem` and signed URL logic.
    *   **Why:** Paid features must be bulletproof to avoid customer support overhead.

## Improvement Log"""

content = re.sub(r'## Strategic Backlog.*?## Improvement Log', new_backlog, content, flags=re.DOTALL)

# Add improvement log entry
today = datetime.now().strftime("%Y-%m-%d")
new_log = f"- [{today} CRON A] Strategic Audit & Backlog Refinement — Performed 360-degree audit. Prioritized URL rewrites for OG tags as #1 to complete the organic growth loop. Elevated 'Post-Publish Share Prompts' to #3 to capture the post-transform 'wow' moment. Adjusted backlog to ensure 1-8 are strictly achievable micro-tasks ranked by impact."
content = content.replace('## Improvement Log\n\n', f'## Improvement Log\n\n{new_log}\n')

# Update Current task queue
new_queue = """## Current task queue

**Done (recent):**
- ✅ [REVENUE] Public Store & Piece OG Meta Tags — Edge function `serve-og-tags`.
- ✅ [UX] Narrative Consistency Pass — Update Login tagline & Empty States
- ✅ [POLISH] Theme Token Adoption — `discover.tsx` and `store/[slug].tsx` refactored
- ✅ [REVENUE] Prominent "Buy Credits" CTA & UX Polish

**Pending (strategic priority):**
- [ ] [REVENUE] Public Store & Piece OG Meta Tags — Micro-Task 2: Configure URL rewrites in landing page.
- [ ] [REVENUE] Checkout UI Polish — Micro-Task 1: Premium polish for `GuestPrintInfoModal.tsx`.
- [ ] [RETENTION] Post-Publish Share Prompts — Micro-Task 1: Prominent WhatsApp button in `create.tsx`.
- [ ] [UX] Narrative Consistency Pass — Micro-Task 1: Polish `ListEmptyComponent` in `mystores.tsx`."""

content = re.sub(r'## Current task queue.*?---', new_queue + '\n\n---', content, flags=re.DOTALL)

with open('GEMINI.md', 'w') as f:
    f.write(content)

