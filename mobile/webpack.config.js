







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
