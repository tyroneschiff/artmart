import { useEffect } from 'react'
import { Platform } from 'react-native'
import { Stack } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../hooks/useAuthStore'
import StripeWrapper from '../components/StripeWrapper'

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
  if (Platform.OS === 'web' || !Device.isDevice) {
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setHydrated()
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session?.user) {
      registerForPushNotificationsAsync().then((token) => {
        if (token) {
          supabase
            .from('profiles')
            .update({ expo_push_token: token })
            .eq('id', session.user.id)
            .then(({ error }) => {
              if (error) console.error('Error saving push token:', error)
            })
        }
      })
    }
  }, [session])

  return (
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
      </QueryClientProvider>
    </StripeWrapper>
  )
}
