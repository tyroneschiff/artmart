import { vi } from 'vitest'

// Mock react-native
vi.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: vi.fn((objs) => objs.ios || objs.default),
  },
  StyleSheet: {
    create: vi.fn((obj) => obj),
  },
  Share: {
    share: vi.fn(() => Promise.resolve({ action: 'sharedAction' })),
  },
  Linking: {
    openURL: vi.fn(() => Promise.resolve()),
    canOpenURL: vi.fn(() => Promise.resolve(true)),
  },
  Alert: {
    alert: vi.fn(),
  },
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  Image: 'Image',
  ActivityIndicator: 'ActivityIndicator',
  ScrollView: 'ScrollView',
  TextInput: 'TextInput',
}))

// Mock expo-router
vi.mock('expo-router', () => ({
  router: {
    back: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
  },
  useLocalSearchParams: vi.fn(() => ({})),
}))

// Mock supabase
vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
    })),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(),
        createSignedUrl: vi.fn(),
      })),
    },
  },
}))
