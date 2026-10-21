import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated'

import { theme } from '@/core/ui/theme'

export type BannerTone = 'info' | 'good' | 'warn' | 'bad'

export interface Banner {
  id: number
  text: string
  tone: BannerTone
}

const TONE_COLORS: Record<BannerTone, string> = {
  info: theme.colors.primary,
  good: theme.colors.success,
  warn: theme.colors.warning,
  bad: theme.colors.danger,
}

/** Short transient message over the game view ("Speed up!", "Close call!", "500 m!"). */
export function RunBanner({ banner }: { banner: Banner | null }) {
  return (
    <View style={styles.wrap} pointerEvents="none">
      {banner && (
        <Animated.View key={banner.id} entering={FadeInDown.duration(180)} exiting={FadeOut.duration(250)} style={[styles.banner, { borderColor: TONE_COLORS[banner.tone] }]}>
          <Text style={[styles.text, { color: TONE_COLORS[banner.tone] }]}>{banner.text}</Text>
        </Animated.View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  banner: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.pill,
    borderWidth: 2,
    backgroundColor: theme.colors.overlay,
  },
  text: { fontSize: theme.font.heading, fontWeight: '900', letterSpacing: 0.5 },
})
