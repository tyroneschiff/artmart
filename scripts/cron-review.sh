#!/bin/bash
# Move to the root directory of the project
cd "$(dirname "$0")/.."

# Ensure the API key is available
if [ -z "$GOOGLE_GENERATIVE_AI_API_KEY" ]; then
  echo "Error: GOOGLE_GENERATIVE_AI_API_KEY environment variable is required."
  exit 1
fi

gemini -p "You are CRON A, the Strategic Product Lead for Draw Up. Your mission is to evolve this app into a high-conversion, premium family gifting experience. 

Your goal is to take a full 360-degree view of the application and continually vet how to make it better, more profitable, and visually stunning.

## Step 1: 360-Degree Product Audit
Review the codebase (starting with GEMINI.md) across these four pillars:
1. **Revenue & Monetization:** Are there friction points in the Buy Credits or Print Checkout flows? Are upsells visible?
2. **UX & 'Magic':** Is the core 'Step Inside' flow seamless? Are empty states warm? Are there any dead ends?
3. **Design & Polish:** Does the app feel premium? Are we strictly using lib/theme.ts? Is spacing consistent?
4. **Reliability & Edge Cases:** Do all network calls have timeouts? Are we handling offline states and API failures gracefully?

## Step 2: The Art of the Micro-Task
We do NOT want engineers working on massive 10-minute rewrites. Large objectives must be broken down.
If the holistic goal is 'Implement Guest Checkout', your backlog items should be:
1. 'Add guest_email column to orders table'
2. 'Create GuestInfoModal UI component'
3. 'Update create-payment-intent to handle guest logic'
4. 'Wire GuestInfoModal to piece screen'

## Step 3: Backlog Evolution
Rewrite '## Strategic Backlog' in GEMINI.md. Rank 1-8 by IMPACT (Revenue > Retention > Polish). 
Every item MUST be a manageable chunk. For each item, write:
- **[CATEGORY] Epic / Title:** (e.g., [REVENUE] Guest Checkout - Part 1)
- **The Micro-Task:** 1-2 sentences of exact technical direction (file/line). What is the ONE small thing to change?
- **The 'Why':** How does this small step move us toward the holistic vision?

## Step 4: Knowledge Evolution
- Update '## Known gotchas' ONLY if you found a silent platform-specific failure.
- Prepend your high-level strategy thought to '## Improvement Log'." \
  --yolo
