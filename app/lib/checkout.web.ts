import { Alert, Linking } from 'react-native'
import { ShippingAddress } from '../components/GiftingModal'

const APP_STORE_URL = 'https://testflight.apple.com/join/rKsqMyfV'

export async function purchasePiece(
  _pieceId: string,
  _orderType: 'digital' | 'print',
  _userToken?: string,
  _shippingAddress?: ShippingAddress,
  _guestEmail?: string,
  _recipientEmail?: string,
  _giftMessage?: string,
  _quantity: number = 1
): Promise<void> {
  Alert.alert(
    'Get the Draw Up app',
    'Download the free Draw Up app to purchase this piece and support this artist.',
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Get the App', onPress: () => Linking.openURL(APP_STORE_URL) },
    ]
  )
}
