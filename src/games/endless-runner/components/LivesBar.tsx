import { StyleSheet, Text, View } from 'react-native'

import { theme } from '@/core/ui/theme'

export function LivesBar({ lives, max }: { lives: number | null; max: number | null }) {
  if (lives === null || max === null) {
    return (
      <View style={styles.row} accessibilityLabel="Unlimited lives">
        <Text style={styles.heart}>♥</Text>
        <Text style={styles.infinity}>∞</Text>
      </View>
    )
  }
  return (
    <View style={styles.row} accessibilityLabel={`${lives} of ${max} lives`}>
      {Array.from({ length: max }, (_, i) => (
        <Text key={i} style={[styles.heart, i >= lives && styles.empty]}>
          ♥
        </Text>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  heart: { color: theme.colors.danger, fontSize: 22, fontWeight: '900' },
  empty: { color: 'rgba(255,255,255,0.22)' },
  infinity: { color: theme.colors.text, fontSize: 20, fontWeight: '900', marginLeft: 2 },
})
