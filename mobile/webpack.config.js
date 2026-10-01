// Project Webpack config for Expo web export (`expo export:web`).
//
// Expo SDK 50 / RN 0.73.2 ships NO `Platform.web.js` inside
// `react-native/Libraries/Utilities`, which breaks web bundling for any deep
// import that references `../Utilities/Platform` (e.g. ReactNativePrivateInterface).
// react-native-web vendors the matching module, so we alias the exact path.
// Source: @expo/webpack-config alias strategy
//   https://github.com/expo/expo/blob/main/packages/@expo/webpack-config
const createExpoWebpackConfigAsync = require('@expo/webpack-config');

module.exports = async (env, argv) => {
  const config = await createExpoWebpackConfigAsync(env, argv);
  config.resolve = config.resolve || {};
  config.resolve.alias = {
    ...(config.resolve.alias || {}),
    'react-native/Libraries/Utilities/Platform$': require.resolve(
      'react-native-web/dist/vendor/react-native/Utilities/Platform'
    ),
  };
  return config;
};
