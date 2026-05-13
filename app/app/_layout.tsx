import { useEffect, useState } from 'react'
import { Platform, Linking } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { Stack } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../hooks/useAuthStore'
import { ensureProfile } from '../lib/ensureProfile'
import { hasSeenOnboarding, markOnboardingDismissed } from '../lib/onboarding'
import { track } from '../lib/analytics'
import StripeWrapper from '../components/StripeWrapper'
import OnboardingSheet from '../components/OnboardingSheet'

const queryClient = new QueryClient()

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'web' || !Device.isDevice || Constants.appOwnership === 'expo') {
    return null
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }
  if (finalStatus !== 'granted') {
    return null
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId
  if (!projectId) {
    return null
  }

  try {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data
    
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      })
    }

    return token
  } catch (e) {
    console.error('Failed to get push token', e)
    return null
  }
}

export default function RootLayout() {
  const setSession = useAuthStore((s) => s.setSession)
  const setHydrated = useAuthStore((s) => s.setHydrated)
  const session = useAuthStore((s) => s.session)
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setHydrated()
      // Belt-and-suspenders: if the server-side handle_new_user trigger
      // raced the client, this creates the profile row idempotently.
      // Then invalidate credits + profile so the UI sees the freshly-
      // created data instead of the empty pre-trigger state.
      if (session?.user.id) {
        ensureProfile(session.user.id).then(() => {
          queryClient.invalidateQueries({ queryKey: ['credits', session.user.id] })
          queryClient.invalidateQueries({ queryKey: ['profile', session.user.id] })
        })
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      // Same defensive ensure on every sign-in (handles fresh sign-up,
      // sign-in after sign-out, deep-link recovered session).
      if (event === 'SIGNED_IN' && session?.user.id) {
        ensureProfile(session.user.id).then(() => {
          queryClient.invalidateQueries({ queryKey: ['credits', session.user.id] })
          queryClient.invalidateQueries({ queryKey: ['profile', session.user.id] })
        })
      }
    })

    // Handle email confirmation deep links: drawup://#access_token=...
    async function processDeepLink(url: string | null) {
      if (!url) return
      const hash = url.split('#')[1]
      if (!hash) return
      const params = new URLSearchParams(hash)
      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')
      if (accessToken && refreshToken) {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      }
    }

    Linking.getInitialURL().then(processDeepLink)
    const linkingSub = Linking.addEventListener('url', ({ url }) => processDeepLink(url))

    return () => {
      subscription.unsubscribe()
      linkingSub.remove()
    }
  }, [])

  // First-run onboarding: show the welcome sheet for users who haven't
  // dismissed it AND have no galleries yet. Returning users (with at
  // least one gallery) never see this, even on a fresh install — the
  // gallery count gates it harder than the AsyncStorage flag alone.
  useEffect(() => {
    if (!session?.user?.id) return
    let cancelled = false
    ;(async () => {
      try {
        const seen = await hasSeenOnboarding()
        if (seen || cancelled) return
        const { count } = await supabase
          .from('stores')
          .select('id', { count: 'exact', head: true })
          .eq('owner_id', session.user.id)
        if (cancelled) return
        if ((count ?? 0) === 0) {
          setShowOnboarding(true)
          track('onboarding_shown')
        } else {
          // Returning user without the flag set (e.g. cleared
          // AsyncStorage); silently mark as seen so we don't pop up
          // later by accident.
          markOnboardingDismissed()
        }
      } catch {
        // Silent — never let onboarding logic break app launch.
      }
    })()
    return () => { cancelled = true }
  }, [session?.user?.id])

  async function dismissOnboarding() {
    setShowOnboarding(false)
    await markOnboardingDismissed()
    track('onboarding_dismissed')
  }

  // Push notification registration is intentionally disabled until at
  // least one server-side trigger sends to these tokens. Asking for
  // permission and never delivering a notification is a trust hit and
  // an App Store review flag. Re-enable when shipping the first push
  // trigger (e.g. "someone loved your piece" or "new piece in a
  // gallery you follow"). The `registerForPushNotificationsAsync`
  // helper above is kept intact so re-enabling is a one-line change.
  // See CLAUDE.md `## What we've tried and rejected` and the
  // notifications backlog item.
  //
  // useEffect(() => {
  //   if (session?.user) {
  //     registerForPushNotificationsAsync().then((token) => {
  //       if (token) {
  //         supabase
  //           .from('profiles')
  //           .update({ expo_push_token: token })
  //           .eq('id', session.user.id)
  //           .then(({ error }) => {
  //             if (error) console.error('Error saving push token:', error)
  //           })
  //       }
  //     })
  //   }
  // }, [session])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StripeWrapper>
        <QueryClientProvider client={queryClient}>
          <Stack screenOptions={{
            headerShown: false,
            gestureEnabled: true,
            fullScreenGestureEnabled: true,
            animation: Platform.OS === 'android' ? 'fade_from_bottom' : 'default',
          }}>
            <Stack.Screen name="credits" options={{ presentation: 'modal' }} />
          </Stack>
          <OnboardingSheet visible={showOnboarding} onDismiss={dismissOnboarding} />
        </QueryClientProvider>
      </StripeWrapper>
    </GestureHandlerRootView>
  )
}
