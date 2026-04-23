import React, { useState } from 'react'
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { colors, type, btn } from '../lib/theme'

interface GuestPrintInfoModalProps {
  visible: boolean
  onConfirm: (email: string, recipientEmail: string, giftMessage: string) => void
  onCancel: () => void
}

export default function GuestPrintInfoModal({ visible, onConfirm, onCancel }: GuestPrintInfoModalProps) {
  const [email, setEmail] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [giftMessage, setGiftMessage] = useState('')
  const [emailError, setEmailError] = useState('')
  const [recipientEmailError, setRecipientEmailError] = useState('')

  const validateEmail = (text: string) => {
    // Basic email regex for client-side validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(text)
  }

  const handleConfirm = () => {
    let isValid = true
    
    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address.')
      isValid = false
    } else {
      setEmailError('')
    }

    if (recipientEmail && !validateEmail(recipientEmail)) {
      setRecipientEmailError('Please enter a valid recipient email address.')
      isValid = false
    } else {
      setRecipientEmailError('')
    }

    if (isValid) {
      onConfirm(email, recipientEmail, giftMessage)
      setEmail('')
      setRecipientEmail('')
      setGiftMessage('')
    }
  }

  const handleCancel = () => {
    setEmail('')
    setRecipientEmail('')
    setGiftMessage('')
    setEmailError('')
    setRecipientEmailError('')
    onCancel()
  }

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.centeredView}
      >
        <ScrollView contentContainerStyle={styles.scrollViewContent}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Order Print as Guest</Text>
            <Text style={styles.modalText}>Enter your details and where we should send the gift notification.</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Your Email</Text>
              <TextInput
                style={[styles.input, emailError && styles.inputError]}
                placeholder="Updates on your order"
                placeholderTextColor={colors.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={(text) => {
                  setEmail(text)
                  setEmailError('')
                }}
              />
              {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Recipient Email</Text>
              <TextInput
                style={[styles.input, recipientEmailError && styles.inputError]}
                placeholder="For gift notification"
                placeholderTextColor={colors.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                value={recipientEmail}
                onChangeText={(text) => {
                  setRecipientEmail(text)
                  setRecipientEmailError('')
                }}
              />
              {recipientEmailError ? <Text style={styles.errorText}>{recipientEmailError}</Text> : null}
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Gift Message (optional)</Text>
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

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[btn.ghost, { flex: 1, marginHorizontal: 6 }]}
                onPress={handleCancel}
              >
                <Text style={btn.ghostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[btn.primary, { flex: 1, marginHorizontal: 6 }, !email.trim() && { opacity: 0.5 }]}
                onPress={handleConfirm}
                disabled={!email.trim()}
              >
                <Text style={btn.primaryText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  scrollViewContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  modalView: {
    margin: 20,
    backgroundColor: colors.cream,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    ...type.h2,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalText: {
    ...type.body,
    marginBottom: 24,
    textAlign: 'center',
  },
  inputGroup: {
    width: '100%',
    marginBottom: 16,
  },
  label: {
    ...type.label,
    marginBottom: 6,
    marginLeft: 4,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 16,
    color: colors.dark,
  },
  inputError: {
    borderColor: colors.danger,
  },
  errorText: {
    color: colors.danger,
    marginTop: 4,
    fontSize: 12,
    marginLeft: 4,
  },
  charCount: {
    ...type.label,
    fontSize: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 8,
  },
});

