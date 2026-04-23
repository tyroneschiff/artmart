import React, { useState } from 'react'
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { colors } from '../lib/theme'

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

            <TextInput
              style={[styles.input, emailError && styles.inputError]}
              placeholder="Your Email (for updates)"
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

            <TextInput
              style={[styles.input, recipientEmailError && styles.inputError]}
              placeholder="Recipient Email (for gift notification)"
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

            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              placeholder="Gift Message (optional)"
              placeholderTextColor={colors.muted}
              multiline
              maxLength={200}
              value={giftMessage}
              onChangeText={setGiftMessage}
            />
            <Text style={styles.charCount}>{giftMessage.length}/200</Text>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.buttonCancel]}
                onPress={handleCancel}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.buttonConfirm]}
                onPress={handleConfirm}
                disabled={!email.trim()}
              >
                <Text style={styles.buttonText}>Confirm</Text>
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
  },
  modalView: {
    margin: 20,
    backgroundColor: colors.cream,
    borderRadius: 20,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    marginBottom: 15,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '800',
    color: colors.dark,
    letterSpacing: -0.5,
  },
  modalText: {
    marginBottom: 20,
    textAlign: 'center',
    color: colors.mid,
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 16,
    color: colors.dark,
  },
  inputError: {
    borderColor: 'red',
  },
  errorText: {
    color: 'red',
    alignSelf: 'flex-start',
    marginBottom: 10,
    fontSize: 12,
  },
  charCount: {
    alignSelf: 'flex-end',
    fontSize: 12,
    color: colors.muted,
    marginBottom: 15,
    marginTop: -5,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
  },
  button: {
    borderRadius: 100,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonCancel: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonConfirm: {
    backgroundColor: colors.gold,
  },
  buttonText: {
    color: colors.dark,
    fontWeight: '700',
    fontSize: 16,
  },
});
