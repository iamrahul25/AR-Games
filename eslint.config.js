// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      'dist/*',
      'public/*',
      'android/*',
      'ios/*',
      'modules/*/nitrogen/*',
      'modules/*/android/build/*',
    ],
  },
  {
    // Shared engine code must stay game-agnostic.
    files: ['src/core/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{ group: ['@/games/*', '@/app/*'], message: 'core must not depend on games or routes' }] }],
    },
  },
  {
    // A game may use core, but never another game's folder.
    files: ['src/games/match-pose/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{ group: ['@/games/*', '!@/games/match-pose', '!@/games/types'], message: 'games must not import from other games' }] }],
    },
  },
  {
    files: ['scripts/**/*.js', '*.config.js'],
    languageOptions: {
      globals: { __dirname: 'readonly', Buffer: 'readonly', process: 'readonly', require: 'readonly', module: 'writable' },
    },
  },
]);
