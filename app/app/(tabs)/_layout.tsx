import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../lib/theme'

// Outline icons when inactive, filled when active — matches the warm/confident
// feel of the home page wordmark and the smiling-sun app icon.
function tabIcon(outline: keyof typeof Ionicons.glyphMap, filled: keyof typeof Ionicons.glyphMap) {
  return ({ color, focused, size }: { color: string; focused: boolean; size: number }) => (
    <Ionicons name={focused ? filled : outline} size={size} color={color} />
  )
}

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
      tabBarLabelStyle: { fontSize: 11, fontWeight: '600', letterSpacing: -0.1 },
      tabBarIconStyle: { marginBottom: -2 },
    }}>
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          tabBarIcon: tabIcon('compass-outline', 'compass'),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'Create',
          tabBarIcon: tabIcon('add-circle-outline', 'add-circle'),
        }}
      />
      <Tabs.Screen
        name="mystores"
        options={{
          title: 'Galleries',
          tabBarIcon: tabIcon('folder-open-outline', 'folder-open'),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: tabIcon('person-circle-outline', 'person-circle'),
        }}
      />
    </Tabs>
  )
}
