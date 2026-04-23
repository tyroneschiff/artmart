import React, { useState, useEffect } from 'react'
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native'
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

export type GiftingData = {
...

  recipientEmail?: string
  giftMessage?: string
  shippingAddress: ShippingAddress
}

interface GiftingModalProps {
  visible: boolean
  isGuest: boolean
  onConfirm: (data: GiftingData) => void
  onCancel: () => void
}

const EMPTY_ADDR: ShippingAddress = { 
  name: '', 
  address1: '', 
  address2: '', 
  city: '', 
  state_code: '', 
  country_code: 'US', 
  zip: '' 
}

export default function GiftingModal({ visible, isGuest, onConfirm, onCancel }: GiftingModalProps) {
  const [guestEmail, setGuestEmail] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [giftMessage, setGiftMessage] = useState('')
  const [addr, setAddr] = useState<ShippingAddress>(EMPTY_ADDR)

  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (visible) {
      // Reset errors when modal opens
      setErrors({})
    }
  }, [visible])

  function setField<T>(setter: React.Dispatch<React.SetStateAction<T>>, field: keyof T, value: string) {
    setter((prev: any) => ({ ...prev, [field]: value }))
  }

  const validateEmail = (text: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(text)
  }

  function handleConfirm() {
    const newErrors: Record<string, string> = {}

    if (isGuest) {
      if (!guestEmail) newErrors.guestEmail = 'Your email is required for guest checkout.'
      else if (!validateEmail(guestEmail)) newErrors.guestEmail = 'Please enter a valid email address.'
    }

    if (recipientEmail && !validateEmail(recipientEmail)) {
      newErrors.recipientEmail = 'Please enter a valid recipient email address.'
    }

    if (!addr.name) newErrors.name = 'Full name is required.'
    if (!addr.address1) newErrors.address1 = 'Address is required.'
    if (!addr.city) newErrors.city = 'City is required.'
    if (!addr.zip) newErrors.zip = 'ZIP code is required.'

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      Alert.alert('Missing fields', 'Please check the form for errors.')
      return
    }

    onConfirm({
      guestEmail: isGuest ? guestEmail : undefined,
      recipientEmail: recipientEmail || undefined,
      giftMessage: giftMessage || undefined,
      shippingAddress: addr
    })
    
    // Reset state after success
    setGuestEmail('')
    setRecipientEmail('')
    setGiftMessage('')
    setAddr(EMPTY_ADDR)
    setErrors({})
  }

  function handleCancel() {
    setErrors({})
    onCancel()
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={{ flex: 1, backgroundColor: colors.cream }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Bring this world home</Text>
            <Text style={styles.subtitle}>Order a high-quality physical print.</Text>

            {isGuest && (
              <View style={styles.section}>
                <Text style={styles.sectionHeader}>Your Information</Text>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Your Email</Text>
                  <TextInput
                    style={[styles.input, errors.guestEmail && styles.inputError]}
                    placeholder="For order updates"
                    placeholderTextColor={colors.muted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={guestEmail}
                    onChangeText={(v) => { setGuestEmail(v); setErrors(prev => ({...prev, guestEmail: ''})) }}
                  />
                  {errors.guestEmail ? <Text style={styles.errorText}>{errors.guestEmail}</Text> : null}
                </View>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionHeader}>Gifting (Optional)</Text>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Recipient Email</Text>
                <TextInput
                  style={[styles.input, errors.recipientEmail && styles.inputError]}
                  placeholder="For gift notification"
                  placeholderTextColor={colors.muted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={recipientEmail}
                  onChangeText={(v) => { setRecipientEmail(v); setErrors(prev => ({...prev, recipientEmail: ''})) }}
                />
                {errors.recipientEmail ? <Text style={styles.errorText}>{errors.recipientEmail}</Text> : null}
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Gift Message</Text>
                  <Text style={styles.charCount}>{giftMessage.length}/200</Text>
                </View>
                <TextInput
                  style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                  placeholder="Write a little something..."
                  placeholderTextColor={colors.muted}
                  multiline
                  maxLength={200}
                  value={giftMessage}
                  onChangeText={setGiftMessage}
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionHeader}>Shipping Address</Text>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput 
                  style={[styles.input, errors.name && styles.inputError]} 
                  value={addr.name} 
                  onChangeText={(v) => { setField(setAddr, 'name', v); setErrors(prev => ({...prev, name: ''})) }} 
                  placeholder="Jane Smith"
                  placeholderTextColor={colors.muted}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Address Line 1</Text>
                <TextInput 
                  style={[styles.input, errors.address1 && styles.inputError]} 
                  value={addr.address1} 
                  onChangeText={(v) => { setField(setAddr, 'address1', v); setErrors(prev => ({...prev, address1: ''})) }} 
                  placeholder="123 Main St"
                  placeholderTextColor={colors.muted}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Address Line 2 (optional)</Text>
                <TextInput 
                  style={styles.input} 
                  value={addr.address2} 
                  onChangeText={(v) => setField(setAddr, 'address2', v)} 
                  placeholder="Apt 4B"
                  placeholderTextColor={colors.muted}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>City</Text>
                <TextInput 
                  style={[styles.input, errors.city && styles.inputError]} 
                  value={addr.city} 
                  onChangeText={(v) => { setField(setAddr, 'city', v); setErrors(prev => ({...prev, city: ''})) }} 
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
                    onChangeText={(v) => setField(setAddr, 'state_code', v)} 
                    placeholder="NY" 
                    autoCapitalize="characters"
                    placeholderTextColor={colors.muted}
                  />
                </View>
                <View style={[styles.half, styles.inputGroup]}>
                  <Text style={styles.label}>ZIP / Postcode</Text>
                  <TextInput 
                    style={[styles.input, errors.zip && styles.inputError]} 
                    value={addr.zip} 
                    onChangeText={(v) => { setField(setAddr, 'zip', v); setErrors(prev => ({...prev, zip: ''})) }} 
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
                  onChangeText={(v) => setField(setAddr, 'country_code', v.toUpperCase())} 
                  placeholder="US" 
                  autoCapitalize="characters" 
                  maxLength={2}
                  placeholderTextColor={colors.muted}
                />
              </View>
            </View>

            <TouchableOpacity style={[btn.primary, { marginTop: 24, marginBottom: 12 }]} onPress={handleConfirm}>
              <Text style={btn.primaryText}>Continue to Payment</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleCancel} style={{ marginBottom: 40 }}>
              <Text style={styles.cancel}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  scrollContent: { padding: 24, paddingTop: 40 },
  title: { ...type.h2, marginBottom: 8 },
  subtitle: { ...type.body, marginBottom: 32 },
  section: { marginBottom: 32 },
  sectionHeader: { 
    ...type.label, 
    fontSize: 14, 
    color: colors.goldDark, 
    marginBottom: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: colors.border,
    paddingBottom: 8,
    textTransform: 'uppercase'
  },
  inputGroup: { marginBottom: 16 },
  label: { ...type.label, marginBottom: 6, marginLeft: 4 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  charCount: { ...type.label, fontSize: 10 },
  input: { 
    borderWidth: 1, 
    borderColor: colors.border, 
    borderRadius: 12, 
    padding: 16, 
    fontSize: 16, 
    backgroundColor: colors.white,
    color: colors.dark,
  },
  inputError: { borderColor: colors.danger },
  errorText: { color: colors.danger, fontSize: 12, marginTop: 4, marginLeft: 4 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  cancel: { 
    ...type.body,
    color: colors.muted, 
    textAlign: 'center', 
    textDecorationLine: 'underline' 
  },
})
