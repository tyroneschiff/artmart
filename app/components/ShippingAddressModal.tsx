import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, ScrollView, Alert } from 'react-native'
import { colors, type, btn } from '../lib/theme'

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
      <View style={{ flex: 1, backgroundColor: colors.cream }}>
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.title}>Shipping Address</Text>
          <Text style={styles.subtitle}>Where should we send your print?</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput 
              style={styles.input} 
              value={addr.name} 
              onChangeText={(v) => set('name', v)} 
              placeholder="Jane Smith"
              placeholderTextColor={colors.muted}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Address Line 1</Text>
            <TextInput 
              style={styles.input} 
              value={addr.address1} 
              onChangeText={(v) => set('address1', v)} 
              placeholder="123 Main St"
              placeholderTextColor={colors.muted}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Address Line 2 (optional)</Text>
            <TextInput 
              style={styles.input} 
              value={addr.address2} 
              onChangeText={(v) => set('address2', v)} 
              placeholder="Apt 4B"
              placeholderTextColor={colors.muted}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>City</Text>
            <TextInput 
              style={styles.input} 
              value={addr.city} 
              onChangeText={(v) => set('city', v)} 
              placeholder="New York"
              placeholderTextColor={colors.muted}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.half, styles.inputGroup]}>
              <Text style={styles.label}>State / Prov</Text>
              <TextInput 
                style={styles.input} 
                value={addr.state_code} 
                onChangeText={(v) => set('state_code', v)} 
                placeholder="NY" 
                autoCapitalize="characters"
                placeholderTextColor={colors.muted}
              />
            </View>
            <View style={[styles.half, styles.inputGroup]}>
              <Text style={styles.label}>ZIP / Postcode</Text>
              <TextInput 
                style={styles.input} 
                value={addr.zip} 
                onChangeText={(v) => set('zip', v)} 
                placeholder="10001" 
                keyboardType="numeric"
                placeholderTextColor={colors.muted}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Country Code</Text>
            <TextInput 
              style={styles.input} 
              value={addr.country_code} 
              onChangeText={(v) => set('country_code', v.toUpperCase())} 
              placeholder="US" 
              autoCapitalize="characters" 
              maxLength={2}
              placeholderTextColor={colors.muted}
            />
          </View>

          <TouchableOpacity style={[btn.primary, { marginTop: 12 }]} onPress={handleConfirm}>
            <Text style={btn.primaryText}>Continue to Payment</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onCancel} style={{ marginTop: 16 }}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 40 },
  title: { ...type.h2, marginBottom: 8 },
  subtitle: { ...type.body, marginBottom: 32 },
  inputGroup: { marginBottom: 16 },
  label: { ...type.label, marginBottom: 6, marginLeft: 4 },
  input: { 
    borderWidth: 1, 
    borderColor: colors.border, 
    borderRadius: 12, 
    padding: 16, 
    fontSize: 16, 
    backgroundColor: colors.white,
    color: colors.dark,
  },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  cancel: { 
    ...type.body,
    color: colors.muted, 
    textAlign: 'center', 
    textDecorationLine: 'underline' 
  },
})

