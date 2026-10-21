import { useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { theme } from '@/core/ui/theme'

/** A collapsible group of options ("More options" on the Difficulty screen). */
export function OptionGroup({ title, children, initiallyOpen = false }: { title: string; children: ReactNode; initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen)
  return (
    <View style={styles.group}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={({ pressed }) => [styles.header, pressed && { opacity: 0.75 }]}
      >
        <Text style={styles.chevron}>{open ? '▾' : '▸'}</Text>
        <Text style={styles.title}>{title}</Text>
      </Pressable>
      {open && (
        <Animated.View entering={FadeIn.duration(180)} style={styles.body}>
          {children}
        </Animated.View>
      )}
    </View>
  )
}

/** One option: label + one-line explanation + control. */
export function OptionRow({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      {help ? <Text style={styles.help}>{help}</Text> : null}
      <View style={styles.control}>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  group: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    backgroundColor: theme.colors.surfaceGlass,
    overflow: 'hidden',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, padding: theme.spacing.lg, minHeight: 52 },
  chevron: { color: theme.colors.primary, fontSize: 18, width: 16 },
  title: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '900' },
  body: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.lg, gap: theme.spacing.lg },
  row: { gap: 4 },
  label: { color: theme.colors.text, fontWeight: '800', fontSize: theme.font.body },
  help: { color: theme.colors.textMuted, fontSize: theme.font.small },
  control: { marginTop: 4 },
})
