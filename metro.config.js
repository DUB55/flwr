const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Configure transformer to handle onnxruntime-web
config.transformer = {
  ...config.transformer,
  minifierConfig: {
    ...config.transformer.minifierConfig,
    keep_classnames: true,
    keep_fnames: true,
    mangle: {
      ...config.transformer.minifierConfig?.mangle,
      keep_classnames: true,
      keep_fnames: true,
    },
  },
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: false,
    },
  }),
};

// Add resolver configuration
config.resolver = {
  ...config.resolver,
  sourceExts: [...config.resolver.sourceExts, 'mjs', 'cjs'],
  assetExts: [...config.resolver.assetExts, 'bin'],
};

module.exports = config;
