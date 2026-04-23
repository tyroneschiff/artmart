import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, ScrollView, Alert } from 'react-native'
import { colors } from '../lib/theme'

export type ShippingAddress = {
  name: string
  address1: string
  address2: string
  city: string
  state_code: string
  country_code: string
  zip: string
}

type Props = {
  visible: boolean
  onConfirm: (address: ShippingAddress) => void
  onCancel: () => void
}

const EMPTY: ShippingAddress = { name: '', address1: '', address2: '', city: '', state_code: '', country_code: 'US', zip: '' }

export default function ShippingAddressModal({ visible, onConfirm, onCancel }: Props) {
  const [addr, setAddr] = useState<ShippingAddress>(EMPTY)

  function set(field: keyof ShippingAddress, value: string) {
    setAddr((prev) => ({ ...prev, [field]: value }))
  }

  function handleConfirm() {
    if (!addr.name || !addr.address1 || !addr.city || !addr.country_code || !addr.zip) {
      Alert.alert('Missing fields', 'Please fill in name, address, city, country, and zip.')
      return
    }
    onConfirm(addr)
    setAddr(EMPTY)
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Shipping Address</Text>
        <Text style={styles.subtitle}>Your print will be shipped here.</Text>

        <Text style={styles.label}>Full name</Text>
        <TextInput style={styles.input} value={addr.name} onChangeText={(v) => set('name', v)} placeholder="Jane Smith" />

        <Text style={styles.label}>Address line 1</Text>
        <TextInput style={styles.input} value={addr.address1} onChangeText={(v) => set('address1', v)} placeholder="123 Main St" />

        <Text style={styles.label}>Address line 2 (optional)</Text>
        <TextInput style={styles.input} value={addr.address2} onChangeText={(v) => set('address2', v)} placeholder="Apt 4B" />

        <Text style={styles.label}>City</Text>
        <TextInput style={styles.input} value={addr.city} onChangeText={(v) => set('city', v)} placeholder="New York" />

        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.label}>State / Province</Text>
            <TextInput style={styles.input} value={addr.state_code} onChangeText={(v) => set('state_code', v)} placeholder="NY" autoCapitalize="characters" />
          </View>
          <View style={styles.half}>
            <Text style={styles.label}>ZIP / Postcode</Text>
            <TextInput style={styles.input} value={addr.zip} onChangeText={(v) => set('zip', v)} placeholder="10001" keyboardType="numeric" />
          </View>
        </View>

        <Text style={styles.label}>Country code</Text>
        <TextInput style={styles.input} value={addr.country_code} onChangeText={(v) => set('country_code', v.toUpperCase())} placeholder="US" autoCapitalize="characters" maxLength={2} />

        <TouchableOpacity style={styles.button} onPress={handleConfirm}>
          <Text style={styles.buttonText}>Continue to Payment</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onCancel}>
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { padding: 32, paddingTop: 56 },
  title: { fontSize: 26, fontWeight: '800', color: colors.dark, marginBottom: 6 },
  subtitle: { fontSize: 14, color: colors.muted, marginBottom: 28 },
  label: { fontSize: 13, fontWeight: '600', color: colors.mid, marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, fontSize: 16, backgroundColor: colors.white },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  button: { backgroundColor: colors.dark, borderRadius: 100, padding: 16, alignItems: 'center', marginTop: 32, marginBottom: 12 },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  cancel: { color: colors.muted, textAlign: 'center', fontSize: 15 },
})
