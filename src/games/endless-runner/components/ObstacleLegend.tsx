import { StyleSheet, Text, View } from 'react-native'

import { theme } from '@/core/ui/theme'
import { OBSTACLE_SHAPES } from '../config/world'

const ITEMS = [
  { swatch: OBSTACLE_SHAPES.hurdle.color, shape: 'hurdle', name: 'Yellow hurdle', action: '▲ Jump over it' },
  { swatch: OBSTACLE_SHAPES.bar.color, shape: 'bar', name: 'Blue bar', action: '▼ Duck under it' },
  { swatch: OBSTACLE_SHAPES.wall.color, shape: 'wall', name: 'Red wall', action: '◀ ▶ Change lane' },
  { swatch: theme.colors.gold, shape: 'coin', name: 'Coin', action: '+10 points' },
  { swatch: '#FFFFFF', shape: 'star', name: 'Star', action: '+100 points' },
] as const

/** Obstacle colours + shapes (never colour alone) and what to do about each. */
export function ObstacleLegend() {
  return (
    <View style={styles.list}>
      {ITEMS.map((it) => (
        <View key={it.shape} style={styles.row}>
          <View style={styles.iconBox}>
            <Swatch shape={it.shape} color={it.swatch} />
          </View>
          <Text style={styles.name}>{it.name}</Text>
          <Text style={styles.action}>{it.action}</Text>
        </View>
      ))}
    </View>
  )
}

function Swatch({ shape, color }: { shape: (typeof ITEMS)[number]['shape']; color: string }) {
  switch (shape) {
    case 'hurdle':
      return <View style={[styles.hurdle, { backgroundColor: color }]} />
    case 'bar':
      return (
        <View style={styles.barWrap}>
          <View style={[styles.bar, { backgroundColor: color }]} />
          <View style={[styles.post, styles.postL]} />
          <View style={[styles.post, styles.postR]} />
        </View>
      )
    case 'wall':
      return <View style={[styles.wall, { backgroundColor: color }]} />
    case 'coin':
      return <View style={[styles.coin, { backgroundColor: color }]} />
    case 'star':
      return <Text style={styles.star}>★</Text>
  }
}

const styles = StyleSheet.create({
  list: { gap: theme.spacing.sm, alignSelf: 'stretch' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.track,
  },
  iconBox: { width: 48, height: 40, alignItems: 'center', justifyContent: 'flex-end' },
  name: { flex: 1, color: theme.colors.text, fontWeight: '800', fontSize: theme.font.body },
  action: { color: theme.colors.textMuted, fontWeight: '800', fontSize: theme.font.body },
  hurdle: { width: 44, height: 14, borderRadius: 3 },
  barWrap: { width: 44, height: 40 },
  bar: { position: 'absolute', top: 4, left: 0, right: 0, height: 10, borderRadius: 3 },
  post: { position: 'absolute', top: 4, bottom: 0, width: 4, backgroundColor: '#1C6E94' },
  postL: { left: 0 },
  postR: { right: 0 },
  wall: { width: 36, height: 38, borderRadius: 3 },
  coin: { width: 22, height: 22, borderRadius: 11, marginBottom: 8 },
  star: { color: '#fff', fontSize: 30, lineHeight: 36, textShadowColor: theme.colors.gold, textShadowRadius: 8 },
})
