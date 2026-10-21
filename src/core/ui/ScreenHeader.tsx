import { router } from 'expo-router'
import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { theme } from './theme'

export function ScreenHeader({ title, subtitle, right, onBack }: { title: string; subtitle?: string; right?: ReactNode; onBack?: () => void }) {
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))
  return (
    <View style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} style={styles.back} hitSlop={12}>
        <Text style={styles.backText}>‹</Text>
      </Pressable>
      <View style={styles.titles}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceGlass,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
  },
  backText: { color: theme.colors.text, fontSize: 30, lineHeight: 34, fontWeight: '600', marginTop: -2 },
  titles: { flex: 1 },
  title: { color: theme.colors.text, fontSize: theme.font.title, fontWeight: '900' },
  subtitle: { color: theme.colors.textMuted, fontSize: theme.font.small, marginTop: 2 },
})
