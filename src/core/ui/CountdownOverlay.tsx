import { StyleSheet, Text, View } from 'react-native'

import { theme } from './theme'

/** Big centered 3-2-1 number (or any short text, e.g. "GO!"). */
export function CountdownOverlay({ value }: { value: number | string }) {
  return (
    <View style={styles.center} pointerEvents="none">
      <Text style={styles.countdown} accessibilityLiveRegion="assertive">
        {value}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  countdown: {
    color: theme.colors.text,
    fontSize: 140,
    fontWeight: '900',
    textShadowColor: theme.colors.glow,
    textShadowRadius: 24,
  },
})
