import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native'
import { colors, type } from '../lib/theme'

type Props = {
  imageUri: string
  childName?: string
  onPress?: () => void
}

export default function PreservedDrawing({ imageUri, childName, onPress }: Props) {
  return (
    <View style={styles.section}>
      <View style={styles.labelRow}>
        <View style={styles.line} />
        <Text style={styles.label}>The original drawing</Text>
        <View style={styles.line} />
      </View>
      <Text style={styles.subtitle}>
        {childName ? `Preserved exactly as ${childName} drew it.` : 'Preserved exactly as it was drawn.'}
      </Text>
      <TouchableOpacity activeOpacity={0.9} onPress={onPress}>
        <View style={styles.frame}>
          <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
        </View>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 16,
    paddingTop: 32,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 6,
  },
  line: {
    height: 1,
    width: 28,
    backgroundColor: colors.border,
  },
  label: {
    ...type.label,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.muted,
    textTransform: 'uppercase',
  },
  subtitle: {
    ...type.body,
    fontSize: 13,
    color: colors.mid,
    textAlign: 'center',
    marginBottom: 20,
    fontStyle: 'italic',
  },
  frame: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
  },
})
