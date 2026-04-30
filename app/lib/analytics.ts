import { supabase } from './supabase'

// Lightweight event logger. Fire-and-forget — never block UX on telemetry.
// Insert failures are swallowed; we'd rather lose an event than break the app.
//
// Read events from Supabase SQL editor. Examples:
//   shares_per_transform = count(share_completed) / count(transform_completed)
//   signups_per_share    = count(signup_completed) / count(share_completed)

export type EventName =
  | 'signup_completed'
  | 'transform_started'
  | 'transform_completed'
  | 'transform_failed'
  | 'piece_published'
  | 'share_started'
  | 'share_completed'
  | 'vote_cast'
  | 'gallery_created'
  | 'original_saved'
  | 'gallery_followed'
  | 'gallery_unfollowed'

type TrackProps = {
  pieceId?: string
  storeId?: string
  metadata?: Record<string, unknown>
}

export function track(event: EventName, props: TrackProps = {}) {
  ;(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      await supabase.from('events').insert({
        user_id: session?.user.id ?? null,
        event_type: event,
        piece_id: props.pieceId ?? null,
        store_id: props.storeId ?? null,
        metadata: props.metadata ?? {},
      })
    } catch {
      // Silent — telemetry must never surface to the user.
    }
  })()
}
