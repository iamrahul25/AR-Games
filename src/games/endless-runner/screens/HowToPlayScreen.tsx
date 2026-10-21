import { router } from 'expo-router'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { speak, stopSpeaking } from '@/core/audio/voice'
import { useSettings } from '@/core/settings/settingsStore'
import { Button } from '@/core/ui/Button'
import { ScreenHeader } from '@/core/ui/ScreenHeader'
import { SegmentedToggle } from '@/core/ui/SegmentedToggle'
import { theme } from '@/core/ui/theme'
import { MoveDemoFigure } from '../components/MoveDemoFigure'
import { ObstacleLegend } from '../components/ObstacleLegend'
import { RichPrompt } from '../components/TrainingOverlay'
import { RUNNER_ROUTES } from '../routes'

interface Page {
  title: string
  text: string
  visual: ReactNode
}

const PAGES: Page[] = [
  {
    title: 'Set up',
    text: 'Stand your phone up at **waist height**. Step back **2–3 big steps** so your whole body fits on screen. Clear some space around you.',
    visual: <SetupIllustration />,
  },
  {
    title: 'Your three lanes',
    text: 'The camera shows three lanes. The lane you stand in is the lane you run in. **Hop to your left** to go left, **hop to your right** to go right. Hop back to the middle for the center lane.',
    visual: <MoveDemoFigure move="lanes" />,
  },
  {
    title: 'Jump',
    text: 'See the **yellow JUMP line** above your head? **Jump straight up** so your head goes above it. Jump over **yellow** hurdles.',
    visual: <MoveDemoFigure move="jump" />,
  },
  {
    title: 'Duck',
    text: 'The **blue DUCK line** is below your head. **Bend your knees or lower your head** below it to slide under **blue** bars. Stay down until you pass.',
    visual: <MoveDemoFigure move="duck" />,
  },
  {
    title: 'Obstacles & coins',
    text: 'Jump the **yellow** hurdles, duck the **blue** bars and change lane around **red** walls. Grab coins and stars. Hit an obstacle and you lose a heart.',
    visual: <ObstacleLegend />,
  },
  {
    title: 'Choose your challenge',
    text: 'Pick a preset or set the **speed dial**. **Constant speed** is great for practice and exercise. **Increasing speed** gets faster as you go. Wear shoes, keep the floor clear, and stop if you feel tired or dizzy.',
    visual: <ChallengeIllustration />,
  },
]

const plain = (t: string) => t.replace(/\*\*/g, '')

export function HowToPlayScreen({ first = false }: { first?: boolean }) {
  const [page, setPage] = useState(0)
  const [width, setWidth] = useState(0)
  const scroll = useRef<ScrollViewInstance>(null)
  const setSettings = useSettings((s) => s.set)
  const last = page === PAGES.length - 1

  useEffect(() => () => stopSpeaking(), [])

  const goTo = (i: number) => {
    const p = Math.max(0, Math.min(PAGES.length - 1, i))
    setPage(p)
    scroll.current?.scrollTo({ x: p * width, animated: true })
  }
  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width > 0) setPage(Math.round(e.nativeEvent.contentOffset.x / width))
  }
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)

  const finish = (training: boolean) => {
    stopSpeaking()
    setSettings({ safetyAcknowledged: true })
    if (training) router.replace(`${RUNNER_ROUTES.play}?training=1` as never)
    else if (first) router.replace(RUNNER_ROUTES.play as never)
    else if (router.canGoBack()) router.back()
    else router.replace(RUNNER_ROUTES.home as never)
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.header}>
        <ScreenHeader
          title="How to play"
          subtitle={`${page + 1} / ${PAGES.length}`}
          onBack={() => (router.canGoBack() ? router.back() : router.replace(RUNNER_ROUTES.home as never))}
          right={
            <Pressable accessibilityRole="button" accessibilityLabel="Read aloud" hitSlop={10} onPress={() => speak(plain(`${PAGES[page].title}. ${PAGES[page].text}`), { force: true })}>
              <Text style={styles.speaker}>🔊</Text>
            </Pressable>
          }
        />
      </View>
      <View style={styles.pager} onLayout={onLayout}>
        {width > 0 && (
          <ScrollView ref={scroll} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onScrollEnd} onScrollEndDrag={onScrollEnd}>
            {PAGES.map((p, i) => (
              <ScrollView key={p.title} style={{ width }} contentContainerStyle={styles.page}>
                <Text style={styles.title}>{p.title}</Text>
                {Math.abs(i - page) <= 1 ? p.visual : <View style={styles.placeholder} />}
                <RichPrompt text={p.text} style={styles.text} />
              </ScrollView>
            ))}
          </ScrollView>
        )}
      </View>
      <View style={styles.footer}>
        <View style={styles.dots}>
          {PAGES.map((p, i) => (
            <Pressable key={p.title} accessibilityLabel={`Page ${i + 1}`} hitSlop={8} onPress={() => goTo(i)}>
              <View style={[styles.dot, i === page && styles.dotOn]} />
            </Pressable>
          ))}
        </View>
        {last ? (
          <View style={styles.row}>
            <Button label="Start Training Run" onPress={() => finish(true)} style={styles.flex} />
            {!first && <Button label="Done" variant="secondary" onPress={() => finish(false)} />}
          </View>
        ) : (
          <View style={styles.row}>
            <Button label="Back" variant="ghost" disabled={page === 0} onPress={() => goTo(page - 1)} />
            <Button label="Next" onPress={() => goTo(page + 1)} style={styles.flex} />
          </View>
        )}
      </View>
    </SafeAreaView>
  )
}

function SetupIllustration() {
  return (
    <View style={styles.illo}>
      <View style={styles.setupRow}>
        <View style={styles.phone}>
          <Text style={styles.phoneIcon}>📱</Text>
          <Text style={styles.illoLabel}>waist height</Text>
        </View>
        <View style={styles.arrow}>
          <Text style={styles.arrowText}>⟵ 2–3 m ⟶</Text>
        </View>
        <Text style={styles.person}>🧍</Text>
      </View>
      <Text style={styles.illoLabel}>Clear space: about 2.5 m wide × 1.5 m deep</Text>
    </View>
  )
}

function ChallengeIllustration() {
  return (
    <View style={[styles.illo, styles.challenge]}>
      <View style={styles.dialMini}>
        <Text style={styles.dialValue}>5</Text>
        <Text style={styles.dialLabel}>RUN</Text>
      </View>
      <SegmentedToggle
        value="constant"
        onChange={() => {}}
        options={[
          { value: 'constant', label: 'Constant' },
          { value: 'increasing', label: 'Increasing' },
        ]}
      />
      <Text style={styles.illoLabel}>👟 Shoes on · 🧹 Floor clear · 🛑 Stop if dizzy</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  header: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm },
  speaker: { fontSize: 26 },
  pager: { flex: 1 },
  page: { padding: theme.spacing.lg, gap: theme.spacing.lg, maxWidth: 620, width: '100%', alignSelf: 'center' },
  title: { color: theme.colors.text, fontSize: theme.font.title, fontWeight: '900' },
  text: { fontSize: theme.font.heading - 2, lineHeight: 30, fontWeight: '600' },
  placeholder: { height: 240 },
  footer: { padding: theme.spacing.lg, gap: theme.spacing.md, maxWidth: 620, width: '100%', alignSelf: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: theme.spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.track },
  dotOn: { backgroundColor: theme.colors.primary, width: 24 },
  row: { flexDirection: 'row', gap: theme.spacing.sm },
  flex: { flex: 1 },
  illo: {
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    backgroundColor: '#101B3A',
    minHeight: 200,
    justifyContent: 'center',
  },
  setupRow: { flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.md },
  phone: { alignItems: 'center' },
  phoneIcon: { fontSize: 44 },
  arrow: { paddingBottom: 24 },
  arrowText: { color: theme.colors.primary, fontWeight: '900', fontSize: theme.font.body },
  person: { fontSize: 88 },
  illoLabel: { color: theme.colors.textMuted, fontWeight: '700', textAlign: 'center' },
  challenge: { gap: theme.spacing.lg },
  dialMini: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 6,
    borderColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialValue: { color: theme.colors.text, fontSize: 40, fontWeight: '900', lineHeight: 44 },
  dialLabel: { color: theme.colors.primary, fontWeight: '900', letterSpacing: 2 },
})
