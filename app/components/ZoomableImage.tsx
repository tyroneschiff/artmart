import { Image, StyleSheet, ImageStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated'

const MIN_SCALE = 1
const MAX_SCALE = 5

type Props = {
  uri: string
  style?: ImageStyle
  /** Called when user taps once with no zoom — typically used to dismiss the lightbox. */
  onSingleTap?: () => void
}

const AnimatedImage = Animated.createAnimatedComponent(Image)

/**
 * Pinch-to-zoom + pan + double-tap-reset image.
 *
 * - Pinch: scales between MIN_SCALE and MAX_SCALE
 * - Pan: only enabled while zoomed in
 * - Double-tap: zooms in to 2x, or resets to 1x if already zoomed
 * - Single tap (only when not zoomed): fires onSingleTap (dismiss the lightbox)
 */
export default function ZoomableImage({ uri, style, onSingleTap }: Props) {
  const scale = useSharedValue(1)
  const savedScale = useSharedValue(1)
  const translationX = useSharedValue(0)
  const translationY = useSharedValue(0)
  const savedTranslationX = useSharedValue(0)
  const savedTranslationY = useSharedValue(0)

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(MAX_SCALE, Math.max(MIN_SCALE, savedScale.value * e.scale))
    })
    .onEnd(() => {
      savedScale.value = scale.value
      // Snap back to 1 if user pinched almost all the way out
      if (scale.value < 1.05) {
        scale.value = withSpring(1)
        savedScale.value = 1
        translationX.value = withSpring(0)
        translationY.value = withSpring(0)
        savedTranslationX.value = 0
        savedTranslationY.value = 0
      }
    })

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onUpdate((e) => {
      // Only allow pan when zoomed in
      if (savedScale.value > 1) {
        translationX.value = savedTranslationX.value + e.translationX
        translationY.value = savedTranslationY.value + e.translationY
      }
    })
    .onEnd(() => {
      savedTranslationX.value = translationX.value
      savedTranslationY.value = translationY.value
    })

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (savedScale.value > 1) {
        // Reset to 1x
        scale.value = withSpring(1)
        savedScale.value = 1
        translationX.value = withSpring(0)
        translationY.value = withSpring(0)
        savedTranslationX.value = 0
        savedTranslationY.value = 0
      } else {
        // Zoom in to 2x
        scale.value = withTiming(2, { duration: 200 })
        savedScale.value = 2
      }
    })

  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      // Only dismiss when not zoomed. This callback runs as a worklet
      // (Gesture API auto-tags it because we access savedScale.value),
      // so calling the JS onSingleTap directly would crash on the New
      // Architecture. runOnJS schedules it on the JS thread.
      if (savedScale.value <= 1 && onSingleTap) {
        runOnJS(onSingleTap)()
      }
    })
    // Only fire after double-tap resolution window passes
    .requireExternalGestureToFail(doubleTap)

  const composed = Gesture.Race(
    Gesture.Simultaneous(pinch, pan),
    Gesture.Exclusive(doubleTap, singleTap),
  )

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translationX.value },
      { translateY: translationY.value },
      { scale: scale.value },
    ],
  }))

  return (
    <GestureDetector gesture={composed}>
      <AnimatedImage
        source={{ uri }}
        style={[styles.image, style, animatedStyle]}
        resizeMode="contain"
      />
    </GestureDetector>
  )
}

const styles = StyleSheet.create({
  image: { width: '100%', height: '100%' },
})
