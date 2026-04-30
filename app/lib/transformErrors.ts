// Translate raw transform-API errors (from Claude vision and fal.ai
// Flux) into messages a parent can act on. Always returns a refund
// reassurance so the user knows they haven't lost a credit.
//
// The edge function in supabase/functions/transform-artwork already
// refunds the spent credit when Claude or fal.ai rejects, so we can
// confidently say "no credit used."

export type FriendlyError = {
  title: string
  body: string
  hint?: string
}

export function friendlyTransformError(raw: string | undefined | null): FriendlyError {
  const msg = (raw || '').toLowerCase()

  // Claude content policy / PII rejections (credit cards, IDs, faces, etc.)
  if (
    msg.includes("can't process") ||
    msg.includes('cannot process') ||
    msg.includes('cannot help') ||
    msg.includes("can't help") ||
    msg.includes('unable to') ||
    msg.includes('sensitive') ||
    msg.includes('financial') ||
    msg.includes('credit card') ||
    msg.includes('identification') ||
    msg.includes('personal information') ||
    msg.includes('pii')
  ) {
    return {
      title: "That doesn't look like a drawing",
      body: "Draw Up only transforms children's artwork. Photos of documents, IDs, or other sensitive things are skipped.",
      hint: 'No credit used — try a drawing instead.',
    }
  }

  // Image quality issues
  if (
    msg.includes('could not process image') ||
    msg.includes('image format') ||
    msg.includes('invalid image') ||
    msg.includes('image quality') ||
    msg.includes('blurry') ||
    msg.includes('too small')
  ) {
    return {
      title: 'Couldn\'t read that image',
      body: 'The photo was unclear or in a format the AI couldn\'t open.',
      hint: 'No credit used — try retaking it in better light.',
    }
  }

  // Rate limit
  if (msg.includes('rate limit') || msg.includes('429') || msg.includes('too many requests')) {
    return {
      title: 'Slow down a sec',
      body: "We've hit our AI rate limit for the moment.",
      hint: 'No credit used — try again in a minute.',
    }
  }

  // Timeout / connectivity
  if (
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('network') ||
    msg.includes('aborted') ||
    msg.includes('failed to fetch')
  ) {
    return {
      title: 'Connection hiccup',
      body: "The AI took too long or your connection dropped.",
      hint: 'No credit used — check your signal and try again.',
    }
  }

  // fal.ai or model-specific errors
  if (msg.includes('fal.ai') || msg.includes('flux') || msg.includes('no image returned')) {
    return {
      title: 'Image generation hiccuped',
      body: "The AI didn't finish rendering that one.",
      hint: 'No credit used — try again, or try a different drawing.',
    }
  }

  // Generic fallback
  return {
    title: 'That didn\'t transform',
    body: 'Something went sideways with the AI.',
    hint: 'No credit used — try again.',
  }
}
