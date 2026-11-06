// expo-router/_ctx.ios.js, without the Android route tree. See metro.config.js.
export const ctx = require.context(
  './app',
  true,
  /^(?:\.\/)(?!android-)(?!(?:(?:(?:.*\+api)|(?:\+html)|(?:\+middleware)))\.[tj]sx?$).*(?:\.android|\.web)?\.[tj]sx?$/,
  'sync'
);
