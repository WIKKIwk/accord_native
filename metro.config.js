const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const upstream = config.resolver.resolveRequest;

// D7 gives each platform its own route tree and D8 gives its screens no fallback, so one
// platform's routes cannot be bundled for the other. Each platform gets a route context without them.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'expo-router/_ctx' && (platform === 'ios' || platform === 'android')) {
    return { type: 'sourceFile', filePath: path.join(__dirname, `src/routeContext.${platform}.js`) };
  }
  return (upstream ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
