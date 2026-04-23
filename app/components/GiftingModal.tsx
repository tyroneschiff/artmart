import React, { useState, useEffect } from 'react'
import { Modal, View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native'
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
  guestEmail?: string
  recipientEmail?: string
  giftMessage?: string
  shippingAddress?: ShippingAddress
}

interface GiftingModalProps {
  visible: boolean
  isGuest: boolean
  orderType: 'digital' | 'print'
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

export default function GiftingModal({ visible, isGuest, orderType, onConfirm, onCancel }: GiftingModalProps) {
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

    if (orderType === 'print') {
      if (!addr.name) newErrors.name = 'Full name is required.'
      if (!addr.address1) newErrors.address1 = 'Address is required.'
      if (!addr.city) newErrors.city = 'City is required.'
      if (!addr.zip) newErrors.zip = 'ZIP code is required.'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      Alert.alert('Missing fields', 'Please check the form for errors.')
      return
    }

    onConfirm({
      guestEmail: isGuest ? guestEmail : undefined,
      recipientEmail: recipientEmail || undefined,
      giftMessage: giftMessage || undefined,
      shippingAddress: orderType === 'print' ? addr : undefined
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

  const isDigital = orderType === 'digital'

  // Refactored shared style fragments
  const inputStyle = {
    borderWidth: 1, 
    borderColor: colors.border, 
    borderRadius: 12, 
    padding: 16, 
    fontSize: 16, 
    backgroundColor: colors.white,
    color: colors.dark,
  }
  const inputErrorStyle = { borderColor: colors.danger }
  const sectionHeaderStyle = { 
    ...type.label, 
    fontSize: 14, 
    color: colors.goldDark, 
    marginBottom: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: colors.border,
    paddingBottom: 8,
    textTransform: 'uppercase' as const
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={{ flex: 1, backgroundColor: colors.cream }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 40 }} keyboardShouldPersistTaps="handled">
            <Text style={{ ...type.h2, marginBottom: 8 }}>{isDigital ? 'Step inside this world' : 'Bring this world home'}</Text>
            <Text style={{ ...type.body, marginBottom: 32 }}>
              {isDigital 
                ? 'Purchase a high-resolution digital download.' 
                : 'Order a high-quality physical print.'}
            </Text>

            {isGuest && (
              <View style={{ marginBottom: 32 }}>
                <Text style={sectionHeaderStyle}>Your Information</Text>
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ ...type.label, marginBottom: 6, marginLeft: 4 }}>Your Email</Text>
                  <TextInput
                    style={[inputStyle, errors.guestEmail ? inputErrorStyle : null]}
                    placeholder="For order updates"
                    placeholderTextColor={colors.muted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={guestEmail}
                    onChangeText={(v) => { setGuestEmail(v); setErrors(prev => ({...prev, guestEmail: ''})) }}
                  />
                  {errors.guestEmail ? <Text style={{ color: colors.danger, fontSize: 12, marginTop: 4, marginLeft: 4 }}>{errors.guestEmail}</Text> : null}
                </View>
              </View>
            )}

            <View style={{ marginBottom: 32 }}>
              <Text style={sectionHeaderStyle}>{isDigital ? 'Send as Gift' : 'Gifting (Optional)'}</Text>
              <View style={{ marginBottom: 16 }}>
                <Text style={{ ...type.label, marginBottom: 6, marginLeft: 4 }}>Recipient Email</Text>
                <TextInput
                  style={[inputStyle, errors.recipientEmail ? inputErrorStyle : null]}
                  placeholder="For gift notification"
                  placeholderTextColor={colors.muted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={recipientEmail}
                  onChangeText={(v) => { setRecipientEmail(v); setErrors(prev => ({...prev, recipientEmail: ''})) }}
                />
                {errors.recipientEmail ? <Text style={{ color: colors.danger, fontSize: 12, marginTop: 4, marginLeft: 4 }}>{errors.recipientEmail}</Text> : null}
              </View>

              <View style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={{ ...type.label, marginBottom: 6, marginLeft: 4 }}>Gift Message</Text>
                  <Text style={{ ...type.label, fontSize: 10 }}>{giftMessage.length}/300</Text>
                </View>
                <TextInput
                  style={[inputStyle, { height: 100, textAlignVertical: 'top' }]}
                  placeholder="Write a little something..."
                  placeholderTextColor={colors.muted}
                  multiline
                  maxLength={300}
                  value={giftMessage}
                  onChangeText={setGiftMessage}
                />
              </View>

              {/* Gift Card Preview */}
              <View style={{ 
                backgroundColor: colors.white, 
                borderRadius: 16, 
                padding: 24, 
                borderWidth: 1, 
                borderColor: colors.border,
                shadowColor: colors.goldDark,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 12,
                elevation: 3,
                marginTop: 8
              }}>
                <Text style={{ ...type.label, color: colors.goldDark, marginBottom: 12, textAlign: 'center' }}>Gift Card Preview</Text>
                <View style={{ borderTopWidth: 1, borderTopColor: colors.goldLight, paddingTop: 16 }}>
                  <Text style={{ ...type.h3, color: colors.goldDark, textAlign: 'center', marginBottom: 16 }}>A Gift for You</Text>
                  <Text style={{ ...type.body, fontStyle: 'italic', textAlign: 'center', color: colors.dark, minHeight: 60 }}>
                    {giftMessage || "Your heartfelt message will appear here..."}
                  </Text>
                  <View style={{ marginTop: 20, alignItems: 'center' }}>
                    <View style={{ width: 40, height: 2, backgroundColor: colors.goldMid, marginBottom: 12 }} />
                    <Text style={{ ...type.label, letterSpacing: 2 }}>DRAW UP</Text>
                  </View>
                </View>
              </View>
            </View>

            {!isDigital && (
              <View style={{ marginBottom: 32 }}>
                <Text style={sectionHeaderStyle}>Shipping Address</Text>
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ ...type.label, marginBottom: 6, marginLeft: 4 }}>Full Name</Text>
                  <TextInput 
                    style={[inputStyle, errors.name ? inputErrorStyle : null]} 
                    value={addr.name} 
                    onChangeText={(v) => { setField(setAddr, 'name', v); setErrors(prev => ({...prev, name: ''})) }} 
                    placeholder="Jane Smith"
                    placeholderTextColor={colors.muted}
                  />
                </View>

                <View style={{ marginBottom: 16 }}>
                  <Text style={{ ...type.label, marginBottom: 6, marginLeft: 4 }}>Address Line 1</Text>
                  <TextInput 
                    style={[inputStyle, errors.address1 ? inputErrorStyle : null]} 
                    value={addr.address1} 
                    onChangeText={(v) => { setField(setAddr, 'address1', v); setErrors(prev => ({...prev, address1: ''})) }} 
                    placeholder="123 Main St"
                    placeholderTextColor={colors.muted}
                  />
                </View>

                <View style={{ marginBottom: 16 }}>
                  <Text style={{ ...type.label, marginBottom: 6, marginLeft: 4 }}>Address Line 2 (optional)</Text>
                  <TextInput 
                    style={inputStyle} 
                    value={addr.address2} 
                    onChangeText={(v) => setField(setAddr, 'address2', v)} 
                    placeholder="Apt 4B"
                    placeholderTextColor={colors.muted}
                  />
                </View>

                <View style={{ marginBottom: 16 }}>
                  <Text style={{ ...type.label, marginBottom: 6, marginLeft: 4 }}>City</Text>
                  <TextInput 
                    style={[inputStyle, errors.city ? inputErrorStyle : null]} 
                    value={addr.city} 
                    onChangeText={(v) => { setField(setAddr, 'city', v); setErrors(prev => ({...prev, city: ''})) }} 
                    placeholder="New York"
                    placeholderTextColor={colors.muted}
                  />
                </View>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1, marginBottom: 16 }}>
                    <Text style={{ ...type.label, marginBottom: 6, marginLeft: 4 }}>State / Prov</Text>
                    <TextInput 
                      style={inputStyle} 
                      value={addr.state_code} 
                      onChangeText={(v) => setField(setAddr, 'state_code', v)} 
                      placeholder="NY" 
                      autoCapitalize="characters"
                      placeholderTextColor={colors.muted}
                    />
                  </View>
                  <View style={{ flex: 1, marginBottom: 16 }}>
                    <Text style={{ ...type.label, marginBottom: 6, marginLeft: 4 }}>ZIP / Postcode</Text>
                    <TextInput 
                      style={[inputStyle, errors.zip ? inputErrorStyle : null]} 
                      value={addr.zip} 
                      onChangeText={(v) => { setField(setAddr, 'zip', v); setErrors(prev => ({...prev, zip: ''})) }} 
                      placeholder="10001" 
                      keyboardType="numeric"
                      placeholderTextColor={colors.muted}
                    />
                  </View>
                </View>

                <View style={{ marginBottom: 16 }}>
                  <Text style={{ ...type.label, marginBottom: 6, marginLeft: 4 }}>Country Code</Text>
                  <TextInput 
                    style={inputStyle} 
                    value={addr.country_code} 
                    onChangeText={(v) => setField(setAddr, 'country_code', v.toUpperCase())} 
                    placeholder="US" 
                    autoCapitalize="characters" 
                    maxLength={2}
                    placeholderTextColor={colors.muted}
                  />
                </View>
              </View>
            )}

            <TouchableOpacity style={[btn.primary, { marginTop: 24, marginBottom: 12 }]} onPress={handleConfirm}>
              <Text style={btn.primaryText}>Continue to Payment</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleCancel} style={{ marginBottom: 40 }}>
              <Text style={{ ...type.body, color: colors.muted, textAlign: 'center', textDecorationLine: 'underline' }}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}
