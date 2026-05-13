// First-run onboarding flag. We only ever want the welcome modal to
// show once per device per user. AsyncStorage is enough — the cost of
// occasionally re-showing on a fresh install is low, and we never
// want to surprise a returning user with a "welcome" sheet.

import AsyncStorage from '@react-native-async-storage/async-storage'

// Versioned so we can re-run the prompt later if the onboarding flow
// changes meaningfully. Bumping the suffix forces every user to see
// the new version once.
const KEY = '@drawup/onboarding_dismissed_v1'

export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(KEY)
    return v === '1'
  } catch {
    return false
  }
}

export async function markOnboardingDismissed(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, '1')
  } catch {
    // No-op — worst case we re-show on next launch, not a big deal.
  }
}
