// One-off backfill: regenerate ai_description for every existing piece
// using the new kid-friendly prompt (max 25 words, 2 sentences, simple vocab).
//
// Usage:
//   SUPABASE_URL=https://xxx.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
//   ANTHROPIC_API_KEY=sk-ant-... \
//   node scripts/backfill-descriptions.mjs
//
// Optional: PIECE_LIMIT=10 to test on just a few rows first.

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const LIMIT = process.env.PIECE_LIMIT ? parseInt(process.env.PIECE_LIMIT, 10) : null

if (!SUPABASE_URL || !SERVICE_KEY || !ANTHROPIC_KEY) {
  console.error('Missing required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY')
  process.exit(1)
}

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
}

async function fetchPieces() {
  const url = `${SUPABASE_URL}/rest/v1/pieces?select=id,original_image_url,ai_description,stores(child_name)&original_image_url=not.is.null`
  const res = await fetch(LIMIT ? `${url}&limit=${LIMIT}` : url, { headers })
  if (!res.ok) throw new Error(`Fetch pieces: ${res.status} ${await res.text()}`)
  return res.json()
}

async function imageUrlToBase64(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Fetch image ${url}: ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  return buf.toString('base64')
}

async function generateDescription(imageBase64, childName) {
  const systemPrompt = `You write magical 2-sentence reactions to a child's drawing — the kind of thing that makes a kid grin and feel seen. The child is your audience, not a third party.

RULES:
- 2 sentences, max 30 words total.
- Kid-friendly vocabulary only. NO fancy words: no "magnificent", "extraordinary", "exuberance", "kinetic", "masterpiece", "vivid", "dynamic", "captivating", "imaginative", "delightful".
- NEVER start with "You painted", "You drew", "You made", "You created". Vary openings — surprise, wonder, observation, imagination.
- Name 1-2 specific things from the drawing (a color, a creature, a shape, a detail).
- Spark a tiny bit of imagination or story — what's happening, where they might be, what it feels like.
- End with warmth, but make it feel earned, not formulaic.
- Plain text only, no quotes, no emoji.

GOOD EXAMPLES:
"Wow — that purple dragon looks like he's about to take off into the clouds! And those tiny flowers down by his feet? Such a sweet detail."
"A whole rainbow city! I keep finding new windows in those blue towers — I bet the people who live there are happy all day long."
"Look at that brave little fox tiptoeing through the orange leaves. Something about his pointy ears makes me feel like he's about to find an adventure."`

  const userText = `Look at this drawing${childName ? ` by ${childName}` : ''}. Write your 2-sentence reaction to ${childName || 'the child'}. Don't start with "You painted/drew/made/created". Surprise them.`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 200,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } },
            { type: 'text', text: userText },
          ],
        },
      ],
    }),
  })

  if (!res.ok) throw new Error(`Claude: ${res.status} ${await res.text()}`)
  const json = await res.json()
  return json.content[0].text.trim()
}

async function updatePiece(id, description) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/pieces?id=eq.${id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ ai_description: description }),
  })
  if (!res.ok) throw new Error(`Update ${id}: ${res.status} ${await res.text()}`)
}

async function main() {
  const pieces = await fetchPieces()
  console.log(`Found ${pieces.length} piece(s) to backfill`)

  let ok = 0
  let failed = 0
  for (const piece of pieces) {
    const childName = piece.stores?.child_name || ''
    try {
      console.log(`\n[${piece.id}] ${childName} — old: "${(piece.ai_description || '').slice(0, 60)}..."`)
      const imageBase64 = await imageUrlToBase64(piece.original_image_url)
      const description = await generateDescription(imageBase64, childName)
      await updatePiece(piece.id, description)
      console.log(`[${piece.id}] new: "${description}"`)
      ok++
    } catch (e) {
      console.error(`[${piece.id}] FAILED:`, e.message)
      failed++
    }
  }

  console.log(`\nDone. ${ok} updated, ${failed} failed.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
