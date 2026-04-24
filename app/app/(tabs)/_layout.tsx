import { Tabs } from 'expo-router'
import { Text } from 'react-native'
import { colors } from '../../lib/theme'

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.gold,
      tabBarInactiveTintColor: colors.muted,
      tabBarStyle: {
        backgroundColor: colors.white,
        borderTopWidth: 1,
        borderTopColor: colors.border,
      },
      tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
    }}>
      <Tabs.Screen name="discover" options={{ title: 'Discover', tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>✦</Text> }} />
      <Tabs.Screen name="create" options={{ title: 'Create', tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>✨</Text> }} />
      <Tabs.Screen name="mystores" options={{ title: 'My Galleries', tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>🎨</Text> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>◉</Text> }} />
    </Tabs>
  )
}
