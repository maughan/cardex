module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // Reanimated 4 uses the worklets plugin (replaces react-native-reanimated/plugin).
    // It MUST be listed last.
    plugins: ["react-native-worklets/plugin"],
  };
};
