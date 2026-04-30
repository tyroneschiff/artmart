import { supabase } from './supabase'

/**
 * Ensure a profile row exists for the current user.
 *
 * Why: there's a server-side `handle_new_user` trigger that creates a
 * profile + 3 credits on auth.users insert, but on a fresh sign-up the
 * client can race the trigger — credits/profile queries fire before
 * the row is visible to the client's role. This call is idempotent:
 * if the row already exists it does nothing; if it's missing (or got
 * lost), it creates one with default credits=3.
 *
 * Called on every SIGNED_IN event from the auth listener.
 */
export async function ensureProfile(userId: string): Promise<void> {
  try {
    // ignoreDuplicates: true → no-op if a row with this id already exists.
    // Otherwise insert with id only; defaults fill in (display_name=null,
    // credits=3 from migration 003).
    await supabase
      .from('profiles')
      .upsert({ id: userId }, { onConflict: 'id', ignoreDuplicates: true })
  } catch {
    // Swallow — RLS may briefly reject if the JWT hasn't been issued yet,
    // and the trigger usually wins anyway. Worst case: next sign-in retries.
  }
}
