import { Redirect } from 'expo-router'
import { View, ActivityIndicator } from 'react-native'
import { useAuthStore } from '../hooks/useAuthStore'

export default function Index() {
  const session = useAuthStore((s) => s.session)
  const hydrated = useAuthStore((s) => s.hydrated)

  if (!hydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FEFAF3', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#E8A020" />
      </View>
    )
  }

  return <Redirect href={session ? '/(tabs)/discover' : '/(auth)/login'} />
}
