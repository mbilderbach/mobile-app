// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Supabase pulls in the `ws` package, which imports Node-only modules
// (stream, http, net…). Those don't exist in the web bundle. On web,
// the browser's native WebSocket is used instead, so we can safely
// stub `ws` to an empty module to let Metro bundle for web.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && (moduleName === 'ws' || moduleName.startsWith('ws/'))) {
    return { type: 'empty' };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
