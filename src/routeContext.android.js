// expo-router/_ctx.android.js, without the iOS route tree. See metro.config.js.
export const ctx = require.context(
  './app',
  true,
  /^(?:\.\/)(?!ios-)(?!(?:(?:(?:.*\+api)|(?:\+html)|(?:\+middleware)))\.[tj]sx?$).*(?:\.ios|\.web)?\.[tj]sx?$/,
  'sync'
);
