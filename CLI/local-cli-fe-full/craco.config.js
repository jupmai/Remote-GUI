console.log('CRACO LOADING - react eager:', true);
const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');
const deps = require('./package.json').dependencies;

module.exports = {
  webpack: {
    plugins: {
      add: [
        new ModuleFederationPlugin({
          name: 'host',
          remotes: {}, // plugins are loaded dynamically at runtime
          shared: {
            react: {
              singleton: true,
              requiredVersion: deps.react,
              eager: true,
            },
            'react-dom': {
              singleton: true,
              requiredVersion: deps['react-dom'],
              eager: true,
            },
          },
        }),
      ],
    },
  },
};