import * as Device from 'expo-device'
import { DarkTheme, Stack, ThemeProvider } from 'expo-router'
import * as ScreenOrientation from 'expo-screen-orientation'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { Platform } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { preloadSounds } from '@/core/audio/sfx'
import { theme } from '@/core/ui/theme'

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: theme.colors.background,
    card: theme.colors.background,
    primary: theme.colors.primary,
    text: theme.colors.text,
    border: theme.colors.surfaceBorder,
  },
}

export default function RootLayout() {
  useEffect(() => {
    preloadSounds()
    // Phones play in portrait; tablets and the web use the landscape split view when rotated.
    if (Platform.OS !== 'web' && Device.deviceType === Device.DeviceType.PHONE) {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {})
    }
  }, [])

  return (
    <SafeAreaProvider>
      <ThemeProvider value={navTheme}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.colors.background },
            animation: 'fade',
          }}
        />
      </ThemeProvider>
    </SafeAreaProvider>
  )
}
